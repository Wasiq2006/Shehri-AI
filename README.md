<p align="center">
  <img src="frontend/public/ShehriAILogo.png" width="200" alt="Shehri AI Logo" />
</p>

# Shehri AI

Shehri AI is an intelligent civic infrastructure reporting application designed to streamline the identification and reporting of municipal issues such as potholes and garbage accumulation. The platform leverages edge device inputs, computer vision (YOLOv8), and geospatial data mapping to deliver actionable insights directly to city administration (e.g., CDA).

## System Architecture

The project follows a decoupled, microservice-inspired architecture:

*   **Frontend (Client):** A responsive, mobile-first web application built with React, Vite, and Tailwind CSS. It handles image capture, device geolocation, and renders an interactive Leaflet heatmap of civic issues.
*   **Backend (API):** A high-performance, asynchronous REST API built on FastAPI (Python). It manages file uploads, executes computer vision inference, handles metadata extraction (EXIF), and enforces security policies (rate limiting, payload size validation).
*   **Database (Storage):** Google Firebase Firestore (NoSQL) is used for persistent storage of report metadata, severity scores, and geospatial coordinates.
*   **AI Models:** Ultralytics YOLOv8 models are utilized for real-time object detection.

## Core Features

*   **Dual-Model Computer Vision:** Dedicated YOLOv8 inference paths for infrastructure damage (potholes) and sanitation issues (garbage), complete with severity scoring based on model confidence.
*   **Intelligent Geolocation:** Extracts embedded EXIF GPS data from uploaded photographs. If EXIF data is missing, the system falls back to the HTML5 Geolocation API provided by the client device.
*   **Live Geospatial Heatmap:** Aggregates and plots submitted reports on an interactive city map.
*   **Automated Administrative Routing:** Generates pre-formatted reporting templates for direct dispatch to relevant civic authorities.
*   **Security & Optimization:** Integrates `slowapi` for endpoint rate-limiting (preventing DDoS and abuse), strict MIME type validation, 10MB payload restrictions, and automated 30-day database retention cleanup.

## Local Development Setup

Ensure you have Node.js (v18+) and Python (3.10+) installed on your local machine.

### 1. Backend Installation

Navigate to the `api` directory and create a virtual environment:

```bash
cd api
python -m venv shehri_env
source shehri_env/bin/activate  # On Windows: shehri_env\Scripts\activate
```

Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

**Firebase Configuration:**
Place your Firebase Admin SDK JSON credential file in the `api/config/` directory. The backend will automatically detect and load it for database operations.

Start the FastAPI development server:

```bash
uvicorn main:app --host 0.0.0.0 --port 10000 --reload
```

### 2. Frontend Installation

Navigate to the `frontend` directory and install the Node modules:

```bash
cd frontend
npm install
```

Start the Vite development server:

```bash
npm run dev
```

The frontend will be accessible at `http://localhost:5173`. By default, the Vite proxy is configured to route `/api/*` traffic to the local backend on port 10000.

## Production Deployment

The application is configured for split deployment across Vercel and Render.

### Backend Deployment (Render)

1. Connect your repository to a new Render Docker Web Service.
2. Set the root directory to `api`.
3. Add the `FIREBASE_CREDENTIALS_JSON` environment variable in the Render dashboard, pasting the full raw JSON string of your Firebase service account key.
4. The provided `Dockerfile` will automatically resolve dependencies, download the YOLO model weights from HuggingFace, and expose the required port.

### Frontend Deployment (Vercel)

1. Connect your repository to Vercel.
2. Set the root directory to `frontend`.
3. Set the Framework Preset to Vite.
4. Modify `frontend/.env.production` and `vercel.json` to replace the placeholder API URL with your newly generated Render backend URL.
5. Deploy the application.

## Licensing

This project is proprietary and intended for municipal infrastructure reporting. All rights reserved.
