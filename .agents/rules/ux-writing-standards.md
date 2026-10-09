# Universal UX Writing Standards & Public Web App Tone Enforcement

**Canonical Authority**: [`.agents/skills/ux-writing/SKILL.md`](../skills/ux-writing/SKILL.md)  
**Governing Rule**: All user-facing text across the entire web application MUST be professional, clear, human, and outcome-oriented.

---

## 1. Core Mandate: Commercial SaaS Tone Across All Surfaces

FBUploadPro is a public commercial product designed for creators, digital agencies, and business operators. Every user-visible text element—including page headers, navigation, interface metrics, modal dialogs, form labels, placeholder text, helper instructions, validation feedback, error banners, empty states, and action buttons—must adhere to professional software standards.

> **CRITICAL DIRECTIVE**: Never write robotic, lazy, or engineer-slop copy. Software must speak to users in the language of their domain and workflows, never in the vocabulary of internal implementation details.

---

## 2. Universal Prohibitions & Architectural Rules

### A. Total Prohibition on Technical Plumbing Leaks
Engineers and AI agents must never expose internal software mechanics to the user interface:
* **Zero Database / Schema Jargon**: Never mention data types, column constraints, storage engines, hashing, unique index collisions, or backend data normalization.
* **Zero Regex or Sanitization Logic**: Never explain regex patterns, character-stripping algorithms, or string manipulation mechanics in helper copy. Instead, show clear, polished examples of the expected input or output.
* **Zero Infrastructure / Architecture Terminology**: Never refer to multi-tenant isolation containers, deployment pipelines, routing gateways, or server environments in user workflows. Frame every screen and control around the user's workspace, content, and goals.

---

### B. Total Prohibition on Decorative & Simulated Status Signals
The platform strictly forbids fake or decorative "operational / system status" indicators:
* **No Cosmetic Status Signals**: Never place static status dots, "Online", "Ready", "Operational", or "System Active" badges on authentication cards, page headers, form wrappers, or general containers.
* **Strict Entity-Bound Scope for Indicators**: Status dots (`StatusDot`, `STATUS_SIGNALS`) are strictly reserved for authentic, dynamic runtime states of live domain entities:
  - Third-party OAuth connection health (e.g., active Facebook Page token, expired access token).
  - Background asynchronous task states (e.g., publishing queue item pending, actively streaming, failed).
* Standard navigation, onboarding, authentication, and content views must never feature simulated system-monitoring signals.

---

### C. Constructive, Empathetic Error Design
Error messages must guide the user forward without blame, cryptic status codes, or robotic jargon:
1. **Explain what happened** using straightforward, human language.
2. **Clarify the reason** without technical jargon or fault attribution.
3. **Provide a clear next step** or recovery action.
* Never use cold, bureaucratic titles (e.g., "Operation Error", "Validation Failure"). Use conversational, helpful headlines (e.g., "Couldn't complete request", "Please verify your details").

---

### D. Action-Oriented Microcopy
* **Buttons & Actions**: Must use explicit active verbs describing what will occur (`[Verb] [Object]`, e.g., "Schedule reel", "Connect Facebook Page", "Save changes"), avoiding generic labels ("Submit", "OK", "Click here").
* **Empty States**: Must acknowledge the empty state warmly, explain the immediate value of adding data, and provide a direct call-to-action button to create or import content.

---

## 3. The 4 Quality Standards for Every UI String

1. **Purposeful**: Every single word must have a distinct job. Eliminate filler, preamble, and self-evident explanations.
2. **Concise**: Keep titles under 6 words, descriptions under 16 words, and action labels under 3 words.
3. **Conversational**: Use natural sentence rhythm, active voice (85%+), and standard everyday vocabulary.
4. **Clear**: Eliminate ambiguity. Ensure content is readable at an 8th-grade level without domain jargon.
