# RLS Overview

## Principle

RLS is enabled on application tables. Access is granted through role-based policies and service-role policies where automation requires elevated privileges.

## Current Service-Role Policies

- `public.errors`: `"Service role full access"`
- `public.auth_attempts`: `"Service role full access"`

## User-Facing Policy Model

- Agencies manage their own records for pages/accounts/reels through auth UID checks.
- Super-admin can view/manage global records where explicitly allowed.
- System settings are globally readable and super-admin writable.

## Governance Rule

Any policy change must be made in:

1. The migration file in `database/migrations/`.
2. `database/production_schema.sql`.
