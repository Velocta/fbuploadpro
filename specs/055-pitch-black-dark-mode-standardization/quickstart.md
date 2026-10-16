# Quickstart & Verification: Pitch Black Dark Mode Standardization (Spec 055)

## Verification Flow

1. **Initial Page Load / Fresh Login**:
   - Inspect viewport background: verify it is pure Pitch Black (`#000000`), not blue-tinted `#0a0c10`.
   - Inspect sidebar panel: verify surface is `#0c0d10` with hairline divider `#1f242d`.
2. **Toggle Theme (Dark -> Light -> Dark)**:
   - Click theme toggle in sidebar footer: transitions to light mode (`#f6f8fa` canvas).
   - Click theme toggle again: transitions back to dark mode (`#000000` canvas).
   - Notice: **Zero color jump or shift** between initial login dark mode and toggled dark mode.
3. **Cross-Tab & Refresh Persistence**:
   - Refresh page: verifies pre-hydration script eliminates FOUC and preserves dark/light selection from `localStorage` and `fbup_theme` cookie.
