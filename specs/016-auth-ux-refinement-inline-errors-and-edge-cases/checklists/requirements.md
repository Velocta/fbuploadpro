# Requirements Checklist: Auth UX Refinement, Inline Errors & Edge-Case Hygiene (Spec 016)

- [x] **CH-01: Field-Level Error Visuals**
  - [x] Every invalid input renders with red border (`border: 1px solid var(--accent-3)`).
  - [x] Every invalid input renders with `aria-invalid="true"`.
  - [x] Every invalid input has `<span role="alert">` displaying the specific error text directly below the field.
  - [x] Red glow focus ring is applied when an errored input is focused.

- [x] **CH-02: Elimination of Bulky Alert/Dialogue Error Boxes**
  - [x] Top `<Alert severity="error">` removed for field validation on `/login`.
  - [x] Top `<Alert severity="error">` removed for field validation on `/signup`.
  - [x] Top `<Alert severity="error">` removed for field validation on `/forgot-password`.
  - [x] Top `<Alert severity="error">` removed for field validation on `/reset-password`.

- [x] **CH-03: Phone Number Edge-Case Validation**
  - [x] Input `asdf` triggers inline error on phone input stating country code with `+` is required.
  - [x] Input `+32433` triggers inline error on phone input indicating invalid or incomplete international number.
  - [x] Valid phone numbers (`+15551234567`, `+923001234567`) validate cleanly.
  - [x] Form submission is prevented client-side when phone number is invalid.

- [x] **CH-04: Server Error Detail Mapping**
  - [x] HTTP 400 responses with `{ error: 'Validation failed', details: { ... } }` are unpacked into `fieldErrors`.
  - [x] Generic "Validation failed" string is NEVER presented to the user.
  - [x] Each server-returned field error is displayed beneath the corresponding input field.

- [x] **CH-05: Password Strength Meter Removal**
  - [x] `<PasswordStrengthMeter>` component is removed from `/signup`.
  - [x] Helper text "Minimum 8 characters" is maintained cleanly.
  - [x] No regression in password length or validation requirements.

- [x] **CH-06: Compact Form Error Callout**
  - [x] `<FormErrorCallout>` is rendered directly above the primary submit button.
  - [x] Used strictly for general form-level errors (bad credentials, rate limits, network errors).
  - [x] Styled with subtle background, theme tokens, and zero jarring layout jumps.

- [x] **CH-07: Hybrid Live Error Clearing**
  - [x] Typing into an invalid field immediately clears that field's error state.
  - [x] Typing in any field clears the general error callout.
