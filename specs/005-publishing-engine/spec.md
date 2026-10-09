# Feature Specification: Automated Queue Slots Publishing Engine & Cloudflare Edge Dispatcher

**Feature Branch**: `feat/005-publishing-engine`

**Created**: 2026-10-07

**Status**: Ready for Planning

**Input**: User description: "Page-specific recurring queue slots, selective asset queueing from media library with captions, automated first comment, Cloudflare Worker edge scheduler with PostgreSQL FOR UPDATE SKIP LOCKED, direct streaming to Facebook Graph API v26.0 for reels and photos, atomic 1-token deduction on successful publication, automatic error logging and retries, and publishing queue management UI"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Page-Specific Recurring Queue Slots Configuration (Priority: P1)

As a content creator managing multiple Facebook Pages, I want to define recurring daily publishing time slots (e.g. 09:00, 13:00, 18:00) with custom timezone settings for each connected Page, so that my content is consistently dispatched at optimal audience engagement times without manual scheduling for every single post.

**Why this priority**: Foundational scheduling substrate. Without time slot definitions, the queue system cannot determine upcoming publication intervals or calculate target execution timestamps.

**Independent Test**: Can be validated by selecting a connected Facebook Page, creating recurring daily slots (e.g., 09:00, 14:00, 20:00 in "America/New_York"), verifying compound uniqueness on `(user_id, fb_page_id, slot_time)`, updating or toggling slot active status, and deleting an unused slot.

**Acceptance Scenarios**:

1. **Given** an authenticated user with at least one connected Facebook Page, **When** they configure a new daily publishing slot at a specific time (e.g. "09:30") and timezone, **Then** the slot is saved under that Page, and future schedule slots are calculated accordingly.
2. **Given** an existing slot at "09:30" for Page A, **When** the user attempts to create another slot at "09:30" for the same Page A, **Then** the system rejects the duplicate with a clear collision message.
3. **Given** an existing slot at "09:30" for Page A, **When** the user creates a slot at "09:30" for Page B, **Then** the slot is successfully created because slots are isolated per Page.
4. **Given** a user in Workspace 1, **When** they attempt to list, modify, or delete slots for a Page belonging to Workspace 2, **Then** the system denies the request with an authorization error.

---

## User Story 2 - Selective Asset Queueing with Captions & Automated First Comment (Priority: P2)

As a social media publisher, I want to select video or image assets from my Media Library, assign captions (manually or via saved caption templates), configure an optional automated first comment (for links, calls to action, or hashtags), and enqueue them into upcoming slots for my target Facebook Page, so that my publishing pipeline is fully automated in advance.

**Why this priority**: Core content pipeline linking the Media Library (Spec 004) and Facebook Pages (Spec 003). Creators need a seamless queueing workflow to populate upcoming slots.

**Independent Test**: Can be validated by choosing a media asset, assigning caption text, enabling an automated first comment, picking a target Facebook Page, and asserting that a queue item is created with status `queued`, mapped to the next available chronological slot, and displays properly in the upcoming queue view.

**Acceptance Scenarios**:

1. **Given** an existing video or image asset in the user's Media Library and configured slots for a Page, **When** the user enqueues the asset with custom caption text, **Then** a new queue item is created with status `queued` assigned to the next available vacant slot time.
2. **Given** an asset being enqueued, **When** the user provides an optional "First Comment" text (e.g., "Link in bio: https://example.com/deal #special"), **Then** the first comment payload is preserved with the queue item for downstream dispatch.
3. **Given** a user queueing an asset, **When** the user's token balance is zero or negative, **Then** the system alerts the user and prevents enqueueing until tokens are topped up (pre-flight balance validation).
4. **Given** multiple queue items scheduled for a Page, **When** the user reorders or removes an item from the queue, **Then** the queue item order updates and vacated slots become available for future assets.

---

## User Story 3 - Edge Dispatcher & Facebook Graph API Streaming (Priority: P3)

As a social media creator, I want the system's background edge dispatcher to automatically detect due queue items, stream the media directly to the Facebook Graph API (as a Facebook Reel or feed photo), and publish the automated first comment immediately after the post is live, so that publishing happens reliably on time without server bottlenecks or manual intervention.

**Why this priority**: Execution engine. Delivers the core promise of the platform: automated hands-free publishing directly to Facebook Pages via official Graph API v26.0 endpoints.

