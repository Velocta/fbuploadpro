# Quickstart & Validation Guide: Automated Queue Slots Publishing Engine

**Branch**: `feat/005-publishing-engine-plan` | **Date**: 2026-10-07 | **Spec**: [specs/005-publishing-engine/spec.md](spec.md)

This document provides validation procedures, unit/integration testing commands, and verification steps for Spec 005.

---

## 1. Prerequisites & Environment Setup

Ensure test environment variables are configured in `.env.local` or worker environment:

```bash
# Master Encryption Key for Access Token Decryption
FB_ENCRYPTION_MASTER_KEY="test_master_encryption_key_minimum_32_characters_long"

# Facebook Graph API Base URL (defaults to https://graph.facebook.com/v26.0)
FB_GRAPH_API_URL="https://graph.facebook.com/v26.0"

# Database Connection URL
DATABASE_URL="postgres://postgres:postgres@localhost:5432/fbuploadpro_dev"
```

---

## 2. Test Execution Commands

### 2.1 Contracts & Zod Schemas Validation
```bash
pnpm --filter @fbuploadpro/contracts test
```
**Asserts**:
- `SlotTimeSchema` validates `HH:MM` and `HH:MM:SS` 24h format; rejects invalid formats.
- `CreateQueueSlotRequestSchema` and `UpdateQueueSlotRequestSchema` validate UUIDs and payloads.
- `EnqueueMediaRequestSchema` enforces max caption length (5000 chars) and first comment length (2000 chars).
- `PublishLogSchema` validates outcome statuses (`success`, `failure`, `retry`).

### 2.2 Database Migration & Concurrency Tests
```bash
pnpm --filter @fbuploadpro/database test
```
**Asserts**:
- Forward DDL migration `0004_publishing_engine.sql` applies without errors.
- Compound uniqueness on `page_queue_slots(user_id, fb_page_id, slot_time)` blocks duplicate slots.
- Foreign keys with `ON DELETE CASCADE` and `ON DELETE SET NULL` properly maintain referential integrity.
- `FOR UPDATE SKIP LOCKED` query isolates rows across concurrent simulated connections without deadlocks or double-claiming.

### 2.3 Cloudflare Worker Dispatcher & Mock Facebook API Tests
```bash
pnpm --filter @fbuploadpro/worker test
```
**Asserts**:
- Worker scheduled trigger runs `runDispatchCycle`.
- Media streaming for videos calls 3-phase Reels endpoints (`start`, upload, `finish`).
- Media streaming for photos calls `/photos` endpoint.
- Automated first comment dispatches to `/{post_id}/comments`.
- Exactly 1 token is deducted on successful publish; 0 tokens deducted on failure.
- Retry count increments on transient 429/5xx errors; status transitions to `failed` upon reaching `maxRetries`.

### 2.4 Web App Route Handlers & UI Component Tests
```bash
pnpm --filter @fbuploadpro/web test
```
**Asserts**:
- `GET /api/tenant/[subdomain]/pages/[pageId]/slots` and `POST` handlers enforce tenant isolation.
- `POST /api/tenant/[subdomain]/publishing/queue` validates pre-flight token balance (`tokens_balance >= 1`).
- `GET /api/tenant/[subdomain]/publishing/queue` lists items with upcoming schedule calculation.
- Publishing queue page at `/tenant/[subdomain]/publishing` renders schedule visualizer, slot manager, and manual action controls.

---

## 3. Monorepo Quality Gate Validation

Verify the entire repository against Turborepo quality gates:

```bash
pnpm turbo run build lint typecheck test
```

**Quality Acceptance**:
- Zero TypeScript errors (`strict: true`).
- Zero ESLint warnings.
- 100% test pass rate across all packages.
