# In-App Scheduler Posting Service — Technical Architecture & Deep-Dive

This document provides an exhaustive, low-level explanation of the In-App Scheduler posting pipeline. It details the 3-step scheduling and publishing pipeline, database schemas, transactional locking, Meta Graph API publishing flows, error classification logic, and token refund mechanics.

---

## 1. Architectural Overview & Design Rationale

To support high-throughput, conflict-free scheduling and bulletproof execution, the In-App Scheduler uses a **3-Step Pipeline** deployed across **2 Cloudflare Workers**:

```
                       [Cloudflare Cron Trigger]
                                  │ (Every 1 Minute)
                                  ▼
                    ┌───────────────────────────┐
                    │ publish-processor-worker  │
                    ├───────────────────────────┤
                    │ • Triggers Database       │
                    │   Scheduler RPC           │
                    │ • Claims due jobs         │
                    │ • Resets stuck jobs       │
                    │ • Retries R2 deletions    │
                    └─────────────┬─────────────┘
                                  │
                                  ├──────────────────────────────────────┐
                                  │ (Service Binding - HTTP POST)        │ (Service Binding - HTTP POST)
                                  ▼                                      ▼
                    ┌───────────────────────────┐          ┌───────────────────────────┐
                    │     publisher-worker      │          │     publisher-worker      │
                    │        (Thread A)         │          │        (Thread B)         │
                    ├───────────────────────────┤          ├───────────────────────────┤
                    │ • R2 Presigned URLs       │          │ • R2 Presigned URLs       │
                    │ • Text / Image / Video    │          │ • Text / Image / Video    │
                    │ • Post First Comment      │          │ • Post First Comment      │
                    │ • Token Refunds           │          │ • Token Refunds           │
                    └───────────────────────────┘          └───────────────────────────┘
```

### The 3 Steps:
1. **Step 1: The Scheduler (Postgres RPC)**: Calculates page timezone slot times and chronologically maps enqueued posts to due slots. It inserts these ready-to-run tasks as records into `facebook_inapp_schedule_posting_jobs`.
2. **Step 2: The Processor (`publish-processor-worker`)**: A cron-triggered worker that orchestrates execution. It invokes the database scheduler RPC first, claims active pending jobs from the queue, and dispatches them via Cloudflare Service Bindings to the publisher.
3. **Step 3: The Publisher (`publisher-worker`)**: An isolated HTTP-triggered worker that processes exactly one job per request. This isolates long-running video uploads, R2 downloads, and Meta Graph API requests.

---

## 2. Database Schema & Locking Mechanics

### Separation of Concerns
- **`facebook_inapp_schedule_posts`**: Stores static post content (caption, media_object_key, media_type) and the user-definable queue order (`queue_position`). It does not store timezone or schedule state.
- **`facebook_inapp_schedule_posting_jobs`**: The execution queue. Jobs are created dynamically on-the-fly when posting slots become due.

### Table: `facebook_inapp_schedule_posting_jobs`
*   `status`: Transitions through `'pending_publish' -> 'publishing' -> 'published' / 'failed'`.
*   `retry_count` & `transient_retry_count`: Track failed publishing attempts.
*   `last_error_code` & `last_error_message`: Log exact error metadata from Meta or network timeouts.
*   `schedule_slot_at`: The calculated target timestamp for the page's posting slot.
*   `publish_started_at`: Tracks execution start time to detect and recover stuck jobs.

### Atomic Claiming (`claim_due_inapp_posting_jobs`)
To prevent race conditions where multiple processor instances attempt to process the same posting job, claiming uses an atomic transaction with row-level locks:

```sql
CREATE OR REPLACE FUNCTION claim_due_inapp_posting_jobs(p_limit int)
RETURNS TABLE (
  job_id uuid,
  post_id uuid,
  page_id uuid,
  fb_page_id text,
  fb_page_access_token text,
  media_type text,
  media_object_key text,
  caption text,
  first_comment text,
  schedule_slot_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.facebook_inapp_schedule_posting_jobs aj
  SET 
    status = 'publishing',
    publish_started_at = now(),
    updated_at = now()
  FROM (
    SELECT aj2.job_id
    FROM public.facebook_inapp_schedule_posting_jobs aj2
    WHERE aj2.status = 'pending_publish'
      AND aj2.schedule_slot_at <= now()
    ORDER BY aj2.schedule_slot_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) sub
  WHERE aj.job_id = sub.job_id
  RETURNING 
    aj.job_id,
    aj.post_id,
    aj.page_id,
    aj.fb_page_id,
    aj.fb_page_access_token,
    aj.media_type,
    aj.media_object_key,
    aj.caption,
    aj.first_comment,
    aj.schedule_slot_at;
END;
$$;
```
*   `FOR UPDATE`: Places an exclusive write lock on selected job rows.
*   `SKIP LOCKED`: Skips rows currently locked by parallel execution threads.

