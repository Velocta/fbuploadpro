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

### 1. Never Leak Engineering Plumbing to Users
Users are business owners, creators, and operators—NOT backend developers or database administrators.
- **NEVER** expose regex logic, sanitation rules, or database constraints in UI labels:
  - ❌ *"Dots and plus tags will be automatically stripped for your subdomain"*
  - ❌ *"Value must satisfy PostgreSQL varchar(255) constraints"*
  - ❌ *"Subdomain derived via HMAC token"*
- **NEVER** use infrastructure or DevOps terminology where customer-facing concepts apply:
  - ❌ *"Deploy your automated workspace"* → ✅ *"Create your workspace"* or *"Start scheduling Reels"*
  - ❌ *"Access your isolated multi-tenant environment"* → ✅ *"Sign in to your account"*
  - ❌ *"FBUploadPro Gateway"* → ✅ *"Welcome back"* or *"Sign in to FBUploadPro"*

### 2. Never Use Fake "Operational / Status" Dots in Standard UI
- **NEVER** add decorative status dots (`Ready`, `Online`, `Operational`, `Standby`) to login screens, signup cards, page headers, or standard forms.
- Status dots exist **strictly** for real entity state monitoring (e.g. active Facebook Page connection status, failed publishing queue item).
- Placing green/yellow/red dots on authentication cards or generic form titles is artificial "system monitor" cosplay that looks amateurish and confusing to real users.

### 3. Never Blame the User or Show Cryptic Errors
- ❌ *"Registration Error"* / *"Invalid input"* / *"Error 422: Unprocessable Entity"*
- ✅ *"Couldn't create account"* / *"Please check your email address and try again"*
- Formula for error messages:
  1. What happened (plain terms)
  2. Why it happened (without technical blame)
  3. How to fix it (clear recovery action)

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
