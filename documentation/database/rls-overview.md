# RLS Overview

## Principle

RLS is enabled on application tables. Access is granted through role-based policies and service-role policies where automation requires elevated privileges.

## Current Service-Role Policies

- `public.errors`: `"Service role full access"`
- `public.auth_attempts`: `"Service role full access"`
- `public.facebook_inapp_schedule_posts`: `"Service role full access"` (backend worker claims and updates posts)

## User-Facing Policy Model

- Agencies manage their own records for pages/accounts/reels through auth UID checks.
- Agencies manage their own rows in:
  - `facebook_direct_posts`
  - `facebook_direct_schedule_pages`
  - `facebook_direct_schedule_posts`
  - `facebook_inapp_schedule_pages`
  - `facebook_inapp_schedule_posts`
- Super-admin can view/manage global records where explicitly allowed.
- Super-admin has read access to all new feature tables.
- Super-admin has full access to `token_cost_rules`.
- `token_cost_rules` is globally readable (anyone can `SELECT`).
- System settings are globally readable and super-admin writable.

## Governance Rule

Any policy change must be made in:

1. The migration file in `database/migrations/`.
2. `database/production_schema.sql`.
