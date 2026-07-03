# ADU buffer downloader (VPS)

Pre-downloads reels into R2 (`fbuploadpro-adu-buffer`) so the posting scheduler can publish without a download phase.

## Requirements

- Python 3.11+
- **Node.js** on PATH (yt-dlp `--js-runtimes node` for YouTube JS challenges; required since yt-dlp EJS)
- `yt-dlp` (via `requirements.txt`, includes curl-cffi for `--impersonate chrome`), `ffmpeg`, `aria2c` on PATH
- Supabase service role + R2 S3 API credentials

## Setup

Linux quick start (see **PM2** section for Windows, reboot persistence, and deploy):

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill values — must live in this `downloader/` folder
```

The worker loads **`downloader/.env` automatically** via `python-dotenv` in `config.py` (same path on Linux and Windows). You do not need to export variables in the shell or rely on PM2 to inject them.

Apply the ADU buffer migration (`20260605120000_adu_buffer_claim_improvements.sql`) and source circuit breaker (`20260606140000_adu_downloader_source_circuit_breaker.sql`) before running the worker. For fair buffer claims and the claim-empty deadlock fix, also apply `20260606160000_adu_buffer_level_fair_claim.sql` and `20260606170000_adu_buffer_skip_unclaimable_hungry_pages.sql`. Apply `20260606190000_adu_reel_publishing_status.sql` so posting uses `publishing` on reels (downloader keeps `processing`).

**One-time reel re-queue** (`20260606180000_adu_requeue_stuck_reels_one_time.sql`): pauses are recommended — stop the downloader, run the migration in Supabase, then restart. It moves all `failed`, `download_failed`, and `processing` reels on active synced pages back to `pending` (resets download retries and clears stale media metadata).

## Run

```bash
python worker.py
```

The worker keeps a **persistent thread pool** at `ADU_DOWNLOADER_CONCURRENCY`. Each loop iteration:

1. **`reset_stale_adu_reel_downloads`** — reels in `processing` longer than `ADU_DOWNLOADER_STALE_MINUTES` (default 40) return to `pending`
2. If downloads are **in flight**, wait up to **`ADU_DOWNLOADER_IN_FLIGHT_POLL_SECONDS`** (default 20) for at least one to finish, then drain completed jobs
3. **`claim_adu_buffer_downloads(free_slots)`** — top up the pool, where `free_slots = concurrency − in-flight downloads`
4. Sleep **60 seconds** only when nothing is in flight and claim returned zero rows

### Logs (console + files)

The worker logs to **stdout** and to rotating files under `downloader/logs/` (same on Linux and Windows):

| File | Levels | Purpose |
|------|--------|---------|
| `adu-downloader.log` | INFO+ | Full operational history |
| `adu-downloader.error.log` | WARNING+ | Failures and retries only |

Files rotate at **10 MiB** (keeps 5 backups). Override with `ADU_DOWNLOADER_LOG_DIR`, `ADU_DOWNLOADER_LOG_MAX_BYTES`, `ADU_DOWNLOADER_LOG_BACKUP_COUNT` in `.env`.

```bash
# Linux
tail -f logs/adu-downloader.error.log

