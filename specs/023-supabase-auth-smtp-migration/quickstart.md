# Quickstart & Verification Guide: Spec 023 — Supabase Auth Native SMTP OTP Delivery

## 1. Supabase Dashboard Configuration Checklist
To enable custom SMTP in your Supabase project:
1. Open [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication > SMTP Settings**.
3. Enable **Custom SMTP** and input your SMTP credentials (Host, Port, User, Pass, Sender Name & Email).
4. Go to **Authentication > Email Templates**:
   - **Confirm signup**: In the template, include `{{ .Token }}` where the 6-digit code should appear.
   - **Reset password**: In the template, include `{{ .Token }}` where the 6-digit code should appear.

## 2. Local & CI Verification
```bash
# Verify no references to resend remain
git grep "resend" apps/web/src/lib/email-service.ts # Should return nothing (file deleted)

# Run test suites
pnpm turbo run test --filter=@fbuploadpro/web
pnpm turbo run build lint typecheck test
```
