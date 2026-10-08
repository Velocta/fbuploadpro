# FBUploadPro: Production Secrets & Deployment Configuration Checklist

This document details every required secret, environment variable, and credential across the FBUploadPro platform, along with exact format requirements, generation commands, and where each key must be provisioned.

---

## 1. Quick Reference: Where Secrets Belong

| Secret Key | Format / Constraint | Local `.env` | Cloudflare Worker Secret | Vercel / Web Host | GitHub Actions Secrets |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `DATABASE_URL` | PostgreSQL URI with SSL (Supabase Pooler) | ✅ | ✅ | ✅ | ✅ |
| `DATABASE_DIRECT_URL` | Unpooled PostgreSQL URI (Supabase Direct) | ❌ | ❌ | ❌ | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (`https://...`) | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Supabase Public Anon JWT | ✅ | ❌ | ✅ | ❌ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Admin Service Key | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Apex domain (`fbuploadpro.com`) | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_APP_URL` | SaaS portal gateway (`https://app.fbuploadpro.com`) | ✅ | ❌ | ✅ | ❌ |
| `NEXT_PUBLIC_MARKETING_URL` | Marketing site URL (`https://fbuploadpro.com`) | ✅ | ❌ | ✅ | ❌ |
| `SESSION_SECRET` | String, $\ge 32$ chars | ✅ | ❌ | ✅ | ❌ |
| `TOKEN_ENCRYPTION_KEY` | Exactly 64 hex chars (32 bytes) | ✅ | ❌ | ✅ | ❌ |
| `FB_ENCRYPTION_MASTER_KEY` | Identical to `TOKEN_ENCRYPTION_KEY` | ❌ | ✅ | ❌ | ❌ |
| `FACEBOOK_APP_ID` | Numeric string | ✅ | ❌ | ✅ | ❌ |
| `FACEBOOK_APP_SECRET` | 32 hex chars | ✅ | ❌ | ✅ | ❌ |
| `R2_ACCOUNT_ID` | Cloudflare Account Hex ID | ✅ | ❌ | ✅ | ❌ |
| `R2_ACCESS_KEY_ID` | R2 S3 Access Key ID | ✅ | ❌ | ✅ | ❌ |
| `R2_SECRET_ACCESS_KEY` | R2 S3 Secret Access Key | ✅ | ❌ | ✅ | ❌ |
| `R2_BUCKET_NAME` | R2 Bucket identifier | ✅ | ❌ | ✅ | ❌ |
| `R2_PUBLIC_URL` | HTTPS CDN / custom domain | ✅ | ❌ | ✅ | ❌ |
| `DEFAULT_STORAGE_QUOTA_BYTES` | Positive integer (bytes) | Optional | ❌ | Optional | ❌ |
| `CLOUDFLARE_API_TOKEN` | Bearer Token (Workers + R2) | ❌ | ❌ | ❌ | ✅ |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account Hex ID | ❌ | ❌ | ❌ | ✅ |

---

## 2. Detailed Specifications & Generation Commands

### Category A: Database Substrate (PostgreSQL)

#### `DATABASE_URL`
* **Purpose**: Primary database connection string used by both the Next.js Web App (`@fbuploadpro/database`) and Edge Worker dispatcher (`@fbuploadpro/database/edge`).
* **Format**: Standard PostgreSQL connection URI with SSL enforcement.
  ```text
  postgresql://[user]:[password]@[host]:[port]/[dbname]?sslmode=require
  ```
* **Notes**: If using connection pooling (e.g. Supabase PgBouncer or Neon connection pooler on port 6543), set this to the pooled connection string.

#### `DATABASE_DIRECT_URL`
* **Purpose**: Dedicated unpooled direct connection string used by CI/CD migrations runner to execute schema DDL without pooler limitations.
* **Format**: Standard direct PostgreSQL connection URI (e.g. port 5432).

---

### Category B: Cryptography & Security

#### `SESSION_SECRET`
* **Purpose**: Signs and verifies HMAC-SHA256 tenant session authentication tokens across subdomains.
* **Format**: Cryptographically secure random string, **minimum 32 characters**.
* **Generation Command**:
  ```bash
  openssl rand -base64 32
  ```

