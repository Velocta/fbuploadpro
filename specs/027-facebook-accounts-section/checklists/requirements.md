# Requirements Checklist: Spec 027 Facebook Accounts Section

## Domain Requirements
- [ ] Dedicated accounts page at `/tenant/[subdomain]/accounts`
- [ ] Pure Facebook Accounts scope (zero pages, zero group references)
- [ ] Account status domain strictly `['active', 'disconnected', 'expired']`
- [ ] Minimalist health display: no operational/health badges or dots when `active`
- [ ] Warning callout and Reconnect button appear strictly when `status === 'expired'`
- [ ] Reconnect button hidden when `status === 'active'`
- [ ] Disconnect confirmation dialog with cascade impact warning and confirmation buttons
- [ ] Dual-mode connection modal offering Direct Connection and Magic Link
- [ ] Direct Connection full-page redirect to Facebook OAuth dialog
- [ ] Magic Link generates 15-minute cryptographically signed link with 1-click copy button
- [ ] Pure automatic 3-second background polling while Magic Link modal is open
- [ ] Standalone remote success page at `/connect/facebook/success`
- [ ] Dismissible green banner on `?connected=1` with URL cleanup
- [ ] 100% theme token compliance, zero hardcoded hex colors, zero capsule pills
- [ ] Absolute immutability of `DESIGN.md` preserved
