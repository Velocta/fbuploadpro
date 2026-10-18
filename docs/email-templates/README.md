# Transactional Email Templates (Supabase Auth OTP)

This directory contains the production-ready responsive email templates for FBUploadPro's 6-digit numeric OTP authentication lifecycle powered by native Supabase Auth over SMTP.

---

## 1. Templates Overview

The platform uses **2 official email OTP templates**:

| Template | File | Trigger / Auth Flow | Supabase Dashboard Tab | Recommended Subject Line |
| :--- | :--- | :--- | :--- | :--- |
| **OTP Verification** | [`otp-verification.html`](otp-verification.html) | Registration / Email Confirmation (`/signup?step=otp`) | **Confirm signup** | `{{ .Token }} is your FBUploadPro verification code` |
| **Forgot Password OTP** | [`forgot-password-otp.html`](forgot-password-otp.html) | Account Recovery / Password Reset (`/forgot-password`) | **Reset password** | `{{ .Token }} is your FBUploadPro password reset code` |

---

## 2. Supabase Dashboard Setup Instructions

### Step 1: Open Email Templates in Supabase
1. Navigate to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the sidebar, navigate to **Authentication** $\rightarrow$ **Email Templates**.

---

### Step 2: Configure "Confirm signup" (OTP Verification)
1. In the template list, select **Confirm signup**.
2. **Subject line**:
   ```text
   {{ .Token }} is your FBUploadPro verification code
   ```
3. **Message body (HTML)**:
   - Clear any existing content.
   - Copy and paste the entire HTML contents of [`docs/email-templates/otp-verification.html`](otp-verification.html).
4. Click **Save Changes**.

---

### Step 3: Configure "Reset password" (Password Recovery OTP)
1. In the template list, select **Reset password**.
2. **Subject line**:
   ```text
   {{ .Token }} is your FBUploadPro password reset code
   ```
3. **Message body (HTML)**:
   - Clear any existing content.
   - Copy and paste the entire HTML contents of [`docs/email-templates/forgot-password-otp.html`](forgot-password-otp.html).
4. Click **Save Changes**.

---

## 3. Supported GoTrue Template Variables

Supabase GoTrue automatically interpolates the following variables when generating outgoing emails:

| Variable | Description |
| :--- | :--- |
| `{{ .Token }}` | The 6-digit numeric one-time authentication code (e.g. `839201`). |
| `{{ .Email }}` | The recipient's canonical email address. |
| `{{ .SiteURL }}` | The configured application gateway URL (e.g. `https://app.fbuploadpro.com`). |
| `{{ .ConfirmationURL }}` | Direct link fallback URL (if link verification is ever enabled). |

---

## 4. Plain-Text Fallback Templates

For transactional email relays or recipients with HTML rendering disabled:

### A. OTP Verification (Plain Text)
```text
Verify your email address - FBUploadPro

Welcome to FBUploadPro. To complete your registration and activate your workspace, please use the following one-time verification code:

Verification Code: {{ .Token }}

This code expires in 10 minutes and can only be used once.

Security notice: Never share this verification code with anyone. FBUploadPro support representatives will never ask for your code. If you did not create an account, you can safely ignore this message.

This automated notification was sent to {{ .Email }}.
© 2026 FBUploadPro. High-throughput Facebook publishing infrastructure.
```

### B. Forgot Password OTP (Plain Text)
```text
Reset your password - FBUploadPro

We received a request to reset the password for your FBUploadPro account. Enter the verification code below to verify your identity and choose a new password:

Password Reset Code: {{ .Token }}

This code expires in 10 minutes and can only be used once.

If you did not request a password reset, no changes have been made to your account and you can safely ignore this email.

This automated notification was sent to {{ .Email }}.
© 2026 FBUploadPro. High-throughput Facebook publishing infrastructure.
```

---

## 5. Visual Styling & Compatibility

- **Official Brand Mark Integration**: Features the official 4-path SVG vector geometry from `Spec 054` (`#fad734` gold arrow/spine, specular highlight, `#b29527` middle crossbar, `#766018` queue slot anchor) paired with the canonical `FBUploadPro` logotype.
- **Palette Conformance**: Dark-canvas aesthetic aligned with FBUploadPro design system tokens (`#080b11` canvas, `#0f141f` card surface, `#1c2436` border, `#fad734` primary accent, `#ffffff` foreground).
- **Client Compatibility**: Built with cross-client table layout, inline CSS, and Outlook MSO conditionals. Tested for:
  - Gmail (Web, iOS app, Android app)
  - Apple Mail (macOS, iOS)
  - Microsoft Outlook (Desktop 2016/2019/365, Web, Mobile)
  - ProtonMail, Yahoo Mail, and Fastmail.
- **Hidden Preheader**: Includes preheader spacing hack to cleanly display the subject and code preview in email client notification summaries.
