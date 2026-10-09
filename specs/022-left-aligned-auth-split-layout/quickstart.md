# Quickstart & Verification Guide: Spec 022 — Left-Aligned Authentication Split Layout

## 1. Quick Verification
To verify the left-aligned layout:
1. Run local dev server: `pnpm --filter @fbuploadpro/web dev`
2. Open desktop browser ($\ge 1024\text{px}$) to `http://app.localhost:3000/login`:
   - Verify the login form card appears on the left half of the screen.
   - Verify the FBUploadPro brand & security showcase panel appears on the right half with subtle outer glow and a left border hairline.
3. Open `http://app.localhost:3000/signup`:
   - Verify the registration form card appears on the left half of the screen.
4. Open `http://app.localhost:3000/forgot-password` and `http://app.localhost:3000/reset-password`:
   - Verify consistent left-aligned form placement.
5. Resize browser to mobile width ($< 1024\text{px}$):
   - Verify the showcase panel collapses cleanly and the form is centered full-width with the mobile brand logo at top.

## 2. Automated Test Execution
```bash
pnpm turbo run test --filter=@fbuploadpro/web
pnpm turbo run build lint typecheck test
```
