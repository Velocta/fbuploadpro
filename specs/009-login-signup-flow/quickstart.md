# Quickstart & Developer Validation Guide: Spec 009 Auth

## 1. Environment Setup

Configure `.env.local` or environment variables in `apps/web`:
```bash
NEXT_PUBLIC_ROOT_DOMAIN="localhost:3000" # or fbuploadpro.com
SESSION_SECRET="super-secret-session-signing-key-minimum-32-chars-long"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

---

## 2. Testing Endpoints via cURL

### 1. Test Registration
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Tester",
    "phone": "+1234567890",
    "email": "jane.tester+test@example.com",
    "password": "Password123!"
  }'
```
Expected output:
* HTTP 201 Created
* `redirectUrl: "http://janetester.localhost:3000/dashboard"`
* `Set-Cookie: fbup_session=...; HttpOnly; SameSite=Lax; Path=/`

### 2. Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.tester+test@example.com",
    "password": "Password123!"
  }'
```

### 3. Test Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout
```

---

## 3. Running Automated Tests

```bash
export PATH="/home/agent/.local/nodejs/bin:$PATH"
pnpm turbo run test --filter=@fbuploadpro/web
```
