# Quickstart & Verification Guide: 046 Downloader and Media Library Audit Remediation

## 1. Automated Test Verification

### Contracts Tests
```bash
pnpm --filter @fbuploadpro/contracts test
```
Validates:
- `CheckDuplicatesRequestSchema` accepts per-entry `folderId`.
- `AspectRatioSchema` includes `'4:5'`.

### Edge Worker Downloader Engine Tests
```bash
pnpm --filter @fbuploadpro/worker test
```
Validates:
- `downloader-engine.ts` runs without querying `user_storage_quotas`.
- Link resolution handles Google Drive virus-scan bypass (`confirm=t`).
- `fail_stuck_download_jobs` marks stalled jobs as failed after 15 minutes.

### Web Media Library Tests
```bash
pnpm --filter @fbuploadpro/web test
```
Validates:
- Metadata extraction outputs `width`, `height`, and generated WebP poster frame blob.
- `hasInitialData` does not block subsequent folder navigation, sorting, or searching.
- R2 upload URL generation preserves non-Latin Unicode characters.
- Media Downloader retries using original failed entry folder.
