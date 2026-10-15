# Quickstart & Verification Guide: Platform Audit Remediation (Spec 045)

**Feature Branch**: `fix/045-platform-audit-remediation`  
**Date**: 2026-10-15  

This guide provides verification procedures and test execution flows for all 42 issues remediated under Spec 045.

---

## 1. Automated Verification Commands

In accordance with repository guidelines, local builds and tests are not run prior to PR creation. All tests execute automatically in remote CI. Below are the targeted test suites executed by GitHub Actions:

### 1.1 Contracts & Hardening Tests
```bash
# Executed in remote CI
pnpm --filter @fbuploadpro/contracts test
```
*Validates:*
- `PostFormatSchema` eligibility for `text`, `image`, `reel`, `video`, `story`.
- Prohibiting first comments on `story` posts.
- Runtime crypto master key guard against `DEV_FALLBACK_ENCRYPTION_KEY` in production.
- `evaluateGraphApiError` classification of codes `190`, `368 (4854002)`, `506`, `1609005`, `80001`.

### 1.2 Worker Dispatcher & Downloader Tests
```bash
# Executed in remote CI
pnpm --filter worker test
```
*Validates:*
- Multi-format publishing dispatch for text, video, photo story, video story.
- Fair-share partitioned claims (`p_max_per_page`).
- Cloudflare Queue fan-out with error fallback.
- Streaming downloader pre-stream `HEAD` validation and byte-counting `TransformStream` abort guard.
- Daily insights pagination and error propagation.

### 1.3 Web App Route & Component Tests
```bash
# Executed in remote CI
pnpm --filter web test
```
*Validates:*
- Keyset cursor pagination in `MediaLibraryExplorer`.
- Server-side target folder duplicate check endpoint.
- Sanitized auth and BYOC error responses.
- Non-optimistic BYOC status initialization and retry banner.
- Real Upstash Redis REST caching in `InsightsCache`.
- Absence of write amplification in `GET /pages`.
- Clean zero follower metric initialization in `DedicatedPageView`.
- `StatusDot` strict adherence to `STATUS_SIGNALS` theme tokens.

---

## 2. Manual Acceptance Walkthroughs

### 2.1 Multi-Format Scheduling (Module 2)
1. Open `DedicatedPageView` and click **"Schedule Post"**.
2. Select format **"Text / Link"**. Verify that media selection is hidden, caption is required, and optional link is accepted.
3. Select format **"Story"**. Verify that the **First Comment** input is completely hidden/disabled.
4. Select format **"Reel"** and pick an incompatible horizontal 16:9 video. Verify that the UI displays an in-context validation message explaining that Reels require a 9:16 vertical video.

### 2.2 Account Token Health & Cascade (Module 1)
1. In `TenantAccountsPage`, inspect accounts approaching 60-day token expiration.
2. Verify that accounts with $\le 7$ days remaining display an amber health warning and a countdown CTA.
3. Simulate an expired token dispatch (`code: 190`). Verify that both the child Page (`invalid_token`) and the parent Account (`expired`) reflect their invalid state.

### 2.3 Media Library Keyset Pagination (Module 3)
1. Open a media library folder with > 100 assets.
2. Scroll to load additional items.
3. Verify that requests use `?cursor=<timestamp>_<id>` rather than `?offset=...`.
4. Upload a duplicate file already present at position 200+. Verify that the pre-upload check flags the duplicate before uploading.

### 2.4 Cloud Media Downloader (Module 4)
1. Submit a remote URL pointing to a file $> 500\text{ MB}$.
2. Verify immediate rejection before body streaming begins.
3. Test a download with an invalid job ID. Verify the UI stops polling immediately on `404` without looping for 90 seconds.
4. Click **"Abort Download"** during an active download and verify the stream terminates gracefully.

### 2.5 Page Checkpoint Recovery (Module 2)
1. Set a Page status to `'page_checkpoint'` in the database.
2. Load the Page header in `DedicatedPageView`.
3. Verify that a prominent instructional banner explains mobile verification and renders a 1-click **"Reactivate Page"** button.
4. Click the button and verify the Page transitions cleanly back to `'active'`.
