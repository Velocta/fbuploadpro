# Quickstart & Validation Guide: Spec 031 — Cloud Media Downloader

**Feature ID**: `031-cloud-media-downloader`

---

## 1. Automated Verification Commands

Run the full Turborepo quality gate across all packages:

```bash
pnpm turbo run build lint typecheck test
```

Run targeted Spec 031 test suites:

```bash
# 1. Domain Contracts, URL Deduplication & SSRF Validation
pnpm --filter @fbuploadpro/contracts test tests/downloader-contracts.test.ts

# 2. Backend Hybrid Downloader Route, R2 Streaming, Carousels & Tenant Isolation
pnpm --filter @fbuploadpro/web test tests/api/media-downloader.test.ts

# 3. Sidebar Navigation & Downloader UI Component
pnpm --filter @fbuploadpro/web test tests/ui/workspace-sidebar.test.tsx tests/ui/media-downloader.test.tsx
```

---

## 2. End-to-End User Journey Verification

1. **Sidebar Navigation**:
   - Sign in to a workspace (`https://{subdomain}.vinsmokemedia.online/`).
   - Verify **Downloader** appears directly below **Media Library** in the primary top sidebar group.
   - Click **Downloader** to open `/downloader` (`/tenant/[subdomain]/downloader`).
2. **Auto-Provisioned `Downloads` Folder & Folder Picker**:
   - Observe that the target folder dropdown automatically defaults to **`Downloads`** (creating it in the Media Library root if not yet present).
   - Click **New Folder** to create a subfolder inline or switch to any nested folder from the Media Library.
3. **Single & Batch Link Cloud Ingestion**:
   - Paste one or multiple links (one per line)—such as a direct `.mp4`/`.png` link, social post link, or OpenGraph media page—and click **Save to Media Library**.
   - Verify the unified batch progress bar tracks completion (`Saving X of Y links to Media Library...`) without triggering any browser file download to your PC.
   - Verify each saved item appears in **Recent Downloads** with its extracted post caption, file size, folder path, and **Open in Folder** button.
   - Click **Open in Folder** to jump straight to that folder in the Media Library (`/media?folder=<id>`) and see the newly saved asset(s).
