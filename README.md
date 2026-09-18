# ShehriAI — Smart Civic Monitoring

ShehriAI is an AI-powered civic infrastructure monitoring platform designed to instantly detect, report, and map urban issues like potholes and damaged utilities. By combining edge-AI object detection with live mapping, ShehriAI empowers citizens to help local authorities (like the CDA) maintain safer streets.

## 🌟 Features

- **AI Damage Detection:** Upload or snap a photo, and the backend YOLOv8 model will instantly scan it to identify civic issues (e.g., Potholes) and assign a severity score.
- **Smart Geocoding:** Automatically extracts exact GPS coordinates from the photo's EXIF data. If none exists, it gracefully falls back to the user's current device location.
- **Reverse Geocoding:** Converts raw latitude and longitude coordinates into human-readable street addresses using the OpenStreetMap Nominatim API.
- **Live Interactive Heatmap:** A real-time heatmap (powered by Leaflet) mapping all reported issues across the city, grouped by category and severity. 
- **Premium UI/UX:** Built with React and TailwindCSS, featuring smooth glassmorphism, responsive bento grids, micro-animations, and a highly polished bottom navigation dock.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React + Vite
- **Styling:** TailwindCSS (with custom animations and glassmorphism)
- **Maps:** Leaflet & React-Leaflet (`leaflet.heat` for heatmap layers)
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **AI/ML:** Ultralytics YOLOv8 (PyTorch)
- **Database:** Firebase Firestore
- **Image Processing:** OpenCV (`cv2`), Pillow, `exifread`

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.9+
- YOLOv8 model weights (`best.pt`)

### 1. Backend Setup

1. Navigate to the backend directory or project root.
2. Activate your virtual environment:
   ```bash
   source shehri_env/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install fastapi uvicorn ultralytics opencv-python firebase-admin exifread python-multipart
   ```
4. Place your Firebase credentials at `backend/config/firebase_credentials.json`.
5. Place your YOLOv8 model weights at `backend/assets/weights/best.pt`.
6. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   *(Ensure you run this from inside the `backend/` directory).*

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 3. Usage
- Open `http://localhost:5173` in your browser.
- Use the **Scanner** tab to upload an image of a pothole.
- Review the generated AI **Report** and forward it to local authorities.
- View the **Heatmap** to see the newly generated report live on the city grid.

---

## 📝 License & Author

Made with ❤️ by [Wasiq](https://wasiq.tech).
