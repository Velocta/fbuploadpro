---
name: ux-writing
description: Create user-centered, accessible, professional interface copy (microcopy) for digital products including buttons, labels, error messages, notifications, forms, onboarding, empty states, success messages, and help text. Use when writing or editing any text that appears in public apps, websites, or software interfaces. Eliminates robotic developer slop, internal technical jargon, and fake status badges. Applies UX writing best practices based on four quality standards — purposeful, concise, conversational, and clear.
---

# UX Writing & Microcopy Standards

Write clear, concise, user-centered interface copy (UX text/microcopy) for digital products and public web applications. This skill provides frameworks, patterns, and strict quality floors to ensure every word seen by a user sounds human, professional, and trustworthy.

## When to Use This Skill
- Writing or refining UI copy (buttons, labels, card headers, form helpers, empty states)
- Authoring error messages, warnings, alerts, and feedback toasts
- Creating onboarding, login, signup, and authentication flows
- Reviewing UI strings to eliminate robotic developer-speak or internal architectural plumbing leaking into the user experience

---

## Core UX Writing Principles

### The Four Quality Standards
1. **Purposeful** — Helps users accomplish their goal efficiently. Every phrase has a specific reason to exist.
2. **Concise** — Uses the fewest words possible without sacrificing clarity or warmth. Respects the user's cognitive load.
3. **Conversational** — Sounds like a competent, helpful human. Uses natural rhythm and active voice (85%+).
4. **Clear** — Unambiguous, plain language (7th-8th grade reading level). Free of technical jargon, internal acronyms, and implementation details.

---

## Absolute Prohibitions (Zero Developer Slop)

### 1. Never Expose Engineering Plumbing
Users are business owners, creators, and operators—not backend developers or database administrators.
- **Backend Mechanics**: Never mention schema constraints, data types, database engines, or internal data normalization anywhere in user copy.
- **Validation & Sanitization**: Never describe regex patterns, string manipulation, or input sanitation mechanics in helper text. Use realistic, human input examples instead.
- **Infrastructure Terminology**: Never use infrastructure, cloud deployment, or system architecture jargon on customer-facing screens. Frame all copy around user intent, content, and workflows.

### 2. Never Use Decorative or Simulated Status Indicators
- Status indicators (`StatusDot`, `STATUS_SIGNALS`) must strictly and exclusively represent authentic, live runtime entity state (e.g., connected social account token health, publishing task progress).
- Never add decorative or simulated status dots (such as "Online", "Ready", "Operational", or cosmetic colored dots) to headers, cards, forms, modals, or page wrappers.

### 3. Never Blame the User or Show Cryptic Errors
- Error messages must be constructive, empathetic, and plain-language.
- Never use cold, bureaucratic codes or accusatory language.
- Structure error messages cleanly:
  1. What happened (plain terms)
  2. Why it occurred (without technical jargon or blame)
  3. How to resolve it (clear recovery action)

---

## UI Text Patterns & Guidelines

### Card Headers & Titles
- **Orient, don't over-explain**: State clearly what the screen is for.
- Sentence case for descriptions, title case or sentence case for headlines.
- Examples:
  - *Login*: "Welcome back" — "Sign in to manage your Facebook pages and scheduled content."
  - *Signup*: "Create your account" — "Start scheduling and auto-publishing Facebook Reels in minutes."
  - *Settings*: "Account settings" — "Manage your profile, team members, and preferences."

### Form Fields & Helper Text
- **Label**: Clear, specific noun phrase ("Email address", "Full name", "Workspace name").
- **Placeholder**: Realistic, representative example or omitted if the label is obvious ("name@company.com", not "Enter your valid email string here").
- **Helper text**: Only include when genuinely necessary to guide user decisions, never to explain backend regex.
  - Good: "Your workspace URL will be: company.vinsmokemedia.online"
  - Bad: "Dots and plus tags will be stripped"

### Buttons & Action Controls
- Action-oriented verbs: `[Verb] [Object]`
- Examples: "Sign in", "Create account", "Connect Facebook Page", "Schedule post", "Save changes".
- Avoid ambiguous or passive labels: "OK", "Submit", "Proceed", "Click here".

### Empty States
- Acknowledge current state + highlight benefit + single clear call-to-action:
  - Headline: "No scheduled posts yet"
  - Description: "Upload your video reels and set a publishing slot to get started."
  - Action button: "Upload media"
