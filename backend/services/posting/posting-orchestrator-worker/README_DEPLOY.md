# 🚀 How to Deploy the Orchestrator (Cloudflare Worker)

## 1. Setup
1.  **Install Dependencies**:
    ```bash
    cd backend/services/posting/posting-orchestrator-worker
    npm install
    ```

## 2. Configuration (`wrangler.toml`)
Update `backend/services/posting/posting-orchestrator-worker/wrangler.toml`:

*   `SUPABASE_URL`: Your Supabase Project URL.
*   Durable Object binding: `POSTING_PUBLISH_STATE_DO` (configured in `wrangler.toml` migrations).
*   `PUBLISH_CALLBACK_TOKEN`: Shared secret expected from `downloader-queue-worker`.
*   `SUPABASE_SERVICE_ROLE_KEY`: **SECRET!**
    ```bash
    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    ```
    ```bash
    wrangler secret put PUBLISH_CALLBACK_TOKEN
    ```

## 3. Deploy
First, log in to your Cloudflare account (only needed once):
```bash
npx wrangler login
```
It will open your browser to authorizenp.

Then run:
```bash
npm run deploy
```

## 4. Get the URL
After deployment, Cloudflare will give you a URL (e.g., `https://fbuploadprov2-prod-posting-03-publisher.your-user.workers.dev`).
Bind this worker to `downloader-queue-worker` via service binding `PUBLISHER` in `backend/services/media/downloader-queue-worker/wrangler.toml`.

---

## Option B: Deploy via Cloudflare Dashboard (UI Mode)

If you prefer using the browser instead of the command line:

### 1. Create the Worker
1.  Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2.  Go to **Workers & Pages**.
3.  Click **Create Application** -> **Create Worker**.
4.  Name it (e.g., `fbuploadprov2-prod-posting-03-publisher`) and click **Deploy** (this deploys a "Hello World" placeholder first).

### 2. Update the Code
1.  Click **Edit Code**.
2.  Delete the default `worker.js` content.
3.  Copy everything from your `backend/services/posting/posting-orchestrator-worker/src/index.js` file on your computer.
4.  Paste it into the Cloudflare Editor.
5.  Click **Save and Deploy**.

### 3. Set Environment Variables
The code won't work yet because it needs your secrets.

1.  Go back to the Worker's **Settings** tab (exit the editor).
2.  Go to **Variables and Secrets**.
3.  Click **Add** for each of these:

| Variable | Value Meaning | Encryption |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) | Text |
| `PUBLISH_CALLBACK_TOKEN` | Shared secret required for `/publish-callback` | **Encrypt** |
| `SUPABASE_SERVICE_ROLE_KEY` | Your **Service Role** Secret (starts with `ey...`) | **Encrypt** |

4.  Click **Deploy** again (sometimes needed to apply secrets) or wait a moment.

Your Orchestrator is now live! Copy the URL from the dashboard.
