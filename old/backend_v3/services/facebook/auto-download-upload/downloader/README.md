# FB Upload Pro - Downloader (Ubuntu VPS Guide)

The downloader service continuously claims pending Facebook reels from Supabase, downloads the video in high quality with audio, and uploads it to Cloudflare R2 storage buffer.

---

## 1. Quick Setup (.env Configuration)

Navigate to the downloader directory on your Ubuntu VPS:

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
```

Create your `.env` file from the template:

```bash
cp .env.example .env
nano .env
```

Fill in your Supabase and Cloudflare R2 credentials:

```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_ADU_BUFFER_BUCKET=fbuploadpro-adu-buffer
```

> **Note:** The `.env` file must be located directly inside the `downloader/` directory (not the repository root).

---

## 2. Run with Docker (Recommended)

Docker is the easiest way to run the service on Ubuntu. It packages Python, FFmpeg, aria2, and Node.js automatically, keeps the downloader running 24/7, and restarts automatically on server reboot.

### Start the Service

Run the one-step startup script:

```bash
chmod +x start.sh
./start.sh
```

*This script installs Docker (if missing), builds the image, launches the container in the background, and tails live logs.*

### Daily Docker Commands

Run these from the `downloader/` directory:

| Action | Command |
| :--- | :--- |
| **View live logs** | `sudo docker compose logs -f` |
| **Check status** | `sudo docker compose ps` |
| **Restart worker** | `sudo docker compose restart` |
| **Stop worker** | `sudo docker compose down` |
| **Update after git pull** | `git pull && sudo docker compose up -d --build` |

---

## 3. Alternative: Run with PM2 (Native Python)

If you prefer running the worker directly on Ubuntu without Docker:

### Step 1: Install System Dependencies

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip ffmpeg aria2 nodejs npm
sudo npm install -g pm2
```

### Step 2: Set Up Python Virtual Environment

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Start with PM2

```bash
# Start background worker
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Enable auto-start on server reboot
pm2 startup
# (Run the exact command that the terminal prints out)
```

### Daily PM2 Commands

Run these from the `downloader/` directory:

| Action | Command |
| :--- | :--- |
| **View live logs** | `pm2 logs fbuploadpro-adu-downloader` |
| **Check status** | `pm2 status` |
| **Restart worker** | `pm2 restart fbuploadpro-adu-downloader` |
| **Stop worker** | `pm2 stop fbuploadpro-adu-downloader` |
| **Update after git pull** | `git pull && source .venv/bin/activate && pip install -r requirements.txt && pm2 restart fbuploadpro-adu-downloader` |

---

## 4. Log Files

In addition to terminal output, rotating logs are saved under `logs/`:

- `logs/adu-downloader.log` — Full operational history
- `logs/adu-downloader.error.log` — Errors and warnings only

To tail errors live:
```bash
tail -f logs/adu-downloader.error.log
```

---

## 5. Troubleshooting Checklist

1. **Process crashes or fails on startup:**
   - Check the logs: `sudo docker compose logs -f` (or `pm2 logs fbuploadpro-adu-downloader`).
   - Verify that `.env` is present in `downloader/.env` and has valid Supabase and R2 keys.
2. **Docker permission denied:**
   - Either run commands with `sudo`, or add your user to the docker group:
     ```bash
     sudo usermod -aG docker $USER
     newgrp docker
     ```
3. **Platform extraction updates:**
   - The Docker container automatically updates `yt-dlp` every time it starts. If Instagram, YouTube, or TikTok change their layout, simply restart the container:
     ```bash
     sudo docker compose restart
     ```
