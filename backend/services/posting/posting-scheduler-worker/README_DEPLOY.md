# 🚀 How to Deploy the Cron Service (Cloudflare Worker)

## 1. Prerequisites
- **Node.js** installed.
- **Wrangler** installed (`npm install -g wrangler`).
- A **Cloudflare** account.

## 2. Setup
1.  **Install Dependencies**:
    ```bash
    cd backend/services/posting/posting-scheduler-worker
    npm install
    ```

2.  **Login to Cloudflare**:
    ```bash
    wrangler login
    ```

## 3. Configuration (`wrangler.toml`)
Update `backend/services/posting/posting-scheduler-worker/wrangler.toml` (or set these in Cloudflare Dashboard > Settings > Variables):

*   `SUPABASE_URL`: Your Supabase Project URL.
*   `POSTING_QUEUE`: Cloudflare Queue producer binding for `fbuploadprov2-prod-posting-download-jobs`.
*   `SUPABASE_SERVICE_ROLE_KEY`: **SECRET!** Do not commit. Run:
    ```bash
    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    ```

## 4. Deploy
Run the deploy command:
```bash
npm run deploy
```

## 5. Verify
Go to Cloudflare Dashboard > Workers > `fbuploadprov2-prod-posting-01-scheduler` > **Triggers**.
Confirm that the Cron Trigger is active (e.g., `* * * * *` for every minute).
