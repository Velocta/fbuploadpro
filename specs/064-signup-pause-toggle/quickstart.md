# Quickstart: Testing the Signup Pause Toggle

### 1. Enable Signups (Default)
```bash
# In .env.local:
NEXT_PUBLIC_SIGNUPS_ENABLED="true"
```
Navigate to `http://localhost:3000/signup`. The full registration form renders normally.

### 2. Pause Signups
```bash
# In .env.local:
NEXT_PUBLIC_SIGNUPS_ENABLED="false"
```
1. Navigate to `http://localhost:3000/signup`. The branded "Registration is temporarily paused" card renders with a direct button to `/login`.
2. Send a `POST` request to `/api/auth/signup`:
   ```bash
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"name":"Tester","email":"test@gmail.com","phone":"+15551234567","password":"Password123!"}'
   ```
   *Expected response*: HTTP 403 `{"error": "Account registration is temporarily paused. Please check back shortly or sign in to your existing account."}`.