#### `TOKEN_ENCRYPTION_KEY` & `FB_ENCRYPTION_MASTER_KEY`
* **Purpose**: Symmetric key used for AES-256-GCM authenticated encryption of sensitive Facebook Page OAuth tokens stored in PostgreSQL.
* **Format**: **Strictly 64 hexadecimal characters** (representing 32 raw bytes / 256 bits).
* **Important**: `TOKEN_ENCRYPTION_KEY` (Web App) and `FB_ENCRYPTION_MASTER_KEY` (Worker) **must match exactly** so the worker can decrypt tokens claimed from the database during scheduled dispatch cycles.
* **Generation Command**:
  ```bash
  openssl rand -hex 32
  ```

---

### Category C: Meta / Facebook Graph API v26.0

#### `FACEBOOK_APP_ID`
* **Purpose**: Public App ID from Meta for Developers.
* **Format**: Numeric string (e.g. `123456789012345`).

#### `FACEBOOK_APP_SECRET`
* **Purpose**: App Secret from Meta for Developers (Settings → Basic).
* **Format**: 32-character hexadecimal string.
* **Required Meta App Settings**:
  - Valid OAuth Redirect URIs must include:
    ```text
    https://fbuploadpro.com/api/auth/facebook/callback
    http://localhost:3000/api/auth/facebook/callback (for local testing)
    ```
  - App Permissions in App Review: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.

---

### Category D: Cloudflare R2 Media Storage

#### `R2_ACCOUNT_ID`
* **Format**: 32-character hex account ID from Cloudflare dashboard URL or Workers overview.

#### `R2_ACCESS_KEY_ID` & `R2_SECRET_ACCESS_KEY`
* **Purpose**: S3-compatible credentials used to generate presigned browser-to-bucket direct upload URLs (`PutObjectCommand`).
* **Generation**: Cloudflare Dashboard → R2 Object Storage → **Manage R2 API Tokens** → Create Token with **Object Read & Write** permissions scoped to your media bucket.

#### `R2_BUCKET_NAME`
* **Format**: Slug string (e.g. `fbuploadpro-media-prod`).

#### `R2_PUBLIC_URL`
* **Purpose**: The public CDN endpoint for serving uploaded media and thumbnails.
* **Format**: Fully qualified HTTPS URL without trailing slash (e.g. `https://media.fbuploadpro.com`).
* **Configuration**: Configured via Cloudflare R2 Bucket → **Settings** → **Custom Domains**.

---

### Category E: Cloudflare Worker Deployment (CI/CD)

To deploy `apps/worker` via GitHub Actions (`wrangler deploy`):

#### `CLOUDFLARE_API_TOKEN`
* **Generation**: Cloudflare Dashboard → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers** template.
* **Permissions**:
  - Account: `Worker Scripts: Edit`, `Account Settings: Read`
  - Zone: `Workers Routes: Edit` (if using custom domains)
  - R2: `Workers R2 Storage: Edit`

#### `CLOUDFLARE_ACCOUNT_ID`
* Account ID string from Cloudflare overview.

---

## 3. Step-by-Step Injection Guide

### 1. In GitHub Repository Secrets (for CI/CD Deployments)
Go to **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `FB_ENCRYPTION_MASTER_KEY`
- *(If deploying Next.js to Vercel)*: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

### 2. In Cloudflare Workers (Production Worker)
Run via Wrangler CLI or add under Cloudflare Dashboard → Workers & Pages → `fbuploadpro-worker` → **Settings** → **Variables and Secrets**:
```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put FB_ENCRYPTION_MASTER_KEY
```

### 3. In Web Host (Vercel / Cloudflare Pages)
Add all Web App variables from `.env.production.example`:
- `DATABASE_URL`
- `NEXT_PUBLIC_ROOT_DOMAIN`
- `NEXT_PUBLIC_APP_URL`
- `SESSION_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`
- `DEFAULT_STORAGE_QUOTA_BYTES`
