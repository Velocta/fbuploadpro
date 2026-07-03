FROM python:3.11-slim

# Install system dependencies including ffmpeg, aria2, nodejs for yt-dlp signature processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    aria2 \
    nodejs \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

COPY . .

# Create cache and log directories
RUN mkdir -p cache logs

# Set environment variables for cache and log paths to resolve under /app
ENV ADU_DOWNLOADER_CACHE_DIR=/app/cache
ENV ADU_DOWNLOADER_LOG_DIR=/app/logs

# Set entrypoint to run updates on startup
ENTRYPOINT ["./entrypoint.sh"]

# Run the worker script
CMD ["python", "worker.py"]