---

## 3. The Processor Loop (`publish-processor-worker`)

The processor is triggered by Cloudflare Crons once per minute and performs the following tasks:

### 1. Job Generation (Postgres Stored Procedure)
- Executes the database RPC: `create_due_inapp_posting_jobs()`. This function evaluates all configured page posting slots and inserts new jobs into the posting jobs table.

### 2. Releasing Stuck Publishing Jobs
- Scans `facebook_inapp_schedule_posting_jobs` for entries stuck in `'publishing'` status for longer than 5 minutes.
- Resets their status back to `'pending_publish'`, increments the retry counter, and clears the start time.

### 3. Claiming & Dispatching Due Jobs
- Scans the queue via `claim_due_inapp_posting_jobs(claimLimit)` to fetch up to 10 jobs.
- Dispatches each claimed job to the publisher worker using service bindings:
  ```javascript
  const res = await env.PUBLISHER_WORKER.fetch("https://fb-inapp-publisher.internal/internal/v2/process-job", {
    method: "POST",
    headers: { "x-internal-job-dispatch-token": env.INTERNAL_JOB_DISPATCH_TOKEN },
    body: JSON.stringify(job)
  });
  ```

### 4. Cleaning Up Failed R2 Deletions
- Queries `failed_r2_deletions` and attempts to retry deleting orphan files from `fbuploadpro-user-media` R2 storage.

---

## 4. The Publisher Pipeline (`publisher-worker`)

### 1. Memory-Safe R2 Streaming via SigV4 Presigned URLs
Loading large video files directly into Cloudflare Worker memory risks exceeding the 128MB worker limit. Instead, the publisher:
- Generates a presigned S3/R2 GET URL (valid for 1 hour).
- Sends this URL directly to the Meta Graph API (e.g. `file_url`), letting Meta stream the file from R2.

### 2. Publishing Flows by Media Type

#### Text Posts
- Endpoint: `POST https://graph.facebook.com/v19.0/{page_id}/feed`
- Body: `{ message: caption }`

#### Image Posts
- Endpoint: `POST https://graph.facebook.com/v19.0/{page_id}/photos`
- Body: `{ url: presignedR2Url, caption }`

#### Video Reels (Meta Reels Chunked Upload)
1. **Start Phase**: Requests video reels initialization (`upload_phase: "start"`). Returns a `video_id` which is immediately saved as `graph_post_id`.
2. **Upload Phase**: Sends the presigned R2 URL via `rupload` to register the video binary.
3. **Finish Phase**: Finalizes publication (`upload_phase: "finish"`, `video_state: "PUBLISHED"`, `description: caption`).

#### Video Self-Healing & Recovery
If the publisher times out mid-upload, the next retry checks the status of the `video_id`:
- `GET https://graph.facebook.com/v19.0/{video_id}?fields=status`
- If the status is `'ready'` or `'processing'`, the worker skips the upload phase and jumps straight to finalization.

### 3. First Comment Injection
If `first_comment` is defined, the worker posts a comment immediately after the post is published:
- `POST https://graph.facebook.com/v19.0/{graph_post_id}/comments`

### 4. Storage & R2 Clean Up
The moment a post succeeds or fails terminally, the worker calls `env.USER_MEDIA.delete(media_object_key)` to remove the temporary media file from R2.

---

## 5. Meta Error Classification & Page States

Every error returned by the Meta Graph API is run through a classification ruleset to determine if the issue is transient (retryable) or permanent:

| Error Type | Matching Strings | Action Taken |
| :--- | :--- | :--- |
| **Transient Network Error** | `connection reset`, `etimedout`, `fetch failed`, `socket hang up`, `timed out` | Increment `transient_retry_count`. Job status remains `pending_publish`. |
| **Spam Rate Limit (Code 368)** | `we limit how often you can post`, `368` (excluding security blocks) | Set page status to `fb_rate_limited`. Reschedule job. |
| **Security Checkpoint** | `security`, `checkpoint`, `confirm your identity`, `suspended`, `disabled` | Set page status to `fb_verification_required` or `account_suspended`. Terminate job. |
| **Token Expired / Revoked** | Code 190 (`error validating access token`, `session has expired`, `session has been invalidated`) | Set page status to `invalid_token`. Terminate job. **Media is NOT deleted**; user can fix token to resume. |
| **Media File Missing** | `media_object_missing`, `missing_media_object_key` | Set job status to `failed`. Terminate job. |

---

## 6. Token Charging & Automatic Refunds

Users are charged posting tokens upfront. If a job fails terminally:
1. The publisher verifies if tokens were charged (`tokens_charged > 0`).
2. Restores user balance (`tokens_balance = tokens_balance + tokens_charged`).
3. Appends a transaction log in `token_transactions` with `transaction_type = 'refund'`.
4. Sets `tokens_charged = 0` on the post record to prevent duplicate refunds.
