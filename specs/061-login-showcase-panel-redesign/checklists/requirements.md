# Requirements Quality Checklist: Spec 061 - Login Showcase Panel Redesign

## 1. Copy & Verbatim Text Integrity
- [ ] Brand Row title: `"FBUploadPro"` in bold
- [ ] Brand Row tagline: `"Content automation for creators"` in muted text
- [ ] Eyebrow label: `"CREATE · SCHEDULE · GROW"` in accent color, uppercase, wide letter-spacing
- [ ] Eyebrow unboxed: No card container, no pill badge, no background box
- [ ] Headline line 1: `"Your pages,"`
- [ ] Headline line 2: `"posting themselves —"`
- [ ] Headline line 3: `"100% on the cloud."` highlighted in `PALETTE.primary`
- [ ] Subtext: `"Schedule reels and posts across Facebook, Instagram, TikTok, YouTube, Threads, and X — they go live while you sleep, even when your laptop is closed."`
- [ ] Subtext width: constrained to max-width ~420px
- [ ] Feature 1 title: `"Post from anywhere"`
- [ ] Feature 1 desc: `"Schedule from your phone or laptop — your posts publish from the cloud."`
- [ ] Feature 2 title: `"Every platform, one dashboard"`
- [ ] Feature 2 desc: `"Connect each account once, then run everything from a single place."`
- [ ] Feature 3 title: `"Your accounts stay yours"`
- [ ] Feature 3 desc: `"You sign in through each platform directly — your passwords never leave them."`
- [ ] Platform line: `"Facebook · Instagram · TikTok · YouTube · Threads · X"`
- [ ] Footer text: `"Official platform logins · Encrypted end-to-end"`
- [ ] Prohibited elements: Strictly NO "See how it works" link
- [ ] Prohibited elements: Strictly NO emojis (inline SVG line icons only)
- [ ] Left sign-in card subtext: `"Welcome back! Sign in to keep your content flowing across every platform."`

## 2. Theme & Design System Standards
- [ ] Accent color: uses `PALETTE.primary` / `var(--primary)`
- [ ] Hairline dividers: uses `var(--border-subtle)` / `PALETTE.neutral`
- [ ] Fonts & weights: uses `TYPOGRAPHY` tokens
- [ ] Zero ad-hoc colors or arbitrary hardcoded pixel overrides
- [ ] Zero capsule pill badges

## 3. Responsive & Layout Behavior
- [ ] Desktop (>= 1024px): 50/50 split layout with form on left and showcase on right
- [ ] Narrow screens (< 1024px): Showcase panel stacks vertically ABOVE the sign-in card with reduced padding
- [ ] Feature rows maintain full-width on mobile
- [ ] No layout shift or console errors
