# Hosting the Cron Worker on Cloudflare

This service polls the database every minute to find pages that are due for a social media post.

## Prerequisite
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated.

## Deployment Steps

1.  **Configure Environment Variables**:
    Open `wrangler.toml` and set your variables:
    -   `SUPABASE_URL`: Your Supabase Project URL.
    -   `POSTING_QUEUE`: Queue producer binding pointing to `fbuploadprov2-prod-posting-download-jobs`.

2.  **Add Secrets**:
    Run the following command to securely add your Supabase Service Role Key:
    ```bash
    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    ```

3.  **Deploy**:
    Deploy the worker with the cron trigger:
    ```bash
    wrangler deploy
    ```

## Verification
-   Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
-   Navigate to **Workers & Pages** -> **fbuploadprov2-prod-posting-01-scheduler**.
-   Check the **Triggers** tab; you should see the `* * * * *` (every minute) cron schedule.
-   Check the **Logs** to see the "Checking for due posts..." messages every minute.

## Troubleshooting
-   **No triggers happening**: Ensure your Cloudflare account is in good standing and you have not reached the free tier limits.
-   **RPC Errors**: Ensure the `get_pages_due_posting` function is correctly deployed to your Supabase instance.
