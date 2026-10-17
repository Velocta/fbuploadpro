# Transactional Email Templates (Supabase Auth OTP)

This directory contains the production-ready responsive email templates for FBUploadPro's 6-digit numeric OTP authentication lifecycle powered by native Supabase Auth over SMTP.

---

## 1. Templates Overview

| Template | File | Trigger / Auth Flow | Supabase Dashboard Tab | Recommended Subject Line |
| :--- | :--- | :--- | :--- | :--- |
| **OTP Verification** | [`otp-verification.html`](otp-verification.html) | Registration / Email Confirmation (`/signup?step=otp`) | **Confirm signup** | `{{ .Token }} is your FBUploadPro verification code` |
| **Forgot Email OTP** | [`forgot-email-otp.html`](forgot-email-otp.html) | Account Recovery / Password Reset (`/forgot-password`) | **Reset password** | `{{ .Token }} is your FBUploadPro password reset code` |

*(Note: [`forgot-password-otp.html`](forgot-password-otp.html) is also provided as a convenient alias with identical content).*

---

## 2. Supabase Dashboard Setup Instructions

### Step 1: Open Email Templates in Supabase
1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the sidebar, go to **Authentication** $\rightarrow$ **Email Templates**.

---

### Step 2: Configure "Confirm signup" (OTP Verification)
1. In the template list, select **Confirm signup**.
2. **Subject line**:
   ```text
   {{ .Token }} is your FBUploadPro verification code
   ```
3. **Message body (HTML)**:
   - Clear existing content.
   - Copy and paste the entire HTML contents of [`docs/email-templates/otp-verification.html`](otp-verification.html).
4. Click **Save Changes**.

---

### Step 3: Configure "Reset password" (Forgot Email OTP)
1. In the template list, select **Reset password**.
2. **Subject line**:
   ```text
   {{ .Token }} is your FBUploadPro password reset code
   ```
3. **Message body (HTML)**:
   - Clear existing content.
   - Copy and paste the entire HTML contents of [`docs/email-templates/forgot-email-otp.html`](forgot-email-otp.html).
4. Click **Save Changes**.

---

## 3. Supported GoTrue Template Variables

Supabase GoTrue automatically interpolates the following variables when generating outgoing emails:

| Variable | Description |
| :--- | :--- |
| `{{ .Token }}` | The 6-digit numeric one-time authentication code (e.g. `839201`). |
| `{{ .Email }}` | The recipient's email address. |
| `{{ .SiteURL }}` | The configured central application gateway URL (e.g. `https://app.vinsmokemedia.online`). |
| `{{ .ConfirmationURL }}` | Direct link fallback URL (if link verification is ever toggled). |

---

## 4. Plain-Text Fallback Templates

For transactional email relays or recipients with HTML rendering disabled, use these plain-text versions:

### A. OTP Verification (Plain Text)
```text
Verify your email address - FBUploadPro

Welcome to FBUploadPro. To complete your registration and activate your workspace, please use the following one-time verification code:

Verification Code: {{ .Token }}

This code expires in 10 minutes and can only be used once.

Security notice: Never share this verification code with anyone. FBUploadPro support will never ask for your code. If you did not create an account, you can safely ignore this message.

This automated notification was sent to {{ .Email }}.
© 2026 FBUploadPro. All rights reserved.
```

### B. Forgot Email OTP (Plain Text)
```text
Reset your password - FBUploadPro

We received a request to reset the password for your FBUploadPro account. Enter the verification code below to verify your identity and choose a new password:

Password Reset Code: {{ .Token }}

This code expires in 10 minutes and can only be used once.

If you did not request a password reset, no changes have been made to your account and you can safely ignore this email.

This automated notification was sent to {{ .Email }}.
© 2026 FBUploadPro. All rights reserved.
```

---

## 5. Visual Styling & Compatibility

- **Palette Conformance**: Dark-canvas aesthetic aligned with FBUploadPro (`#0b0e14` canvas, `#121722` surface, `#1f2736` border, `#fad734` primary accent, `#ffffff` foreground).
- **Client Compatibility**: Built with cross-client table layout, inline CSS, and Outlook MSO conditionals. Tested for:
  - Gmail (Web, iOS app, Android app)
  - Apple Mail (macOS, iOS)
  - Microsoft Outlook (Desktop 2016/2019/365, Web, Mobile)
  - ProtonMail, Yahoo Mail, and Fastmail.
- **Hidden Preheader**: Includes preheader spacing hack to cleanly display the subject and code preview in email client notification summaries.
