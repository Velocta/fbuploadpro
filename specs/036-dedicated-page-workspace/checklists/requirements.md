# Checklist: Spec 036 — Dedicated Facebook Page Workspace

## Requirements & Verification Checklist

- [ ] **CH001**: Header displays avatar, page name, category, linked account, unboxed status signal, and live link.
- [ ] **CH002**: Header "Pause/Resume Automation" button toggles status between `active` and `paused`.
- [ ] **CH003**: Header "Add to Queue" opens enqueue modal to select media and slot.
- [ ] **CH004**: Header Settings dropdown provides safe Disconnect Page flow.
- [ ] **CH005**: Dashboard tab renders metrics (Followers, Growth, Queued Count, Next Post time).
- [ ] **CH006**: Dashboard tab displays upcoming queue items with 1-click "Publish Now".
- [ ] **CH007**: Queue tab lists all scheduled items with media thumbnail, caption, first comment, and slot time.
- [ ] **CH008**: Queue tab allows immediate publication via "Publish Now" with visual feedback.
- [ ] **CH009**: Queue tab enables inline editing of caption and first comment.
- [ ] **CH010**: Queue tab supports removing/canceling an item from the publishing queue.
- [ ] **CH011**: Calendar tab lists recurring publishing time slots and supports adding/deleting slots.
- [ ] **CH012**: Insights tab renders follower growth and video performance charts using Recharts.
- [ ] **CH013**: Settings tab exposes master automation switch and token health diagnostics.
- [ ] **CH014**: Strict theme compliance with `apps/web/src/lib/theme.ts` (zero pill badges, zero ad-hoc styling, zero edits to `DESIGN.md`).
- [ ] **CH015**: Professional UX copy meeting `.agents/rules/ux-writing-standards.md`.
