# Quickstart & Verification Guide: WhatsApp Support Button

**Feature**: `063-whatsapp-support-button`  

## Configuration

In `apps/web/.env.local` (or environment variables):

```env
# WhatsApp Customer Support
NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER="+15551234567"
NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE="Hello! I need help with FBUploadPro."
```

## How to Test

1. **Unit Tests**:
   Run the unit test suite verifying URL construction and number sanitization:
   ```bash
   pnpm --filter @fbuploadpro/web test tests/unit/whatsapp.test.ts
   ```

2. **Component UI Tests**:
   Run the UI test suite verifying rendering in the DOM, link attributes (`target="_blank"`, `rel="noopener noreferrer"`), and accessibility attributes:
   ```bash
   pnpm --filter @fbuploadpro/web test tests/ui/whatsapp-support-button.test.tsx
   ```

3. **Visual Verification**:
   - Start the web app: `pnpm --filter @fbuploadpro/web dev`
   - Visit any page: `http://localhost:3000/login`, `http://localhost:3000/signup`, or `http://localhost:3000/tenant/demo`
   - Observe the floating WhatsApp button in the bottom right corner.
   - Click the button to confirm WhatsApp opens with the pre-filled message.
