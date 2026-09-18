<div align="center">
  <img src="ShehriAILogo.jpg" alt="ShehriAI Logo" width="220" style="border-radius: 20px; margin-bottom: 20px;" />
</div>

# ShehriAI — Smart Civic Monitoring

ShehriAI is an AI-powered civic infrastructure monitoring platform designed to instantly detect, report, and map urban issues like potholes and uncollected garbage. By combining edge-AI object detection with live mapping, ShehriAI empowers citizens to help local authorities (like the CDA) maintain safer and cleaner streets.

## 🌟 Features

- **Dual-Model AI Detection:** The backend runs *two* YOLOv8 models simultaneously. Upload a photo, and it will scan for both Infrastructure Damage (Potholes) and Waste (12 categories of Garbage), dynamically highlighting the primary issue with a color-coded bounding box.
- **Smart Geocoding:** Automatically extracts exact GPS coordinates from the photo's EXIF data. If none exists, it gracefully falls back to the user's current device location.
- **Reverse Geocoding:** Converts raw latitude and longitude coordinates into human-readable street addresses using the OpenStreetMap Nominatim API.
- **Live Interactive Heatmap:** A real-time heatmap (powered by Leaflet) mapping all reported issues across the city, strictly bounded to the Islamabad Capital Territory.
- **Premium UI/UX:** Built with React and TailwindCSS, featuring smooth glassmorphism, responsive bento grids, micro-animations, and a highly polished bottom navigation dock.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React + Vite
- **Styling:** TailwindCSS (with custom animations and glassmorphism)
- **Maps:** Leaflet & React-Leaflet (`leaflet.heat` with CartoDB/OSM tiles)
- **Icons:** Lucide React

### Backend
- **Framework:** FastAPI (Python)
- **AI/ML:** Ultralytics YOLOv8 (PyTorch)
- **Database:** Firebase Firestore
- **Image Processing:** OpenCV (`cv2`), Pillow, `exifread`

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- Python 3.9+
- YOLOv8 model weights for both Potholes and Garbage.

### 1. Backend Setup

1. Navigate to the project root.
2. Activate your virtual environment:
   ```bash
   source shehri_env/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Place your Firebase credentials at `backend/config/firebase_credentials.json`.
5. Place your YOLOv8 model weights at `backend/models/pothole_best.pt` and `backend/models/garbage_best.pt`.
6. Start the FastAPI server:
   ```bash
   cd backend
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. *(Optional)* Configure the API URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 3. Usage
- Open `http://localhost:5173` in your browser.
- Use the **Scanner** tab to upload an image of a pothole or garbage.
- Review the generated AI **Report** and forward it to local authorities (`cdacares@cda.gov.pk`).
- View the **Heatmap** to see the newly generated report live on the city grid.

---

## 🌍 Deployment (Vercel & Monorepo)

ShehriAI is configured out-of-the-box for a split deployment architecture to handle the heavy machine-learning backend while keeping the frontend lightning fast on the edge.

1. **Backend (Render / Railway / Fly.io)**: 
   Because the dual YOLOv8 PyTorch models exceed Vercel's serverless function limits (250MB size & memory constraints), deploy the `backend/` directory as a standard web service on a provider like Render.
2. **Frontend (Vercel)**:
   - Push this entire repository to GitHub.
   - Import the repository into Vercel.
   - Vercel will automatically read the `vercel.json` file in the root directory.
   - It will build the `frontend` folder (`@vercel/static-build`) and route all API calls (e.g. `/api/*`) directly to your external backend.
   - **Crucial Step:** Open `vercel.json` and change the `"dest"` URL for the API route to point to your live backend domain (e.g., `https://your-backend.onrender.com/api/$1`).

---

## 📝 License & Author

Made with ❤️ by [Wasiq](https://wasiq.tech).
