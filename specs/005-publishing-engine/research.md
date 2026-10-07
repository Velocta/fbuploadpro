# Research & Architecture Decisions: Automated Queue Slots Publishing Engine

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](spec.md)

This document details the architectural choices, protocol specs, concurrency strategies, and financial integrity designs for Spec 005.

---

## 1. Edge Dispatcher Scheduling Architecture

### Context & Problem
We need to execute scheduled posts for hundreds of Facebook Pages at precise daily slot times. Traditional solutions often rely on heavyweight external queues (e.g., Celery, BullMQ, AWS SQS) or dedicated polling servers, introducing operational complexity and single points of failure.

### Evaluated Alternatives
1. **Alternative A: BullMQ with Redis + Dedicated Long-Running Node Daemon**:
   - *Pros*: Built-in delayed job semantics.
   - *Cons*: Requires running and maintaining a Redis cluster; violates the serverless edge worker architecture; complicates multi-tenant isolation.
2. **Alternative B: Cloudflare Queues**:
   - *Pros*: Cloudflare-native.
   - *Cons*: Delayed messages are limited (max 4 days); message scheduling cannot be dynamically reorganized, edited, or skipped from the relational database without complex ghost-message handling.
3. **Alternative C (Chosen): Cloudflare Worker Edge Cron + PostgreSQL `FOR UPDATE SKIP LOCKED`**:
   - *Pros*: Relational database remains the single source of truth; recurring slots, edits, reordering, and cancellations are instant relational updates; PostgreSQL row-level locks natively eliminate double-publishing; Cloudflare Worker cron trigger runs every minute at the global edge.

### Resolution
Use a Cloudflare Worker cron trigger (`* * * * *`) in `apps/worker` that claims due rows using `SELECT ... FOR UPDATE SKIP LOCKED`, transitions status to `publishing`, dispatches the media to Facebook, and settles the transaction.

---

## 2. High-Concurrency Locking & State Transitions

### Lock Semantics
To prevent duplicate publishing under high worker concurrency:
```sql
BEGIN;
SELECT id, user_id, fb_page_id, media_id, caption, first_comment, retry_count
FROM queue_items
WHERE status = 'queued'
  AND scheduled_time <= now()
ORDER BY scheduled_time ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;

UPDATE queue_items
SET status = 'publishing', updated_at = now()
WHERE id = ANY($claimed_ids);
COMMIT;
```
- Multiple worker isolates executing simultaneously will each grab non-overlapping batches.
- If all due rows are claimed, subsequent workers immediately exit with 0 claimed rows, preventing redundant workloads.

### Queue Item Lifecycle
```text
[Draft/Selection]
       │
       ▼
    queued (scheduled_time set, slot claimed)
       │
       ▼ (Edge Cron claim with FOR UPDATE SKIP LOCKED)
   publishing
       ├──► (Facebook API Success) ──► published (1 token deducted, post_id saved)
       │                                     │
       │                                     ▼ (Optional First Comment)
       │                              commented (comment_id saved)
       │
       └──► (Facebook API Failure)
              ├── [Transient Error & retry_count < 3] ──► queued (backoff scheduled)
              └── [Fatal Error OR retry_count >= 3]   ──► failed (0 tokens deducted, error logged)
```

---

## 3. Facebook Graph API v26.0 Publishing Protocol

### Short-Form Video / Reels Publishing
Facebook Reels publishing follows a 3-step session protocol:
1. **Start Upload Session**:
   ```http
   POST https://graph.facebook.com/v26.0/{page_id}/video_reels
   Authorization: Bearer {page_access_token}
   Content-Type: application/json

   { "upload_phase": "start" }
   ```
   *Response*: `{ "video_id": "123456789", "upload_url": "https://rupload.facebook.com/video-reels/..." }`

2. **Stream Video Binary**:
   Stream video bytes fetched from Cloudflare R2 presigned URL directly to `upload_url`:
   ```http
   POST {upload_url}
   Authorization: OAuth {page_access_token}
   Offset: 0
   Content-Type: application/octet-stream
   ```

3. **Finish & Publish**:
   ```http
   POST https://graph.facebook.com/v26.0/{page_id}/video_reels
   Authorization: Bearer {page_access_token}
   Content-Type: application/json

   {
     "upload_phase": "finish",
     "video_state": "PUBLISHED",
     "description": "{caption}",
     "video_id": "123456789"
   }
   ```
   *Response*: `{ "success": true, "post_id": "{page_id}_{post_id}" }`

### Photos Publishing
Direct single-request photo publication:
```http
POST https://graph.facebook.com/v26.0/{page_id}/photos
Authorization: Bearer {page_access_token}
Content-Type: application/json

{
  "url": "{r2_public_media_url}",
  "caption": "{caption}",
  "published": true
}
```
*Response*: `{ "id": "photo_id", "post_id": "{page_id}_{photo_id}" }`

### Automated First Comment
Published immediately upon obtaining `post_id`:
```http
POST https://graph.facebook.com/v26.0/{post_id}/comments
Authorization: Bearer {page_access_token}
Content-Type: application/json

{
  "message": "{first_comment_text}"
}
```
*Response*: `{ "id": "comment_id" }`

---

## 4. Token Ledger Integrity & Atomic Accounting

### Invariant
- **Rule**: Tokens are deducted strictly upon verified post publication to Facebook Graph API.
- **Cost**: 1 token per successfully published post.
- **Failures**: 0 tokens deducted if publication fails or is aborted.
- **First Comment Failure**: If the post succeeds but first comment fails, the post remains `published` and 1 token is deducted. The comment error is recorded in `publish_logs` with a warning status.

### Transaction Flow
```typescript
await db.withTransaction(async (tx) => {
  // 1. Decrement user balance atomically (enforces balance >= 1)
  await tx.query(
    `UPDATE users SET tokens_balance = tokens_balance - 1, updated_at = now() WHERE id = $1 AND tokens_balance >= 1`,
    [userId]
  );

  // 2. Insert immutable audit ledger record
  await tx.query(
    `INSERT INTO token_transactions (user_id, amount, transaction_type, reference_id, description)
     VALUES ($1, 1, 'debit', $2, $3)`,
    [userId, queueItemId, `Published post to Facebook Page ${pageName}`]
  );

  // 3. Mark queue item published
  await tx.query(
    `UPDATE queue_items
     SET status = 'published', fb_post_id = $2, published_at = now(), updated_at = now()
     WHERE id = $1`,
    [queueItemId, fbPostId]
  );

  // 4. Record execution log
  await tx.query(
    `INSERT INTO publish_logs (user_id, queue_item_id, fb_page_id, status, attempt_number, tokens_deducted)
     VALUES ($1, $2, $3, 'success', $4, 1)`,
    [userId, queueItemId, pageId, attemptNumber]
  );
});
```

---

## 5. Timezone Management & Next Slot Computation

- Slots define recurring daily execution times (e.g. `09:00:00`) tied to a target timezone (`timezone VARCHAR(50)`, default `'UTC'`).
- The client or backend calculates target `scheduled_time` (stored in UTC as `TIMESTAMPTZ`):
  1. Take the current page date in the slot's timezone.
  2. For each active slot in ascending chronological order, find the next occurrence where `scheduled_time > now()` and no active queue item is currently scheduled.
  3. If all slots for today are occupied, roll over to the next day's first vacant slot.