# Windows PowerShell
Get-Content logs\adu-downloader.error.log -Wait
```

`pm2 logs` still shows stdout; use the files above for persisted warnings/errors after restart.

### Claim rules (Postgres RPC)

- Pages must be **`status = active`**, **`sync_status = synced`**, and `posts_per_day > 0` (aligned with the posting scheduler)
- **Source circuit breaker (24h rolling):** pages with **>7** `download_failed` reels in the last 24 hours are skipped; **>30** failures sets page `status = creator_suspended` (source creator unavailable — not the same as Facebook `account_suspended`)
- Buffer target per page: **`posts_per_day × 1`**, counting reels in **`downloaded`** or **`processing`** (downloader in-flight only)
- **Reel statuses:** `processing` = downloading; `publishing` = scheduled or actively posting; do not mix the two
- **Level-fair claims:** only pages at the minimum `buffer_filled` among hungry pages; max one pending reel per page per batch; `random()` tie-break. Hungry pages with **no claimable pending** reels are excluded so they cannot pin `min_level`
- Claimed reels move to **`processing`** with `download_claimed_at = now()`
- Failed downloads reset to **`pending`** (or **`download_failed`** after 3 claims)

**Defaults (tuned for ~8 GB RAM VPS, 30 parallel reels):**

| Setting | Default | Purpose |
|---------|---------|---------|
| `ADU_DOWNLOADER_CONCURRENCY` | 30 | Max parallel reel jobs |
| `ADU_DOWNLOADER_IN_FLIGHT_POLL_SECONDS` | 20 | Wait for in-flight jobs before topping up claims |
| `ADU_DOWNLOADER_STALE_MINUTES` | 40 | Stuck `processing` → `pending` |
| `ADU_ARIA2_MAX_CONNECTION` / `ADU_ARIA2_SPLIT` | 4 | aria2 connections per file |
| `ADU_R2_UPLOAD_CHUNK_BYTES` | 8 MiB | Stream uploads; ~8 MB RAM per upload |
| `ADU_DOWNLOADER_LOG_DIR` | `downloader/logs/` | Rotating log files |
| `ADU_DOWNLOADER_JS_RUNTIME` | `node` | yt-dlp JS runtime (`node`, `deno`, or `node:/path/to/node`) |

Each claimed reel gets up to **4** in-process download attempts before `mark_adu_reel_download_failed`; that is separate from the DB `download_retries` column (max **3** claims before `download_failed`).

### Resilience (network + cache)

- **Supabase RPC retries** — `claim`, `mark_downloaded`, and `mark_download_failed` retry on transient `httpx`/socket errors (exponential backoff; see `ADU_DOWNLOADER_RPC_RETRIES`).
- **Thread-local Supabase clients** — one client per worker thread (avoids shared-socket issues on Windows).
- **Local disk cache** — after a successful download, media is stored under `downloader/cache/` as `{reel_id}.mp4` (+ `.caption`). Upload/DB failures reuse the cache on the next claim; cache is deleted only after `mark_adu_reel_downloaded` succeeds.
- **Worker task isolation** — a failed in-flight job is logged and does not stop the main loop.

### Proxies (optional)

| Variable | Platforms | Used for |
|----------|-----------|----------|
| `RESIDENTIAL_PROXY` | YouTube | Full yt-dlp download |
| `DATACENTER_PROXY` | Instagram | yt-dlp metadata / URL resolution only; CDN fetch via aria2 is direct |
| `DATACENTER_PROXY` | TikTok, Facebook | Full yt-dlp download |

If a proxy env var is unset, that step runs without a proxy. Only Instagram uses metadata + aria2; TikTok and Facebook always download through yt-dlp (Facebook may use generic extractor fallback).

**Capacity notes:** Parallel jobs need disk under `/tmp` (Linux) or `%TEMP%` (Windows) for temp files (often 30–100 MB each while downloading). If RAM is tight, lower concurrency or chunk size.

## Docker (Recommended for Production & Debian VPS)

Using Docker is the recommended way to run the downloader in production. It packages python, ffmpeg, aria2, and Node.js automatically, and manages background execution with automatic restarts (even after server reboot) similar to PM2.

### 1. Setup & Run

Simply run the startup script:

```bash
chmod +x start.sh
./start.sh
```

This script will:
- Check for and install Docker & Docker Compose if missing (Debian/Ubuntu systems).
- Create a `.env` file from `.env.example` if it doesn't exist.
- Start the container in detached mode (background).
- Enable Docker to start automatically on system boot.

> [!NOTE]
> The container uses an `entrypoint.sh` wrapper that automatically runs `pip install -U "yt-dlp[default,curl-cffi]"` on startup. This guarantees that your container always runs the absolute latest release of `yt-dlp` (including all TLS-impersonation features) every time the container is started or restarted, without requiring you to manually rebuild the Docker image when platforms update their video extraction code.


### 2. Management Commands

```bash
# View live logs (stdout/stderr of the worker)
sudo docker compose logs -f

# Check container status
sudo docker compose ps

# Restart the downloader (after config changes)
sudo docker compose restart

# Stop the downloader
sudo docker compose down
```

## PM2 (keep the worker running)

[PM2](https://pm2.keymetrics.io/) is a process manager: it runs `worker.py` in the background, restarts it on crash, and (with extra setup) brings it back after a server reboot.

`ecosystem.config.cjs` starts one app:

| Setting | Value |
|---------|--------|
| Name | `fbuploadpro-adu-downloader` |
| Script | `worker.py` |
| Python | `.venv` interpreter if present, else `python3` (Linux) / `python` (Windows) |
| Env | `downloader/.env` loaded by Python (`config.py` → `python-dotenv`) |
| Restart | `autorestart: true`, `max_restarts: 20` |

### 1. Install PM2

**Linux (VPS — recommended for production)**

```bash
# Node.js 20+ (pick one)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Or: sudo apt install nodejs npm   (distro package)

