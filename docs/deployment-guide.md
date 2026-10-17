# FBUploadPro: Complete Production Deployment Guide

This guide walks through deploying the entire **FBUploadPro** multi-tenant SaaS platform from scratch. The architecture uses **GitHub Repository Secrets and Variables as the single source of truth**—meaning once your services are provisioned, you only inject credentials into GitHub, and automated CI/CD pipelines distribute them to Vercel and Cloudflare automatically.

---

## Deployment Architecture Overview

```mermaid
flowchart TD
    subgraph ThirdPartyServices ["1. External Cloud Services"]
        Supa["Supabase\n(PostgreSQL + Auth + SMTP OTP)"]
        Verc["Vercel\n(Next.js 16 Web App Gateway)"]
        CFW["Cloudflare Workers\n(Edge Crons & Dispatcher)"]
        CFR2["Cloudflare R2\n(Zero-Egress Media Storage)"]
        Upstash["Upstash Redis\n(Distributed Cache & Rate Limiting)"]
    end

    subgraph GitHubCentral ["2. Central Secrets & Deploy Hub"]
        GHS["GitHub Repository Secrets & Variables\n(Velocta/fbuploadpro)"]
    end

    subgraph AutomatedDeployment ["3. Automated CI/CD Execution"]
        GHS -->|sync-vercel-env.yml\n(REST API Upsert)| Verc
        GHS -->|deploy-worker.yml\nWrangler Action| CFW
        GitHubCentral -->|Supabase GitHub Integration| Supa
    end
```

---

## Phase 1: Setting Up Supabase (Database, Auth & Migrations)

Supabase serves as the relational database substrate, authentication provider, and row-level security engine.

