# Data Model & Configuration Contract: Spec 064

## 1. Environment Variable Specification

| Variable | Type | Allowed Values | Default | Scope |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SIGNUPS_ENABLED` | String | `'true'`, `'false'`, `'1'`, `'0'`, `'off'`, `'disabled'` | `'true'` | Public client & server |
| `ENABLE_SIGNUPS` | String (Fallback) | Same as above | `'true'` | Server-side fallback |

## 2. API Response Schema (When Paused)

```json
{
  "error": "Account registration is temporarily paused. Please check back shortly or sign in to your existing account."
}
```
HTTP Status: `403 Forbidden`
Content-Type: `application/json`