**Independent Test**: Can be validated by creating a queue item due for immediate execution, triggering the worker dispatcher cycle, asserting that the worker claims the row using `FOR UPDATE SKIP LOCKED`, decrypts the page token, publishes the media to Facebook Graph API v26.0, dispatches the first comment, and records the external Facebook post and comment IDs.

**Acceptance Scenarios**:

1. **Given** one or more queue items whose scheduled execution time is less than or equal to current UTC time with status `queued`, **When** the edge worker scheduler runs its minute-interval cron trigger, **Then** due items are claimed atomically with row-level locks preventing race conditions between concurrent worker instances.
2. **Given** a claimed video queue item, **When** the worker processes the item, **Then** the video is streamed directly to Facebook Graph API v26.0 Reels endpoints using the Page's decrypted access token, transitioning status to `publishing` and then `published`.
3. **Given** a claimed image queue item, **When** the worker processes the item, **Then** the image is published to the Facebook Page photos endpoint using the decrypted Page token.
4. **Given** a successfully published post with a configured first comment, **When** the post ID is returned by Facebook, **Then** the worker dispatches a comment to `/{post_id}/comments` with the configured text and logs the comment ID.

---

## User Story 4 - Execution Outcome Logging & Retry Handling (Priority: P4)

As a platform operator and creator, I want automated execution outcome logging and retry handling for transient network errors, so that I have complete transparency into publishing status and reliable post dispatching.

**Why this priority**: Operational reliability and publishing transparency. Protects users from transient failures and provides complete audit logs and controls.

**Independent Test**: Can be validated by executing a successful publish (asserting status becomes `published` and an execution log record is created), executing a simulated failed publish (asserting error logged and retry incremented), and inspecting the queue execution logs.

**Acceptance Scenarios**:

1. **Given** a queue item that successfully publishes to Facebook, **When** publication completes, **Then** post ID is recorded, an execution log entry is created in `publish_logs`, and status transitions to `published`.
2. **Given** a queue item where Facebook Graph API returns a non-fatal temporary error (e.g., rate limit or network glitch), **When** processing fails, **Then** the item retry count is incremented, error diagnostics are recorded, and next retry is scheduled.
3. **Given** a queue item that reaches maximum retry attempts (e.g. 3 attempts) or encounters a fatal permission/account error, **When** it fails, **Then** status transitions to `failed`, an error log entry is recorded with full diagnostic details, and the user is alerted.
4. **Given** an authenticated user querying queue status via API, **When** requested, **Then** the user receives upcoming slots, currently queued items, published post history, and execution logs.

---

## Edge Cases

- **Concurrent Edge Worker Execution**: Multiple worker isolate instances triggered at the exact same minute boundary must never claim or publish the same queue item twice. Enforced via PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Expired or Revoked Page Access Tokens**: If Facebook Graph API returns error code 190 (Invalid OAuth Token), the publish job must be marked as `failed` with actionable error text ("Facebook Page connection expired, please reconnect") and no runaway retries.
- **Deleted Media Asset**: If a user deletes a media asset while it is currently queued in an upcoming slot, the queue engine must detect the missing asset, mark the item as `failed` with an explanatory message ("Source media asset no longer exists"), and vacate the slot cleanly.
- **Timezone Drift & Daylight Saving Time**: Slots defined in localized Page timezones (e.g., `Europe/London`, `America/New_York`) must accurately compute UTC publishing timestamps across DST transitions.
- **Large Video Processing Delay on Facebook**: Facebook Reels ingestion may process asynchronously. The publisher must handle the two-phase upload session (initialize upload session, stream video bytes, verify readiness/publish) within Cloudflare Worker execution budgets or status polling.
- **First Comment Failure**: If the main post publishes successfully but the automated first comment fails (e.g., comment rate limit), the post itself remains `published`, and the comment failure is logged as a non-fatal warning in the publish log.
- **Cross-Tenant Isolation**: Every database query, queue item mutation, slot configuration, and publish log is bound strictly to `user_id`. Workspace A cannot view or manipulate Workspace B's queue or slots.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to configure recurring daily queue slots per Facebook Page with specific slot times (HH:MM format) and target timezones.
- **FR-002**: The system MUST enforce compound uniqueness on `(user_id, fb_page_id, slot_time)` to prevent duplicate slots on the same Page.
- **FR-003**: The system MUST allow users to toggle slot active/inactive status and delete unused slots.
- **FR-004**: The system MUST allow users to select video or image assets from their Media Library and enqueue them into upcoming vacant slots for a target Page.
- **FR-005**: The system MUST support attaching custom captions or selecting reusable caption templates when queueing assets.
- **FR-006**: The system MUST support configuring an optional "First Comment" string to be posted automatically upon successful post publication.
- **FR-007**: [RETIRED] Pre-flight token check has been retired in favor of flat workspace subscription access.
- **FR-008**: The system MUST allow users to reorder queued items, edit scheduled captions, skip slots, or remove items from the queue.
- **FR-009**: The system MUST include an edge worker scheduler executing every minute via Cloudflare Worker cron triggers to process due queue items.
- **FR-010**: The edge worker MUST claim due items atomically using PostgreSQL row-level locks (`SELECT ... FOR UPDATE SKIP LOCKED`) to eliminate double-publishing under high concurrency.
- **FR-011**: The worker MUST stream video media to Facebook Graph API v26.0 Reels publishing endpoints (`/video_reels`) using decrypted Page access tokens.
- **FR-012**: The worker MUST publish image media to Facebook Graph API v26.0 Photos publishing endpoints (`/photos`) using decrypted Page access tokens.
- **FR-013**: The worker MUST post the automated first comment to `/{post_id}/comments` immediately following successful post creation when configured.
- **FR-014**: [RETIRED] Per-action token deduction has been retired.
- **FR-015**: The system MUST record detailed error logs with retry metadata (maximum 3 retries for transient errors) on publication failure.
- **FR-016**: The system MUST provide publishing queue management APIs featuring slot configuration, upcoming schedule calculation, manual trigger, and publishing history logs.

