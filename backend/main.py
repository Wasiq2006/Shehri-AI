import os
import base64
import uuid
import io
import logging
from datetime import datetime, timezone

import cv2
import numpy as np
from PIL import Image, ExifTags
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("shehri_ai")

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR         = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, "config", "firebase_credentials.json")
MODEL_PATH       = os.path.join(BASE_DIR, "assets", "weights", "best.pt")

# ---------------------------------------------------------------------------
# Class name mapping  (extend as your model grows)
# ---------------------------------------------------------------------------
CLASS_NAME_MAP: dict[str, str] = {
    "0": "Pothole",
}

# ---------------------------------------------------------------------------
# Firebase Initialization
# ---------------------------------------------------------------------------
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    db: firestore.Client = firestore.client()
    logger.info("Firebase Admin initialized successfully.")
except Exception as exc:
    logger.critical("Failed to initialize Firebase Admin: %s", exc)
    db = None

# ---------------------------------------------------------------------------
# YOLO Model Initialization
# ---------------------------------------------------------------------------
try:
    model = YOLO(MODEL_PATH)
    logger.info("YOLO model loaded from: %s", MODEL_PATH)
except Exception as exc:
    logger.critical("Failed to load YOLO model: %s", exc)
    model = None

# ---------------------------------------------------------------------------
# FastAPI App + CORS
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ShehriAI Backend",
    description="AI-powered civic infrastructure reporting API.",
    version="3.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# EXIF Helpers
# ---------------------------------------------------------------------------
def _dms_to_decimal(dms_values, ref: str) -> float:
    """
    Convert EXIF DMS (Degrees, Minutes, Seconds) to a decimal float.
    Each DMS element can be an IFDRational or a (numerator, denominator) tuple.
    """
    def to_float(v) -> float:
        try:
            return float(v)
        except TypeError:
            return v[0] / v[1]

    degrees = to_float(dms_values[0])
    minutes = to_float(dms_values[1])
    seconds = to_float(dms_values[2])
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if ref in ("S", "W"):
        decimal = -decimal
    return round(decimal, 7)


def extract_exif(image_bytes: bytes) -> dict:
    """
    Extract DateTimeOriginal and GPS coordinates from EXIF data using Pillow.
    Returns: {"exif_time": datetime | None, "exif_location": dict | None}
    Handles missing/stripped EXIF gracefully — never raises.
    """
    result = {"exif_time": None, "exif_location": None}
    try:
        pil_img  = Image.open(io.BytesIO(image_bytes))
        raw_exif = pil_img._getexif()
        if raw_exif is None:
            return result

        exif = {ExifTags.TAGS.get(k, k): v for k, v in raw_exif.items()}

        # Timestamp
        dt_str = exif.get("DateTimeOriginal")
        if dt_str:
            try:
                result["exif_time"] = datetime.strptime(
                    dt_str, "%Y:%m:%d %H:%M:%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                pass

        # GPS
        gps_raw = exif.get("GPSInfo")
        if gps_raw:
            gps     = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps_raw.items()}
            lat_dms = gps.get("GPSLatitude")
            lat_ref = gps.get("GPSLatitudeRef")
            lng_dms = gps.get("GPSLongitude")
            lng_ref = gps.get("GPSLongitudeRef")
            if lat_dms and lat_ref and lng_dms and lng_ref:
                result["exif_location"] = {
                    "latitude":  _dms_to_decimal(lat_dms, lat_ref),
                    "longitude": _dms_to_decimal(lng_dms, lng_ref),
                }
    except Exception as exc:
        logger.warning("EXIF extraction skipped (non-fatal): %s", exc)
    return result


