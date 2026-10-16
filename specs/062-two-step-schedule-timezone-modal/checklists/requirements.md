# Requirements Checklist: Spec 062 - Two-Step Professional Schedule Timezone Modal

## UI/UX & Functional Requirements
- [ ] Clicking the schedule timezone button in `tab-posting-times.tsx` opens `ScheduleTimezoneModal`.
- [ ] Modal opens at Step 1 with current timezone pre-selected and focused.
- [ ] Search input in Step 1 filters timezones by city, country, region, or IANA name in real time.
- [ ] Timezones are grouped by region (Americas, Europe, Asia, Australia & Pacific, Africa, UTC) with clear UTC offsets.
- [ ] "Continue to Review" button is disabled if the selected timezone equals the active timezone.
- [ ] Step 2 provides a visual comparison between current and new timezone.
- [ ] Step 2 clearly explains that recurring clock times remain intact (e.g. 10:00 AM stays 10:00 AM).
- [ ] Step 2 displays the count of active slots and queued items affected.
- [ ] Step 2 "Back" button returns to Step 1 preserving selection.
- [ ] Submitting updates the timezone via API, closes modal, displays toast, and refreshes slots and queue.

## Theme & Design Standards
- [ ] All colors, typography, borders, and spacing strictly reference `@web/lib/theme`.
- [ ] Zero capsule pill badges or ad-hoc border radii.
- [ ] Zero arbitrary hex colors.
- [ ] Status indicators use unboxed 6px luminous dots.
- [ ] `DESIGN.md` remains strictly untouched.

## Quality & Non-Functional Requirements
- [ ] Zero SonarQube major/critical code smells (e.g. zero nested ternaries S3358, complexity < 15).
- [ ] Comprehensive test coverage for new components and helpers (>80%).
- [ ] Remote CI passes with 100% success.
