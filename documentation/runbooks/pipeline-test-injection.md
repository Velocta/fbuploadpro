# Pipeline Test Injection Runbook

Use this runbook to test the posting pipeline without enabling scheduler DB reads.

## Endpoint

- Worker route: `POST /enqueue-test-job`
- Service: `backend/services/posting/posting-scheduler-worker`
- The endpoint forces `mode="test"`.

If `SCHEDULER_TEST_API_KEY` is configured, send it in header `x-test-api-key`.

## Base Request

```bash
curl -X POST "https://<scheduler-worker-domain>/enqueue-test-job" \
  -H "content-type: application/json" \
  -H "x-test-api-key: <your-key-if-enabled>" \
  -d '{
    "job_id": "11111111-1111-1111-1111-111111111111",
    "trace_id": "22222222-2222-2222-2222-222222222222",
    "agency_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "page_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "fb_page_id": "123456789012345",
    "fb_page_access_token": "<test-token>",
    "source_username": "testuser",
    "source_platform": "instagram",
    "reel_id": "Cxyz12345",
    "reel_internal_id": 12345
  }'
```

## Scenarios

### 1) Happy Path (test mode, publish skipped by default)

- Keep `TEST_ENABLE_EXTERNAL_PUBLISH` unset in orchestrator.
- Inject valid payload.
- Expected:
  - HTTP `202` from scheduler endpoint.
  - Queue receives message.
  - Orchestrator consumes and completes with `publish_skipped_test_mode`.
  - No DB status mutation on reels/pages/tokens.

### 2) Duplicate Job Idempotency

- Send the same payload twice with same `job_id`.
- Expected:
  - First message processed.
  - Second attempt either ignored by downstream job state or processed as no-op depending on state.
  - Review logs by `job_id` and `trace_id`.

### 3) Download Failure Simulation

- Set invalid source data:
  - non-existent `reel_id`, or malformed source username/platform pairing.
- Expected:
  - retries until queue attempt cap,
  - final `job_failed_terminal` event with download-related error code.

### 4) Publish/Auth Failure Simulation

- Set `TEST_ENABLE_EXTERNAL_PUBLISH=true` in orchestrator.
- Use an invalid/expired `fb_page_access_token`.
- Expected:
  - terminal auth-related failure event,
  - queue message acknowledged as terminal.

## Verification Queries

Use queries in:

- `documentation/runbooks/pipeline-observability.md`

Key events to confirm:

- `job_enqueued` (scheduler)
- `download_started` and `download_succeeded` (downloader service)
- `publish_started` / `publish_succeeded` or `job_failed_terminal` (publisher/downloader service)
- `job_retry_scheduled` for transient retries

## Safety Notes

- Keep this endpoint enabled only in test/staging environments.
- Use `SCHEDULER_TEST_API_KEY` to protect against unauthorized injection.
- Keep Facebook test tokens/accounts isolated from production.