# ---------------------------------------------------------------------------
# Image / CV Helpers
# ---------------------------------------------------------------------------
def decode_image_bytes(raw_bytes: bytes) -> np.ndarray:
    """Decode raw bytes into a BGR NumPy array via OpenCV."""
    arr = np.asarray(bytearray(raw_bytes), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — unsupported or corrupt image.")
    return img


def resolve_class_name(raw_name: str) -> str:
    """Apply class name mapping; return raw_name if no override exists."""
    return CLASS_NAME_MAP.get(str(raw_name), raw_name)


def annotate_and_encode(
    img: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    label: str,
    confidence: float,
) -> str:
    """
    Draw a red bounding box + label on *img*.
    Returns a Base64-encoded JPEG data URI.
    """
    out = img.copy()

    # Red bounding box
    cv2.rectangle(out, (x1, y1), (x2, y2), (0, 0, 255), thickness=3)

    # Text
    text = f"{label}: {confidence:.2f}"
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2
    (tw, th), baseline  = cv2.getTextSize(text, font, scale, thick)
    label_y1 = max(y1 - th - baseline - 4, 0)

    # Label background
    cv2.rectangle(out, (x1, label_y1), (x1 + tw + 4, y1 + baseline), (0, 0, 255), -1)
    # Label text
    cv2.putText(out, text, (x1 + 2, y1), font, scale, (255, 255, 255), thick, cv2.LINE_AA)

    # Encode to JPEG
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        raise ValueError("Failed to JPEG-encode annotated image.")
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")


def calculate_severity(confidence: float) -> int:
    """Map [0.0, 1.0] confidence to a 1–10 severity integer."""
    return max(1, min(10, round(confidence * 10)))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/api/v1/submit_report", status_code=200)
async def submit_report(
    user_id: str       = Form(...),
    lat:     float     = Form(...),
    lng:     float     = Form(...),
    file:    UploadFile = File(...),
):
    # Startup guard
    if model is None or db is None:
        raise HTTPException(status_code=500, detail="Server not fully initialized.")

    # Read bytes
    try:
        raw_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"File read error: {exc}")

    # EXIF (non-fatal)
    exif = extract_exif(raw_bytes)

    # Decode image
    try:
        img = decode_image_bytes(raw_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # YOLO inference
    try:
        results = model(img, verbose=False)
    except Exception as exc:
        logger.exception("YOLO inference failed.")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    if not results or results[0].boxes is None or len(results[0].boxes) == 0:
        return {"success": False, "message": "No issues detected in the provided image."}

    # Best detection
    boxes    = results[0].boxes
    best_box = boxes[int(boxes.conf.argmax())]

    confidence      = float(best_box.conf)
    detection_class = resolve_class_name(model.names[int(best_box.cls)])
    severity_score  = calculate_severity(confidence)

    h, w   = img.shape[:2]
    xyxy   = best_box.xyxy[0].tolist()
    x1, y1 = max(0, int(xyxy[0])), max(0, int(xyxy[1]))
    x2, y2 = min(w, int(xyxy[2])), min(h, int(xyxy[3]))

    # Annotate
    try:
        annotated_uri = annotate_and_encode(img, x1, y1, x2, y2, detection_class, confidence)
    except Exception as exc:
        logger.exception("Annotation failed.")
        raise HTTPException(status_code=500, detail=f"Annotation error: {exc}")

    # Firestore
    report_id = str(uuid.uuid4())
    doc = {
        "report_id":       report_id,
        "user_id":         user_id,
        "issue_category":  detection_class,
        "severity_score":  severity_score,
        "confidence":      round(confidence, 4),
        "bounding_box":    {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        "upload_location": {"latitude": lat, "longitude": lng},
        "exif_location":   exif["exif_location"],
        "upload_time":     datetime.now(timezone.utc),
        "exif_time":       exif["exif_time"],
        "status":          "Pending",
    }
    try:
        db.collection("shehri_reports").document(report_id).set(doc)
        logger.info("Report saved. report_id=%s", report_id)
    except Exception as exc:
        logger.exception("Firestore write failed.")
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    return {
        "success":         True,
        "report_id":       report_id,
        "detection":       detection_class,
        "severity_score":  severity_score,
        "confidence":      round(confidence, 4),
        "annotated_image": annotated_uri,
        "lat":             lat,
        "lng":             lng,
        "exif_location":   exif.get("exif_location"),
        "upload_time":     datetime.now(timezone.utc).isoformat(),
        "exif_time":       exif.get("exif_time"),
    }


@app.get("/api/v1/heatmap")
async def get_heatmap():
    """
    Return [[lat, lng, severity_score], ...] for all reports.
    Prefers exif_location; falls back to upload_location.
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")
    try:
        docs = db.collection("shehri_reports").stream()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database read error: {exc}")

    points = []
    for doc in docs:
        d   = doc.to_dict()
        loc = d.get("exif_location") or d.get("upload_location")
        if not loc:
            continue
        lat_ = loc.get("latitude")
        lng_ = loc.get("longitude")
        sev  = d.get("severity_score", 1)
        det  = d.get("issue_category", "Unknown")
        if lat_ is not None and lng_ is not None:
            points.append([lat_, lng_, sev, det])

    return JSONResponse(content={"points": points})
