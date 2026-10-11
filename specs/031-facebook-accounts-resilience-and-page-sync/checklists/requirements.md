# Specification Quality Checklist: Facebook Accounts Resilience, Page Token Sync, Expandable Linked Pages & Reconnect Mismatch Guard

**Feature**: [`spec.md`](../spec.md)

## Content & Architecture Quality
- [x] Remote Magic Link errors and cancellations (`isMagic: true`) route exclusively to `/connect/facebook/error?reason=...`
- [x] Auto-refresh of `encrypted_page_token` updates all connected pages belonging to the account while setting `status = 'active'` strictly for `'invalid_token'` pages
- [x] `AccountCard` avatar handles `onError` and falls back to monogram initials
- [x] Linked pages are expandable on `AccountCard` and explicitly listed inside `DisconnectAccountDialog`
- [x] Reconnect wrong-account mismatch displays `"You signed into {newAccountName} instead of {expectedAccountName}. {expectedAccountName} still needs to be reconnected."` while still saving the newly authorized account
- [x] Connecting an already-connected account via Direct or Magic Link refreshes its token, sets status to `'active'` if expired, and displays `"This Facebook account ({accountName}) is already connected — its session was refreshed."`
- [x] Strictly adheres to `apps/web/src/lib/theme.ts` and `DESIGN.md` immutability
