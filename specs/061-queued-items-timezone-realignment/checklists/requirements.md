# Quality & Requirements Checklist: Spec 061 - Queued Items Timezone Realignment

## Domain & Functional Requirements
- [ ] Changing schedule timezone updates `facebook_pages.timezone`.
- [ ] Pending `queue_items` (`status = 'queued'`) with `slot_id IS NOT NULL` are selected for realignment.
- [ ] One-off items with `slot_id IS NULL` remain unchanged.
- [ ] Candidate items are realigned to their slot's wall-clock time in the new timezone.
- [ ] Past-time protection: items that would fall in the past (`<= now`) are advanced to the future.
- [ ] Chronological order across items is preserved.
- [ ] Response includes `realignedQueueCount`.
- [ ] Frontend displays feedback and re-fetches queue items.

## Security & Multi-Tenant Isolation
- [ ] All update queries enforce `fb_page_id = $1 AND user_id = $2`.
- [ ] Cross-tenant mutation is strictly blocked (404/403).

## Code Quality & Anti-Slop
- [ ] Zero bullet point characters (`•`).
- [ ] Zero capsule pill badges.
- [ ] All theme tokens imported from `@/lib/theme`.
- [ ] Zero TypeScript or linter errors.