### 1.1 Create Supabase Project
1. Log in to [Supabase](https://supabase.com) and click **New project**.
2. Select your Organization, name the project (e.g. `fbuploadpro-prod`), set a strong database password, and choose a region close to your primary audience (e.g. `East US (North Virginia)`).
3. Wait for the database provisioning to complete.

### 1.2 Collect API Keys (Pure HTTPS PostgREST Architecture)
FBUploadPro operates on a pure HTTPS REST database architecture via `@supabase/supabase-js`. Traditional PostgreSQL connection URIs (`DATABASE_URL`) and direct TCP sockets are **not** used or required.

Navigate to **Project Settings** $\rightarrow$ **API**:
- **Project URL**: Copy the URL (`https://[project-ref].supabase.co`).
  *This maps to `NEXT_PUBLIC_SUPABASE_URL`.*
- **Project API Keys** $\rightarrow$ `anon` / `public`: Copy the public anon JWT.
  *This maps to `NEXT_PUBLIC_SUPABASE_ANON_KEY`.*
- **Project API Keys** $\rightarrow$ `service_role` / `secret`: Reveal and copy the service role key.
  *This maps to `SUPABASE_SERVICE_ROLE_KEY`.*

### 1.3 Configure Authentication & URL Allowlist
Navigate to **Authentication** $\rightarrow$ **URL Configuration**:
1. **Site URL**: Set to your primary application portal gateway:
   ```text
   https://app.vinsmokemedia.online
   ```
2. **Redirect URLs / Allowlist**: Add wildcard rules to permit cross-subdomain tenant authentication:
   ```text
   https://app.vinsmokemedia.online/**
   https://*.vinsmokemedia.online/**
   http://localhost:3000/** (for local staging)
   ```

### 1.4 Configure Native SMTP for 6-Digit Email OTP Delivery
Navigate to **Authentication** $\rightarrow$ **SMTP Settings**:
1. Toggle **Enable Custom SMTP** on.
2. Enter your transactional email provider credentials (Resend, SendGrid, Amazon SES, Postmark, or Mailgun):
   - **Sender Email**: e.g. `auth@vinsmokemedia.online` or `noreply@vinsmokemedia.online`
   - **Sender Name**: `FBUploadPro`
   - **Host**: Your SMTP host (e.g. `smtp.resend.com` or `smtp.sendgrid.net`)
   - **Port**: `587`
   - **Username** & **Password**: Your SMTP API credentials.
3. In **Authentication** $\rightarrow$ **Email Templates**:
   - Configure the production email templates located in [`docs/email-templates/`](email-templates/README.md):
     - **Confirm signup**: Use [`docs/email-templates/otp-verification.html`](email-templates/otp-verification.html) with subject `{{ .Token }} is your FBUploadPro verification code`.
     - **Reset password**: Use [`docs/email-templates/forgot-password-otp.html`](email-templates/forgot-password-otp.html) with subject `{{ .Token }} is your FBUploadPro password reset code`.
   - See [`docs/email-templates/README.md`](email-templates/README.md) for full configuration instructions and plain-text fallbacks.

### 1.5 Connect Supabase GitHub Integration (Automated Migrations)
1. In Supabase Dashboard, navigate to **Project Settings** $\rightarrow$ **Integrations** $\rightarrow$ **GitHub**.
2. Connect your GitHub repository (`Velocta/fbuploadpro`).
3. Select the production branch (`main`) and migration directory path:
   ```text
   supabase/migrations
   ```
4. *Result*: Every time a Pull Request merges into `main`, Supabase automatically applies unapplied SQL migrations in chronological order.

---

## Phase 2: Setting Up Vercel (Next.js 16 Web App)

Vercel hosts the Next.js 16 App Router application (`apps/web`), multi-tenant subdomains, and the root marketing portal.

### 2.1 Import the Project into Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Select your GitHub repository (`Velocta/fbuploadpro`).
3. In the project configuration:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web` (or leave root with Turborepo auto-detection)
   - **Build Command**: `pnpm turbo run build --filter=@fbuploadpro/web`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install`
4. *Important*: You do **not** need to manually enter environment variables in the Vercel UI. The GitHub Actions sync workflow will push all secrets automatically in Phase 5.
5. Click **Deploy**.

### 2.2 Configure Custom Apex & Wildcard Domains
Navigate to **Project Settings** $\rightarrow$ **Domains**:
1. Add Apex Domain:
   - `vinsmokemedia.online` (serves the public marketing landing page)
2. Add Application Gateway:
   - `app.vinsmokemedia.online` (serves central authentication `/login`, `/signup`, `/forgot-password`)
3. Add Wildcard Subdomain:
   - `*.vinsmokemedia.online` (serves isolated user tenant workspaces `{subdomain}.vinsmokemedia.online`)

In your DNS provider (Cloudflare, Namecheap, GoDaddy):
- Add an `A` record pointing `@` (or `vinsmokemedia.online`) to `76.76.21.21`.
- Add a `CNAME` record pointing `app` to `cname.vercel-dns.com`.
- Add a `CNAME` record pointing `*` to `cname.vercel-dns.com`.

### 2.3 Retrieve Vercel API Credentials
To allow GitHub Actions to sync secrets into Vercel automatically:
1. **Personal / Team Access Token**:
   - Go to **Vercel Account Settings** $\rightarrow$ **Tokens** $\rightarrow$ **Create Token**.
   - Name: `fbuploadpro-github-sync`
   - Scope: Full account or selected team.
   - Copy the token string. *(This maps to `VERCEL_TOKEN`)*.
2. **Project ID & Org ID**:
   - In your project, go to **Project Settings** $\rightarrow$ **General**.
   - Copy the **Project ID** (`prj_...`). *(This maps to `VERCEL_PROJECT_ID`)*.
   - If deploying under a Vercel Team, copy the **Team ID** (`team_...`) under **Team Settings** $\rightarrow$ **General**. If deploying under a personal account, copy your Account ID. *(This maps to `VERCEL_ORG_ID`)*.

---

## Phase 3: Setting Up Cloudflare (Workers & R2 Storage)

Cloudflare handles two mission-critical subsystems:
1. **Cloudflare Workers (`apps/worker`)**: 1-minute crons for scheduled Facebook video/post dispatching.
2. **Cloudflare R2**: High-throughput S3-compatible media storage with zero egress fees.

### 3.1 Retrieve Cloudflare Account ID & API Token
1. Log in to [Cloudflare](https://dash.cloudflare.com).
2. On the overview page (or in any zone), look at the right sidebar and copy your **Account ID** (a 32-character hexadecimal string).
   *This maps to `CLOUDFLARE_ACCOUNT_ID` and `R2_ACCOUNT_ID`.*
3. Go to **My Profile** $\rightarrow$ **API Tokens** $\rightarrow$ **Create Token**:
   - Select the **Edit Cloudflare Workers** template.
   - Ensure the following permissions are present:
     - Account: `Worker Scripts: Edit`, `Account Settings: Read`
     - Zone: `Workers Routes: Edit` (if custom domains are used)
     - R2: `Workers R2 Storage: Edit`
   - Click **Continue to summary** $\rightarrow$ **Create Token**.
   - Copy the token string. *(This maps to `CLOUDFLARE_API_TOKEN`)*.

### 3.2 Create Cloudflare R2 Media Bucket
1. In Cloudflare sidebar, click **R2 Object Storage** $\rightarrow$ **Create bucket**.
2. **Bucket name**: e.g. `fbuploadpro-media-prod`.
   *This maps to `R2_BUCKET_NAME`.*
3. Location: Automatic or nearest region. Click **Create Bucket**.
4. In the created bucket settings (**Settings** $\rightarrow$ **Public Access**):
   - Under **Custom Domains**, click **Connect Domain** and enter a subdomain (e.g. `media.vinsmokemedia.online`). Cloudflare will automatically configure the SSL certificate and DNS record.
   - Or, enable the **R2.dev subdomain** for quick staging.
   - Copy the public HTTPS endpoint without a trailing slash (e.g. `https://media.vinsmokemedia.online`).
   *This maps to `R2_PUBLIC_URL`.*

### 3.3 Create R2 S3-Compatible API Credentials
1. In Cloudflare sidebar, click **R2 Object Storage** $\rightarrow$ **Manage R2 API Tokens** (top right).
2. Click **Create API Token**:
   - **Permissions**: Select **Object Read & Write**.
   - **Bucket scope**: Select `fbuploadpro-media-prod` (or all buckets).
   - **TTL**: Forever (or according to your security policy).
3. Click **Create API Token** and copy the generated credentials:
   - **Access Key ID**: 32-character hex string. *(Maps to `R2_ACCESS_KEY_ID`)*.
   - **Secret Access Key**: 64-character hex string. *(Maps to `R2_SECRET_ACCESS_KEY`)*.

---

## Phase 4: Setting Up Upstash (Serverless Redis)

Upstash Redis provides distributed rate limiting and caching across Vercel edge functions and route handlers.

### 4.1 Create Redis Database
1. Log in to [Upstash Console](https://console.upstash.com).
2. Click **Create Database**:
   - **Name**: `fbuploadpro-prod-redis`
   - **Type**: Regional (select the same region as your Supabase database and Vercel functions, e.g. `us-east-1`).
   - **Eviction**: Enabled (`volatile-lru` or standard).
3. Click **Create**.

### 4.2 Copy REST Endpoint Credentials
1. On the database details page, scroll down to the **REST API** section.
2. Select the **`.env`** tab.
3. Copy the two values:
   - `UPSTASH_REDIS_REST_URL`: (e.g. `https://[id].upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN`: (e.g. `AX...`)

---

## Phase 5: Configuring GitHub Secrets & Variables (The Central Vault)

Now that you have all cloud service credentials, inject them **once** into GitHub. GitHub Actions handles distribution to Vercel and Cloudflare automatically.

### 5.1 Generate Cryptographic Secrets
Generate secure random keys on your local terminal using `openssl`:

```bash
# 1. Session Signing Secret (minimum 32 characters)
openssl rand -base64 32

# 2. Token Encryption Key (Strictly 64 hex characters / 256 bits for AES-256-GCM)
openssl rand -hex 32
```

### 5.2 Set GitHub Variables (Public Configuration)
Run these commands in your local terminal using the GitHub CLI:

```bash
gh variable set NEXT_PUBLIC_ROOT_DOMAIN --body "vinsmokemedia.online"
gh variable set NEXT_PUBLIC_APP_URL --body "https://app.vinsmokemedia.online"
gh variable set NEXT_PUBLIC_MARKETING_URL --body "https://vinsmokemedia.online"
gh variable set NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER --body "+15551234567"
gh variable set NEXT_PUBLIC_WHATSAPP_DEFAULT_MESSAGE --body "Hi! I need assistance with my FBUploadPro account."
```

### 5.3 Set GitHub Secrets (Sensitive Credentials)
Run each command and paste the corresponding credential when prompted (or use `--body`):

```bash
# Vercel Deployment & Sync
gh secret set VERCEL_TOKEN
gh secret set VERCEL_ORG_ID
gh secret set VERCEL_PROJECT_ID

# Cloudflare Workers & Deployment
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID

# Supabase Database & Auth (Pure HTTPS REST)
gh secret set NEXT_PUBLIC_SUPABASE_URL
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY
gh secret set SUPABASE_SERVICE_ROLE_KEY

# Cryptography & Security
gh secret set SESSION_SECRET
gh secret set TOKEN_ENCRYPTION_KEY

# Cloudflare R2 Media Storage
gh secret set R2_ACCOUNT_ID          # Same value as CLOUDFLARE_ACCOUNT_ID
gh secret set R2_ACCESS_KEY_ID
gh secret set R2_SECRET_ACCESS_KEY
gh secret set R2_BUCKET_NAME         # e.g. "fbuploadpro-media-prod"
gh secret set R2_PUBLIC_URL          # e.g. "https://media.vinsmokemedia.online"

# Upstash Redis
gh secret set UPSTASH_REDIS_REST_URL
gh secret set UPSTASH_REDIS_REST_TOKEN
```

---

## Phase 6: Triggering Deployments & Verification

With all secrets stored in GitHub, run the automated deployment pipeline:

### 6.1 Sync Secrets to Vercel
Trigger the automated secret synchronization workflow:
```bash
gh workflow run sync-vercel-env.yml
```
Verify the sync:
```bash
gh run list --workflow=sync-vercel-env.yml --limit 1
```
*Result*: The workflow calls Vercel REST API v10 and automatically creates/upserts all public and sensitive environment variables into Vercel production and preview targets.

### 6.2 Deploy the Cloudflare Worker
Deploy the background scheduler and dispatcher:
```bash
gh workflow run deploy-worker.yml
```
Verify the worker deployment:
```bash
gh run list --workflow=deploy-worker.yml --limit 1
```
*Result*: Cloudflare Wrangler deploys `apps/worker`, uploads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `TOKEN_ENCRYPTION_KEY` secrets, and activates crons at `* * * * *` and `0 2 * * *`.

### 6.3 Deploy the Web Application on Vercel
Because Vercel is linked to your GitHub repository:
- Push or merge your code to `main`.
- Vercel will trigger a production build using the freshly synchronized environment variables.
- Or, deploy immediately using the Vercel CLI:
  ```bash
  npx vercel --prod
  ```

---

## Phase 7: Post-Deployment Smoke Verification Checklist

After the initial deployment is complete, verify each core subsystem:

- [ ] **DNS & SSL**: Open `https://vinsmokemedia.online` (Marketing Landing) and `https://app.vinsmokemedia.online` (App Gateway) in your browser. Verify valid SSL certificates.
- [ ] **User Registration & OTP**: Go to `https://app.vinsmokemedia.online/signup`, register a new account, and confirm that the 6-digit verification OTP arrives in your inbox.
- [ ] **Tenant Subdomain Routing**: After verifying OTP, check that you are redirected to `https://[your-username].vinsmokemedia.online`.
- [ ] **Facebook BYOC Configuration**: In the tenant workspace, navigate to **Settings** $\rightarrow$ **Facebook BYOC**, enter your Meta App ID & App Secret, and click **Test Credentials** to verify AES-256-GCM encryption and Meta API connectivity.
- [ ] **Media Library Upload (R2)**: Upload an image or video in the Media Library. Confirm that the file is stored in Cloudflare R2 and served via your custom CDN URL.
- [ ] **Worker Health**: Inspect worker invocation logs in the Cloudflare Dashboard under **Workers & Pages** $\rightarrow$ `fbuploadpro-worker` $\rightarrow$ **Logs** to confirm that the 1-minute queue poller runs with 0 errors.
- [ ] **WhatsApp Support Button**: Verify that the floating green WhatsApp support button is visible at the bottom-right corner of all public and tenant pages, and clicking it opens WhatsApp with the pre-filled support message.

