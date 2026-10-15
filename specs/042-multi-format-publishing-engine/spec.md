# Feature Specification: 042-multi-format-publishing-engine

**Feature Branch**: `feat/042-multi-format-publishing-engine`
**Created**: 2026-10-15
**Status**: Approved
**Input**: High-Throughput 200,000 Posts/Day Multi-Format Publishing Engine (`text`, `image`, `reel`, `video`, `story`), Media Library Scaling, Dedicated Page Workspace & Hybrid Insights Architecture

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Format 200k/Day Publishing Engine (Priority: P1)

As a content creator and agency operator, I want to schedule and publish across all 5 canonical Facebook post formats (`text`, `image`, `reel`, `video`, `story`) through a unified queue and high-throughput edge dispatcher capable of sustaining 200,000 posts/day without lock contention, subrequest crashes, or rate-limit violations.

**Why this priority**:
Expands FBUploadPro from a video/reel-only uploader into a full-suite multi-format Facebook marketing automation engine.

**Acceptance Scenarios**:
1. **Given** a text-only or link post with non-empty caption, **When** enqueued, **Then** `media_id` is null, and it is published via Graph API `/{page-id}/feed` with optional link URL and automatic first comment.
2. **Given** an image post, **When** enqueued, **Then** it validates `media_type === 'image'` and publishes via `/{page-id}/photos` with caption and first comment.
3. **Given** a reel post, **When** enqueued, **Then** it validates `media_type === 'video'`, duration $\le 90\text{s}$, and publishes via 3-phase video reels Graph API (`upload_phase: 'start'`, rupload binary stream, `upload_phase: 'finish'`) with caption and first comment.
4. **Given** a feed video post, **When** enqueued, **Then** it supports any aspect ratio ($16:9$, $1:1$, $9:16$) and duration, publishing via `/{page-id}/videos`.
5. **Given** a page story post (photo $\le 10\text{ MB}$ or vertical video $\le 60\text{s}$), **When** enqueued, **Then** `first_comment` is strictly suppressed to null, publishing via `/{page-id}/photo_stories` or `/{page-id}/video_stories` without comment.
6. **Given** peak scheduling bursts, **When** worker cron runs, **Then** `claim_due_queue_items` uses fair per-page partitioning and `FOR UPDATE SKIP LOCKED`, fanning out batches across Cloudflare Queue producer/consumer workers.

---

### User Story 2 - Media Library Scaling & Keyset Pagination (Priority: P1)

As an enterprise operator with tens of thousands of media assets, I want the Media Library to load instantly via keyset cursor pagination, catch duplicates across my entire library before upload, and eliminate base64 thumbnail bloat.

**Why this priority**:
Eliminates $O(N)$ database scan latency, duplicate uploads beyond the first 100 items, and base64 bloat in list queries.

**Acceptance Scenarios**:
1. **Given** a media library with $>10,000$ assets, **When** querying with `cursor: "createdAt|id"`, **Then** the API performs $O(1)$ index scans and returns `nextCursor`.
2. **Given** files being uploaded, **When** calling `POST /api/tenant/[subdomain]/media/check-duplicates`, **Then** the server checks against all existing user media in the target folder by case-insensitive name and size.
3. **Given** a video thumbnail update with a base64 data-URL, **When** `PATCH /api/.../media/[mediaId]` runs, **Then** the base64 buffer is uploaded to R2 as a compressed JPEG and persisted as a clean CDN URL.
4. **Given** a folder deletion with 500+ items, **When** `DELETE /api/.../media/folders/[folderId]` runs, **Then** R2 keys are deleted in bounded parallel batches.

---

### User Story 3 - Dedicated Page Workspace & Multi-Format Enqueue Modal (Priority: P1)

As a page manager, I want a dedicated workspace for each connected Facebook Page with format-aware tabs (Overview, Queue, Slots, Calendar, Settings) and a multi-format Enqueue Modal.

**Why this priority**:
Provides clear visual management, format validation feedback, and checkpoint reactivation controls.

**Acceptance Scenarios**:
1. **Given** the Enqueue Modal, **When** choosing format chips (`Reel`, `Video`, `Photo`, `Story`, `Text`), **Then** form fields adapt dynamically (hiding media picker for Text, hiding first comment for Story).
2. **Given** a Page in `page_checkpoint` status, **When** visiting the dedicated workspace, **Then** a prominent warning banner with 1-click reactivation is displayed.
3. **Given** recurring slots, **When** scheduling, **Then** `findNextAvailableSlot` matches items only against slots permitting their format.

---

### User Story 4 - Hybrid Insights Architecture & Proactive Pacing (Priority: P2)

As a workspace administrator, I want page analytics to serve from persisted daily snapshots and Upstash Redis caching, conserving Facebook Graph API BUC quota for high-throughput publishing.

**Why this priority**:
Prevents burning Graph API rate-limit quota (`80001`) on analytics requests and provides fast dashboards.

**Acceptance Scenarios**:
1. **Given** fresh daily snapshots in `page_insights_daily_snapshots`, **When** querying insights without refresh, **Then** metrics are assembled directly from PostgreSQL and cached in Upstash Redis.
2. **Given** publishing telemetry with BUC usage $\ge 85\%$, **Then** the Page enters a proactive cooldown.
3. **Given** background daily insights sync, **Then** pages are fetched with cursor pagination without hitting subrequest or PostgREST limits.