---

## Key Entities *(include if feature involves data)*

- **Page Queue Slot**: Represents a recurring daily publishing window. Attributes: `id` (UUID), `user_id` (UUID), `fb_page_id` (UUID), `slot_time` (TIME, HH:MM:SS), `timezone` (VARCHAR), `is_active` (BOOLEAN), `created_at`, `updated_at`. Compound unique on `(user_id, fb_page_id, slot_time)`.
- **Queue Item**: Represents a scheduled publication instance. Attributes: `id` (UUID), `user_id` (UUID), `fb_page_id` (UUID), `slot_id` (UUID, nullable), `media_id` (UUID), `scheduled_time` (TIMESTAMPTZ), `caption` (TEXT), `first_comment` (TEXT, nullable), `status` (ENUM: `queued`, `publishing`, `published`, `failed`, `skipped`), `retry_count` (INTEGER), `max_retries` (INTEGER default 3), `fb_post_id` (VARCHAR, nullable), `fb_comment_id` (VARCHAR, nullable), `published_at` (TIMESTAMPTZ, nullable), `created_at`, `updated_at`.
- **Publish Log**: Represents the execution audit trail for a publish attempt. Attributes: `id` (UUID), `user_id` (UUID), `queue_item_id` (UUID), `fb_page_id` (UUID), `status` (ENUM: `success`, `failure`, `retry`), `attempt_number` (INTEGER), `fb_response_code` (INTEGER, nullable), `error_message` (TEXT, nullable), `error_details` (JSONB, nullable), `created_at`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scheduled posts are claimed and dispatched by the edge worker within 60 seconds of their target slot time.
- **SC-002**: 100% zero duplicate publishing: under concurrent worker invocations, no queue item is published more than once.
- **SC-003**: 100% execution transparency: detailed execution logs and retry audit trails are captured for all publication attempts.
- **SC-004**: Automated first comment is dispatched within 5 seconds of the root post being created.
- **SC-005**: 100% cross-tenant data isolation: no user can inspect, modify, or trigger queue items or slots belonging to another user.
- **SC-006**: Users can configure slots, enqueue assets, and inspect upcoming schedules with UI transitions completing in under 250 milliseconds.

---

## Assumptions

- Connected Facebook Pages have valid Page Access Tokens encrypted in the token vault (from Spec 003).
- Media assets referenced by queue items are stored in Cloudflare R2 with accessible streaming URLs (from Spec 004).
- Graph API v26.0 endpoints are used for all Facebook interactions (`pages_manage_posts`, `pages_read_engagement`).
- The edge scheduler runs as a Cloudflare Worker scheduled event (`crons = ["* * * * *"]`).
- Post types are inferred automatically from media asset type: videos are published as Facebook Reels / video posts, images are published as photo posts.