sudo npm install -g pm2
pm2 -v
```

**Windows (dev or small host)**

1. Install [Node.js LTS](https://nodejs.org/) (includes npm).
2. Open **PowerShell** or **cmd** as a normal user:

```powershell
npm install -g pm2
pm2 -v
```

On Windows, run PM2 commands from the same shell type you used to install it (PowerShell is fine).

### 2. System tools (before PM2)

**Linux**

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv ffmpeg aria2 nodejs
```

Fedora/RHEL: `sudo dnf install python3 ffmpeg aria2 nodejs`

**Windows**

- Install [Python 3.11+](https://www.python.org/downloads/) — check **Add python.exe to PATH**.
- Install ffmpeg and aria2 and add them to PATH, e.g.:

```powershell
winget install Gyan.FFmpeg
winget install aria2.aria2
winget install OpenJS.NodeJS.LTS
```

(Or use Chocolatey / manual downloads; `node`, `ffmpeg`, `aria2c`, and `yt-dlp` must work in a new terminal.)

### 3. Python app setup (both platforms)

From the repo root, `cd` into this folder:

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
```

**Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit with real credentials
```

**Windows (PowerShell)**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # edit with real credentials
```

Apply migration `20260605120000_adu_buffer_claim_improvements.sql` on Supabase before starting the worker.

Smoke-test once in the foreground (Ctrl+C to stop):

```bash
python worker.py
```

### 4. Start with PM2

Run from **`downloader/`** (where `ecosystem.config.cjs` lives):

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs fbuploadpro-adu-downloader
```

What each command does:

- **`pm2 start ecosystem.config.cjs`** — reads the config and starts `worker.py` under the name `fbuploadpro-adu-downloader`.
- **`pm2 status`** — shows running/stopped apps, CPU, memory, restarts.
- **`pm2 logs …`** — tails stdout/stderr (download errors, claim counts).

### 5. Survive reboot

**`pm2 save`** writes the current process list to `~/.pm2/dump.pm2` so PM2 can restore it later. It does **not** by itself start PM2 on boot — you need a startup hook once per machine.

**Linux**

```bash
pm2 save
pm2 startup
# Run the command PM2 prints (usually sudo env PATH=... pm2 startup systemd -u YOUR_USER --hp /home/YOUR_USER)
pm2 save
```

After reboot: `pm2 status` should show `fbuploadpro-adu-downloader` online.

**Windows**

Native `pm2 startup` is limited on Windows. Common options:

1. **Task Scheduler** — trigger `pm2 resurrect` at logon (after `pm2 save` once while the app is running).
2. **`pm2-windows-startup`** (community helper):

```powershell
npm install -g pm2-windows-startup
pm2-startup install
pm2 save
```

Or run PM2 manually after reboot for dev machines.

### 6. Day-to-day commands

```bash
pm2 restart fbuploadpro-adu-downloader   # after git pull / .env change
pm2 stop fbuploadpro-adu-downloader
pm2 delete fbuploadpro-adu-downloader    # remove from PM2 list
pm2 save                               # persist list after stop/delete/start changes
```

Deploy update (Linux example):

```bash
cd backend_v3/services/facebook/auto-download-upload/downloader
git pull
source .venv/bin/activate && pip install -r requirements.txt
pm2 restart fbuploadpro-adu-downloader
```

Windows: use `.\.venv\Scripts\Activate.ps1` instead of `source`.

### 7. Troubleshooting

| Symptom | Check |
|---------|--------|
| App `errored` / rapid restarts | `pm2 logs fbuploadpro-adu-downloader --lines 100` — missing `.env`, Supabase/R2 creds, or migration not applied |
| `SUPABASE_URL` / env missing | `.env` must be **`downloader/.env`** (same folder as `worker.py`), not repo root; run `pip install -r requirements.txt` after pull |
| `yt-dlp` / impersonate errors | `pip install -r requirements.txt` in `.venv`; `yt-dlp --list-impersonate-targets` |
| YouTube “not available” / no formats | Install **Node.js** on PATH; verify `node --version` and `yt-dlp --js-runtimes node -F 'https://www.youtube.com/shorts/…'` |
| `ffmpeg` / `aria2c` not found | Install system binaries and ensure they are on PATH for the PM2 user |
| `node` not found | Install Node.js; optional override `ADU_DOWNLOADER_JS_RUNTIME=node:/full/path/to/node` |
| Wrong Python | PM2 uses `.venv/bin/python` (Linux) or `.venv\Scripts\python.exe` (Windows) when the venv exists |
| Changes not picked up | `pm2 restart fbuploadpro-adu-downloader` after code or `.env` edits |
