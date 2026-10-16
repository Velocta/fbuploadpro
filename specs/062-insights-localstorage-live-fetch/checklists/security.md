# Security & Data Isolation Checklist: Live Facebook Insights

**Feature**: [spec.md](../spec.md)
**Created**: 2026-10-16

## Security Standards

- [x] Zero Facebook access token exposure in API responses (`GET /api/tenant/[subdomain]/pages/[pageId]/insights`)
- [x] Zero Facebook access token storage in browser `localStorage` (only sanitized `PageInsightsResponse` payload)
- [x] AES-256-GCM token decryption occurs strictly on the server
- [x] Cross-tenant page access returns 403 Forbidden or 404 Not Found
- [x] Private browsing mode handles `localStorage` quota and permission restrictions gracefully without crashing
- [x] Corrupted or tampered `localStorage` entries are safely discarded and evicted
