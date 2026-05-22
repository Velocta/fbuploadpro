# Multi-Platform Reels Scraper Service

This service scrapes short-form content IDs for registered pages and syncs them to the Supabase database.

## Architecture

The scraper is built with **Node.js**, **Puppeteer**, and **Supabase**. It operates as a persistent daemon that continuously polls for pending jobs.

### Core Workflow (`index.js`)

The orchestrator (`index.js`) manages the entire lifecycle:

1.  **Browser Management**:
    *   Launches a Puppeteer browser instance with specific flags (`--no-sandbox`, `--disable-setuid-sandbox`) for Linux/Docker compatibility.
    *   Automatically restarts the browser after processing 50 jobs to prevent memory leaks.

2.  **Job Polling Strategy**:
    *   It runs an infinite loop.
    *   Calls the Supabase RPC function `get_next_pending_page` to atomically fetch **and lock** the next available page (sets `sync_status = 'processing'`).
    *   If no pages are pending, it sleeps for 10 seconds before retrying.

3.  **Scraping Process**:
    *   Supports `instagram`, `tiktok`, `youtube`, and `facebook`.
    *   On startup, it opens each platform login page and waits for manual login confirmation.
    *   Uses a persistent browser profile (`BROWSER_USER_DATA_DIR`) so sessions are reused after restart.
    *   For Facebook jobs, `source_username` is treated as a username ID and navigated as `https://facebook.com/{username}/reels`.
    *   Facebook extraction uses reel tile anchors and stores only IDs from `/reel/{id}/...` href paths.

4.  **Data Synchronization**:
    *   **Success**:
        *   The scraped Reel URLs are parsed to extract `reel_id`.
        *   New reels are inserted into the `public.reels` table using `upsert` (ignoring duplicates).
        *   The page's `sync_status` is updated to `'synced'`.
    *   **No Data / Error**:
        *   If 0 reels are found, the scraper verifies if the session is still valid.
        *   **Valid Session**: Marks `sync_status = 'error'` (likely private profile or empty).
        *   **Invalid Session**: Marks `sync_status = 'pending'` (so it can be retried) and **exits the process** with code 1. This forces the external process manager (like Docker or PM2) to restart the container, which helps clear deep browser states.

### Configuration (`config.js`)

Environment variables are loaded via `dotenv`.

*   **SUPABASE_URL**: Project URL.
*   **SUPABASE_SERVICE_ROLE_KEY**: Admin key (required to bypass RLS for background jobs).
*   **BROWSER_USER_DATA_DIR**: Path for persistent Puppeteer session data.
*   **MAX_REELS_PER_PLATFORM**: Per-platform cap (default: `1000`).
*   `INSTAGRAM_USERNAME`/`INSTAGRAM_PASSWORD` can still be set, but startup login is manual for all platforms.

### Database Interaction (`db.js`)

*   Uses `@supabase/supabase-js`.
*   Directly interacts with `public.pages` and `public.reels`.
*   Relying on the `get_next_pending_page` RPC function is critical for concurrency control, ensuring that if multiple scraper instances were running, they wouldn't grab the same page.

## Running Locally

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Setup Environment:
    ```bash
    cp .env.example .env
    # Edit .env with your credentials
    ```

3.  Start the Scraper:
    ```bash
    npm start
    ```

## Windows Installation & Usage

To run this scraper on Windows, you will need the following prerequisites installed:

1.  **Node.js**: Download and install the LTS version from [nodejs.org](https://nodejs.org/). This includes `npm`.
2.  **Git**: Download and install from [git-scm.com](https://git-scm.com/).
3.  **Command Prompt / PowerShell**: You will use this to run commands.

### Steps for Windows Users

1.  **Open PowerShell or Command Prompt**.
2.  **Clone the repository** (if you haven't already):
    ```powershell
    git clone <your-repo-url>
    cd SaaS-website/scraper
    ```
3.  **Install Dependencies**:
    ```powershell
    npm install
    ```
    *Note: The Puppeteer installation will automatically download a local version of Chrome/Chromium compatible with Windows.*

4.  **Configure Environment**:
    *   Create a copy of the example file:
        ```powershell
        copy .env.example .env
        ```
    *   Open `.env` in Notepad or VS Code and fill in your details:
        *   `INSTAGRAM_USERNAME=...`
        *   `INSTAGRAM_PASSWORD=...`
        *   `SUPABASE_URL=...`
        *   `SUPABASE_SERVICE_ROLE_KEY=...`

5.  **Run the Scraper**:
    ```powershell
    npm start
    ```
    You should see the "🚀 Starting Instagram scraper orchestrator..." message. The browser window may pop up visibly since `headless: false` is set in the code.

## Deploying

This service is designed to be containerized. The `Dockerfile` (located in parent directories) should ensure all Puppeteer dependencies (Chrome libraries) are installed.