# Feature Specification: 020 Post-Authentication Workspace Home Landing Route

**Feature ID**: `020-post-auth-home-landing`  
**Created**: 2026-10-09  
**Status**: Ready for Planning  
**Input**: User directives: "Make the home default landing page after auth either login create account or reset password" & clarification answers: (1) After setting password on reset flow, redirect user to login with success notice, then take them to Home upon signing in; (2) Canonical URL is tenant subdomain root (`https://[subdomain].fbuploadpro.com/` in production, `http://[subdomain].localhost:3000/` in dev) which rewrites to `/tenant/[subdomain]`, preserving valid `returnUrl` deep links.

---

## 1. Executive Summary

Following the removal of legacy dashboard pages and the implementation of the pure sidebar-only App Shell (Spec 019), the application needs to ensure all post-authentication entry points seamlessly route users to their canonical **Workspace Home** landing page (`https://[subdomain].fbuploadpro.com/` or `http://[subdomain].localhost:3000/`).

Previously, login, registration OTP verification, and session redirection logic defaulted to `/dashboard` (which no longer exists) or had ambiguous post-recovery states. This specification establishes a unified, secure, and intuitive routing contract:
1. **Sign In (`/login`)**: Default destination on successful credential authentication is the tenant's workspace root (`https://${subdomain}.${rootDomain}/`), rewriting directly to the workspace Home view (`/tenant/[subdomain]`), unless a sanitized `returnUrl` is supplied.
2. **Account Creation & OTP Verification (`/signup` -> `/verify-otp`)**: Default destination upon successful 6-digit OTP verification and provisioning is the tenant's workspace root (`https://${subdomain}.${rootDomain}/`).
3. **Password Recovery (`/forgot-password`)**: Following 6-digit OTP verification and successful submission of a new password, the user is redirected to the central Sign In page (`/login`) accompanied by a clear, accessible confirmation message ("Password updated successfully. Please sign in with your new credentials."). Upon signing in, they are immediately brought to their workspace Home page.
4. **Central Gateway Session Forwarding (`app.${rootDomain}`)**: If an already authenticated user accesses the central gateway root (`/`), `/login`, or `/signup`, the middleware cleanly redirects them to their tenant workspace root (`https://${session.subdomain}.${rootDomain}/`), eradicating obsolete references to `/dashboard`.
5. **Open-Redirect & Security Defense**: Strict protocol, origin, and subdomain validations are preserved in `sanitizeAuthRedirectUrl` to prevent open-redirect vulnerabilities.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 - Sign In Default Landing on Workspace Home (Priority: P1) 🎯 MVP

As an authenticated operator signing in with my credentials, I want to land directly on my workspace Home page instead of an obsolete `/dashboard` route, so that I immediately see my workspace overview and sidebar tools.

**Acceptance Scenarios**:
1. **Given** a user submitting valid credentials on `/login` without a `returnUrl`, **When** authentication succeeds, **Then** the API response `redirectUrl` is `http(s)://${subdomain}.${rootDomain}/`.
2. **Given** a user submitting valid credentials on `/login` with a valid, internal `returnUrl` (e.g. `/tenant/acme/accounts`), **When** authentication succeeds, **Then** the sanitized `returnUrl` takes precedence and the user is redirected to that specific deep link.
3. **Given** an invalid or open-redirect `returnUrl` (e.g. `//evil.com` or `https://malicious.com`), **When** authentication succeeds, **Then** the redirection safely falls back to the tenant workspace root (`http(s)://${subdomain}.${rootDomain}/`).

---

### User Story 2 - Account Creation (Signup & OTP) Default Landing on Workspace Home (Priority: P1) 🎯 MVP

As a newly registered operator verifying my 6-digit OTP, I want to be redirected directly to my newly provisioned workspace Home page, so that I can begin setting up my workspace immediately.

**Acceptance Scenarios**:
1. **Given** a user verifying their 6-digit signup OTP on `/api/auth/signup/verify-otp`, **When** verification and user provisioning succeed, **Then** the API response `redirectUrl` is `http(s)://${subdomain}.${rootDomain}/`.
2. **Given** the client receives the successful verification response, **When** navigating to the `redirectUrl`, **Then** the browser lands on the tenant workspace root, rendering the Home page in the pure sidebar shell.
3. **Given** a valid `returnUrl` supplied during registration, **When** verified, **Then** `sanitizeAuthRedirectUrl` honors the deep link within the user's authorized subdomain.

---

### User Story 3 - Password Reset Transition to Sign In with Success Feedback (Priority: P1) 🎯 MVP

As an operator resetting my password, I want to be redirected to the Sign In page with a clear success notification after creating my new password, so that I can authenticate with my new credentials and land directly on my workspace Home.

**Acceptance Scenarios**:
1. **Given** a user completing Step 2 on `/forgot-password` (entering 6-digit OTP and new password), **When** `/api/auth/reset-password` succeeds, **Then** the UI displays an accessible success state confirming the password update.
2. **Given** the successful password update, **When** the redirect executes (or user clicks "Sign In"), **Then** the user is navigated to `/login?reset=success`.
3. **Given** the user lands on `/login?reset=success`, **When** the login page renders, **Then** a prominent success banner is displayed ("Password updated successfully. Please sign in with your new password.").
4. **Given** the user signs in with their new password, **When** authentication completes, **Then** they land on their workspace Home page.

---

### User Story 4 - Central App Gateway & Middleware Root Forwarding (Priority: P2)

As an authenticated user navigating to the central app root or login page, I want the system to cleanly route me to my tenant workspace Home page, so that I don't see unneeded auth screens or dead routes.

**Acceptance Scenarios**:
1. **Given** an authenticated user accessing `http(s)://app.${rootDomain}/`, `http(s)://app.${rootDomain}/login`, or `http(s)://app.${rootDomain}/signup`, **When** middleware processes the request, **Then** it redirects them to `http(s)://${session.subdomain}.${rootDomain}/` (Home), not `/dashboard`.
2. **Given** the tenant subdomain root (`http(s)://${subdomain}.${rootDomain}/`), **When** middleware rewrites the request, **Then** it cleanly maps to `/tenant/${subdomain}` rendering `TenantIndexPage`.

---

## 3. Requirements & Constraints

1. **Eradication of `/dashboard`**: Zero references to `/dashboard` across auth redirection logic, login API, verify-otp API, middleware, and tests.
2. **Subdomain Root Standard**: Canonical post-auth URL format is `${protocol}://${userSubdomain}.${rootDomain}/` (or `/tenant/${userSubdomain}` when operating without subdomains).
3. **Strict Open-Redirect Sanitization**: Ensure all relative and absolute redirects are strictly validated against the user's authorized tenant subdomain.
4. **Zero Flake Quality Gate**: All tests in `@fbuploadpro/contracts`, `@fbuploadpro/database`, `@fbuploadpro/worker`, and `apps/web` must pass with 100% success.
