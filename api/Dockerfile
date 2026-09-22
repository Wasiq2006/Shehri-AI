FROM python:3.10-slim

# Install curl to download models
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip uninstall -y opencv-python && \
    pip install --no-cache-dir --force-reinstall opencv-python-headless

# Copy application source code
COPY . .

# Download YOLO model weights at build time from HuggingFace
# (Models are gitignored and cannot be committed to the repo)
RUN mkdir -p models && \
    echo "Downloading pothole model..." && \
    curl -L -o models/pothole_best.pt \
      "https://huggingface.co/peterhdd/pothole-detection-yolov8/resolve/main/best.pt" && \
    echo "Downloading garbage model..." && \
    curl -L -o models/garbage_best.pt \
      "https://huggingface.co/kendrickfff/waste-classification-yolov8-ken/resolve/main/yolov8n-waste-12cls-best.pt" && \
    echo "Models downloaded successfully."

# Expose Render's required port
EXPOSE 10000

# Start the server using Uvicorn on the cloud provider's required port
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"
