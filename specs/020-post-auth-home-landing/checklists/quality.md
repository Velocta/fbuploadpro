# Quality & Security Checklist: 020 Post-Authentication Workspace Home Landing Route

- [ ] **Open Redirect Defense**: Verify all relative and absolute URLs in `sanitizeAuthRedirectUrl` strictly validate protocol and authorized hostnames.
- [ ] **Zero Dashboard Leaks**: Verify there are no lingering `/dashboard` strings in redirect generators or auth handlers.
- [ ] **Deep Link Preservation**: Verify valid `returnUrl` parameters are honored after login and signup.
- [ ] **Password Reset Feedback**: Verify user receives explicit success feedback on `/login?reset=success`.
- [ ] **Multi-Tenant Purity**: Verify tenant root URLs cleanly map to `/tenant/[subdomain]` in Next.js middleware.
- [ ] **Automated Test Coverage**: All unit and integration tests passing with 0 failures across `@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/worker`, and `apps/web`.
