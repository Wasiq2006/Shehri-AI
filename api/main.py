import os
import base64
import uuid
import io
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager

import cv2
import numpy as np
from PIL import Image, ExifTags
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from ultralytics import YOLO

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

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
BASE_DIR           = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH   = os.path.join(BASE_DIR, "config", "firebase_credentials.json")
POTHOLE_MODEL_PATH = os.path.join(BASE_DIR, "models", "pothole_best.pt")
GARBAGE_MODEL_PATH = os.path.join(BASE_DIR, "models", "garbage_best.pt")

# ---------------------------------------------------------------------------
# Firebase Initialization
# Supports two modes:
#   1. Local dev: reads from config/firebase_credentials.json file
#   2. Render/production: reads from FIREBASE_CREDENTIALS_JSON env var
# ---------------------------------------------------------------------------
try:
    if not firebase_admin._apps:
        firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
        if firebase_creds_json:
            import json
            cred_dict = json.loads(firebase_creds_json)
            cred = credentials.Certificate(cred_dict)
            logger.info("Firebase credentials loaded from environment variable.")
        else:
            cred = credentials.Certificate(CREDENTIALS_PATH)
            logger.info("Firebase credentials loaded from file: %s", CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
    db: firestore.Client = firestore.client()
    logger.info("Firebase Admin initialized successfully.")
except Exception as exc:
    logger.critical("Failed to initialize Firebase Admin: %s", exc)
    db = None

# ---------------------------------------------------------------------------
# YOLO Models Initialization
# ---------------------------------------------------------------------------
try:
    pothole_model = YOLO(POTHOLE_MODEL_PATH)
    logger.info("Pothole YOLO model loaded from: %s", POTHOLE_MODEL_PATH)
except Exception as exc:
    logger.critical("Failed to load Pothole YOLO model: %s", exc)
    pothole_model = None

try:
    garbage_model = YOLO(GARBAGE_MODEL_PATH)
    logger.info("Garbage YOLO model loaded from: %s", GARBAGE_MODEL_PATH)
except Exception as exc:
    logger.critical("Failed to load Garbage YOLO model: %s", exc)
    garbage_model = None


# ---------------------------------------------------------------------------
# Auto-Cleanup: Delete reports older than 30 days
# ---------------------------------------------------------------------------
REPORT_TTL_DAYS = int(os.environ.get("REPORT_TTL_DAYS", 30))

def cleanup_old_reports(force_all: bool = False) -> int:
    """Delete Firestore documents older than REPORT_TTL_DAYS, or all if force_all=True. Returns count deleted."""
    if db is None:
        logger.warning("Cleanup skipped: database unavailable.")
        return 0

    deleted = 0

    try:
        if force_all:
            docs = db.collection("shehri_reports").stream()
        else:
            cutoff = datetime.now(timezone.utc) - timedelta(days=REPORT_TTL_DAYS)
            docs = db.collection("shehri_reports").where(
                "upload_time", "<", cutoff
            ).stream()

        for doc in docs:
            doc.reference.delete()
            deleted += 1

        if deleted:
            if force_all:
                logger.info("Cleanup: FORCE DELETED ALL %d report(s).", deleted)
            else:
                logger.info("Cleanup: deleted %d report(s) older than %d days.", deleted, REPORT_TTL_DAYS)
        else:
            logger.info("Cleanup: no reports found to delete.")
    except Exception as exc:
        logger.error("Cleanup failed: %s", exc)

    return deleted


async def _cleanup_loop():
    """Background loop that runs cleanup once every 24 hours."""
    while True:
        await asyncio.sleep(86400)  # 24 hours
        logger.info("Running scheduled 30-day cleanup...")
        cleanup_old_reports()


@asynccontextmanager
async def lifespan(app):
    """FastAPI lifespan: starts the daily cleanup task on boot."""
    # Run an initial cleanup on startup
    logger.info("Running startup cleanup (TTL = %d days)...", REPORT_TTL_DAYS)
    cleanup_old_reports()

    # Start the recurring background loop
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()


# ---------------------------------------------------------------------------
# Rate Limiting
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# FastAPI App + CORS
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ShehriAI Backend",
    description="Dual-Model AI-powered civic infrastructure reporting API.",
    version="4.0.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
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
    result = {"exif_time": None, "exif_location": None}
    try:
        pil_img  = Image.open(io.BytesIO(image_bytes))
        raw_exif = pil_img._getexif()
        if raw_exif is None:
            return result

        exif = {ExifTags.TAGS.get(k, k): v for k, v in raw_exif.items()}

        dt_str = exif.get("DateTimeOriginal")
        if dt_str:
            try:
                result["exif_time"] = datetime.strptime(
                    dt_str, "%Y:%m:%d %H:%M:%S"
                ).replace(tzinfo=timezone.utc)
            except ValueError:
                pass

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
    arr = np.asarray(bytearray(raw_bytes), dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — unsupported or corrupt image.")
    
    # Downscale large images to prevent Out-Of-Memory (OOM) crashes on Render
    h, w = img.shape[:2]
    max_dim = 1024
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
        
    return img


def annotate_and_encode(
    img: np.ndarray,
    x1: int, y1: int, x2: int, y2: int,
    label: str,
    confidence: float,
    color: tuple = (0, 0, 255)
) -> str:
    out = img.copy()

    # Bounding box
    cv2.rectangle(out, (x1, y1), (x2, y2), color, thickness=3)

    # Text
    text = f"{label}: {confidence:.2f}"
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.9, 2
    (tw, th), baseline  = cv2.getTextSize(text, font, scale, thick)
    label_y1 = max(y1 - th - baseline - 4, 0)

    # Label background
    cv2.rectangle(out, (x1, label_y1), (x1 + tw + 4, y1 + baseline), color, -1)
    # Label text
    cv2.putText(out, text, (x1 + 2, y1), font, scale, (255, 255, 255), thick, cv2.LINE_AA)

    # Encode to JPEG
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        raise ValueError("Failed to JPEG-encode annotated image.")
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")


def calculate_severity(confidence: float) -> int:
    return max(1, min(10, round(confidence * 10)))


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/v1/submit_report", status_code=200)
@limiter.limit("5/minute")
async def submit_report(
    request: Request,
    user_id: str       = Form(...),
    lat:     float     = Form(...),
    lng:     float     = Form(...),
    file:    UploadFile = File(...),
):
    if pothole_model is None or garbage_model is None or db is None:
        raise HTTPException(status_code=500, detail="Server not fully initialized.")

    # Security: File Type Check
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG and PNG are allowed.")

    # Security: File Size Check (10MB max)
    if getattr(file, 'size', None) and file.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    try:
        raw_bytes = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"File read error: {exc}")

    # Fallback size check if file.size was None
    if len(raw_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    exif = extract_exif(raw_bytes)

    try:
        img = decode_image_bytes(raw_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        # Run inference sequentially to save memory
        pothole_results = run_pothole_inference(img)
        garbage_results = run_garbage_inference(img)
        
        # Force garbage collection just in case
        import gc
        gc.collect()
    except Exception as exc:
        logger.exception("YOLO inference failed.")
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}")

    best_pothole_box = None
    pothole_conf = -1.0
    if pothole_results and pothole_results[0].boxes is not None and len(pothole_results[0].boxes) > 0:
        boxes = pothole_results[0].boxes
        best_pothole_box = boxes[int(boxes.conf.argmax())]
        pothole_conf = float(best_pothole_box.conf)

    best_garbage_box = None
    garbage_conf = -1.0
    if garbage_results and garbage_results[0].boxes is not None and len(garbage_results[0].boxes) > 0:
        boxes = garbage_results[0].boxes
        best_garbage_box = boxes[int(boxes.conf.argmax())]
        garbage_conf = float(best_garbage_box.conf)

    # If neither model found anything
    if best_pothole_box is None and best_garbage_box is None:
        return {"success": False, "message": "No issues detected in the provided image."}

    # Compare and select the absolute best detection
    if pothole_conf >= garbage_conf:
        winning_box = best_pothole_box
        confidence = pothole_conf
        raw_name = pothole_model.names[int(winning_box.cls)]
        detection_class = "Pothole" if raw_name == "0" else raw_name.title()
        color = (0, 0, 255) # Red for Potholes
    else:
        winning_box = best_garbage_box
        confidence = garbage_conf
        raw_name = garbage_model.names[int(winning_box.cls)].title()
        detection_class = "Garbage"
        color = (0, 200, 0) # Green for Garbage/Waste

    severity_score  = calculate_severity(confidence)

    h, w   = img.shape[:2]
    xyxy   = winning_box.xyxy[0].tolist()
    x1, y1 = max(0, int(xyxy[0])), max(0, int(xyxy[1]))
    x2, y2 = min(w, int(xyxy[2])), min(h, int(xyxy[3]))

    try:
        annotated_uri = annotate_and_encode(img, x1, y1, x2, y2, detection_class, confidence, color)
    except Exception as exc:
        logger.exception("Annotation failed.")
        raise HTTPException(status_code=500, detail=f"Annotation error: {exc}")

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
        logger.info("Report saved. report_id=%s, type=%s", report_id, detection_class)
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
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")
    try:
        docs = db.collection("shehri_reports").stream()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database read error: {exc}")

    points = []
    for doc in docs:
        d = doc.to_dict()
        
        # Scenario: Try EXIF first, if invalid/missing, fallback to POST location
        loc = d.get("exif_location")
        if not loc or loc.get("latitude") is None or loc.get("longitude") is None:
            loc = d.get("upload_location")
            
        if not loc:
            continue
            
        lat_ = loc.get("latitude")
        lng_ = loc.get("longitude")
        sev  = d.get("severity_score", 1)
        det  = d.get("issue_category", "Unknown")
        if lat_ is not None and lng_ is not None:
            points.append([lat_, lng_, sev, det])

    return JSONResponse(content={"points": points})


@app.post("/api/v1/cleanup", status_code=200)
async def manual_cleanup(force_all: bool = False):
    """Manually trigger deletion of reports older than 30 days, or ALL reports if force_all=true."""
    if db is None:
        raise HTTPException(status_code=500, detail="Database unavailable.")
    deleted = cleanup_old_reports(force_all=force_all)
    return {"success": True, "deleted": deleted, "ttl_days": "ALL" if force_all else REPORT_TTL_DAYS}
