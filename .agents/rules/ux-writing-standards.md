# Professional UX Writing Standards & Public Webapp Tone Enforcement

**Canonical Authority**: [`.agents/skills/ux-writing/SKILL.md`](../skills/ux-writing/SKILL.md)  
**Governing Rule**: All user-facing copy in public web applications MUST sound human, professional, clear, and trustworthy.

---

## 1. Core Principle: Public Web App Professionalism

FBUploadPro is a public commercial SaaS product used by creators, marketers, agencies, and business owners. All user-visible copy—headings, subtext, form labels, placeholders, helper text, error alerts, empty states, and button labels—must be written with high-craft editorial care.

> **CRITICAL DIRECTIVE**: Never write robotic, lazy, or engineer-slop copy. Avoid exposing technical plumbing, internal architectural constraints, regex sanitization logic, or database implementation details in user-facing UI.

---

## 2. Forbidden Anti-Patterns vs. Required Human SaaS Standards

### A. Leaking Internal Technical / Database Plumbing
* ❌ **STRICTLY FORBIDDEN**: Exposing regex logic, string sanitization, database constraints, or hashing algorithms in UI helper text:
  - *Violation*: `"Dots and plus tags will be automatically stripped for your subdomain"`
  - *Violation*: `"Must not exceed varchar(255) character limit"`
  - *Violation*: `"Tenant derived via email split regex"`
* ✅ **MANDATED**: Show user benefit or clean preview examples without mentioning code:
  - *Standard*: `"Workspace URL: yourname.vinsmokemedia.online"`
  - *Standard*: Keep helper text focused on user value or omit if the field is self-explanatory.

---

### B. DevOps & Infrastructure Terminology Cosplay
* ❌ **STRICTLY FORBIDDEN**: Using DevOps, cloud infrastructure, or multi-tenant system terms on customer-facing screens:
  - *Violation*: `"Deploy your automated workspace"` (Users create accounts; they don't deploy clusters).
  - *Violation*: `"Enter credentials to access your isolated workspace"` (Sounds like a quarantine or Kubernetes pod).
  - *Violation*: `"FBUploadPro Gateway"` (This is a login page, not an API gateway).
* ✅ **MANDATED**: Use clear, welcoming, standard SaaS language:
  - *Standard*: `"Create your account"` — `"Start scheduling and publishing Reels across your Facebook pages."`
  - *Standard*: `"Welcome back"` — `"Sign in to manage your pages and scheduled content."`

---

### C. Fake "Operational / Server Status" Dots & Monitoring Cosplay
* ❌ **STRICTLY FORBIDDEN**: Adding decorative or fake status dots (`Ready`, `Online`, `Operational`, `Standby`, etc.) to:
  - Login / Sign in cards and headers
  - Signup / Registration cards
  - Standard page titles, form headers, and navigation bars
  - Generic UI components to simulate "system health"
* ✅ **MANDATED**: Status dots are **strictly and exclusively** reserved for real entity runtime state:
  - A connected Facebook Page's live token health in account settings (`active`, `expired`, `invalid`).
  - A queued post's execution status in the publishing timeline (`queued`, `publishing`, `failed`).
  - Standard authentication and marketing pages must never display fake server monitor badges.

---

### D. Blaming or Robotic Error Messages
* ❌ **STRICTLY FORBIDDEN**: Cold, bureaucratic, or accusatory error titles:
  - *Violation*: `"Registration Error"`, `"Sign In Error"`, `"Invalid input provided"`, `"Error 400"`.
* ✅ **MANDATED**: Polite, clear, empathetic messages explaining what happened and how to recover:
  - *Standard*: `"Couldn't sign you in"` — `"Please check your email address and password, then try again."`
  - *Standard*: `"Unable to create account"` — `"An account with this email already exists. Try signing in instead."`

---

## 3. The 4 Quality Standards for Every UI String

1. **Purposeful**: Every single word must earn its place on the screen. If removing a word doesn't change meaning, remove it.
2. **Concise**: Keep titles under 6 words, descriptions under 16 words, and button labels to 2–3 active words (`[Verb] [Object]`).
3. **Conversational**: Write like a helpful, articulate human product designer. Use active voice 85%+ of the time.
4. **Clear**: Avoid jargon. Aim for 7th-to-8th grade reading level for consumer-facing text.
