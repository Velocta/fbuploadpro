# FBUploadPro: Foundational Product Knowledge & Architecture

This document serves as the canonical source of truth for the product vision, architecture, user personas, roles, and functional workflows of **FBUploadPro**.

---

## 1. Product Vision & Core Mission

**FBUploadPro** is a modern, cloud-native social media automation and video/image publishing SaaS. It empowers content creators, digital marketers, and media operators to manage multiple Facebook profiles, organize rich digital media, and automate high-volume publishing to Facebook Pages through intelligent, slot-based queues with zero token leakage, real-time analytics, and transparent pay-as-you-go token billing.

---

## 2. Multi-Tenant User Architecture

- **Individual User Workspaces**: Rather than multi-client agency containers, the platform is centered around **individual users**.
- **Dedicated Subdomain Isolation**: Each registered user gets an isolated personal workspace accessible via their own subdomain (e.g. `https://{username}.fbuploadpro.com` or `https://{user-slug}.fbuploadpro.com`).
- **Strict Data Boundaries**:
  - Facebook accounts, imported Facebook Pages, media assets, publishing queues, and token ledgers are strictly scoped to the active tenant user.
  - Zero cross-user data leakage enforced via database compound constraints (`user_id`) and edge routing guards.

---

## 3. Platform Roles & Governance

The platform operates on a clear three-tier role taxonomy:

| Role | Primary Purpose | Key Capabilities |
|---|---|---|
| **User** | Content Creator / Operator | Connects multiple Facebook profiles, manages personal Media Library, creates custom folders and reusable captions, configures Page queue slots, schedules posts, monitors Page insights, and purchases operational tokens via Stripe. |
| **Seller** | Affiliate / Referral Partner | Onboards users via unique referral links/codes. Tracks referred users' activity and earns commission credits / revenue share on referred users' Stripe token purchases. |
| **Admin** | Financial & Commission Controller | Configures platform token pricing tiers, sets seller commission percentages, reviews referral performance, and approves/processes commission payouts. User onboarding and management is completely automated. |

---

## 4. Dedicated User Media Library

Each user has an isolated, feature-rich Media Library:

- **Multi-Media Support**: Full support for both **short-form videos** (Reels / feed videos) and **images**.
- **Direct PC Ingestion**: Users upload assets directly from their local computer.
  - Browser-to-storage direct uploads via Cloudflare R2 presigned URLs (preventing web application server bottlenecks).
  - Fast upload handling with automated thumbnail preview generation.
- **Organization & Metadata**:
  - **Custom Folders**: Nested or categorized collections for organizing campaigns, themes, or series.
  - **Tags**: Multi-tag filtering and search for quick asset retrieval.
  - **Reusable Captions**: A library of saved caption templates and snippets that can be attached to posts with one click.
- **Storage Infrastructure & Quotas**:
  - Backed by Cloudflare R2 object storage.
  - Generous baseline storage quota (e.g. 5GB or 50 media assets) with clear usage meters.

---

## 5. Automated Queue Slots Publishing Engine

Instead of manual calendar scheduling or legacy scraper bots, publishing is driven by an **Automated Queue Slots** architecture:

1. **Page-Specific Queue Slots**:
   - For each connected Facebook Page, users define recurring publishing time slots (e.g., Daily at `09:00`, `13:00`, and `18:00`).
2. **Selective Asset Queueing**:
   - Users select videos or images from their Media Library, assign captions (or reusable caption templates), and add them to target Page queues.
3. **Automated First Comment**:
   - Users can optionally attach a First Comment (calls to action, affiliate links, hashtags) that is automatically posted immediately after the post goes live.
4. **Cloudflare Worker Edge Scheduler**:
   - A high-performance Cloudflare Worker edge cron runs every minute.
   - Atomically claims due queue items using PostgreSQL row-level locks (`FOR UPDATE SKIP LOCKED`).
   - Streams media directly to **Facebook Graph API v26.0**.
   - Submits the automated first comment if configured.
5. **Token Consumption Lifecycle**:
   - Pre-flight checks ensure the user has sufficient tokens before scheduling.
   - **Tokens are deducted strictly upon successful publication** to Facebook (with automatic rollback and detailed error logs if publishing fails).
   - Zero reliance on external scraping daemons or VPS downloaders; 100% focused on user-owned creative content.

---

## 6. Dedicated Facebook Page Insights & Analytics

Insights are accessible in a dedicated, per-page view (rather than cluttering the workspace dashboard):

- **Overview & Growth**:
  - Current Fan Count (Likes) & Total Followers Count.
  - Time-series follower growth, daily new follows, and unfollow trends.
- **Content & Video Performance**:
  - Total video views and unique video views.
  - 30-second complete video views and total view time (watch minutes).
  - Media impressions and page views over 7-day, 14-day, and 28-day intervals.
- **Audience Engagement & Reactions**:
  - Total post engagements and action counts.
  - Detailed reaction breakdowns: Likes, Love, Wow, Haha, Sorry, Anger.
- **Demographics**:
  - Audience distribution by top countries and top cities.

---

## 7. Financial & Token Economy

- **Prepaid Token Model**: Users buy token packs (e.g., 500, 2,000, 10,000 tokens) via Stripe Checkout.
- **Automated Webhook Balance Credit**: Stripe webhook events automatically credit the user's PostgreSQL token balance.
- **Seller Referral Attribution**:
  - When a user signs up with a Seller's referral code, purchases are tied to that Seller.
  - Commission credits are logged in a dedicated ledger for Admin payout review.
- **Transparent Ledger**: Every token credit, debit, refund, or adjustment is permanently recorded in `token_transactions`.

---

## 8. Development Roadmap & Milestones

```mermaid
flowchart LR
  subgraph Done [Completed & Merged]
    M1[Spec 001: Monorepo Foundation & DB]
    M2[Spec 002: Auth & Subdomain Routing]
    M3[Spec 003: FB Graph API v26.0 & Accounts]
  end

  subgraph Next [Roadmap]
    M4[Spec 004: Dedicated Media Library & R2]
    M5[Spec 005: Automated Queue Slots Engine]
    M6[Spec 006: Dedicated Page Insights]
    M7[Spec 007: Stripe Billing & Seller Referrals]
  end

  M1 --> M2 --> M3 --> M4 --> M5 --> M6 --> M7
```

- **Spec 001 (Completed)**: Turborepo monorepo, dual Node/Edge database clients, baseline schema, health probes.
- **Spec 002 (Completed)**: Native Web Crypto HMAC-SHA256 session auth, subdomain routing middleware, RBAC shell.
- **Spec 003 (Completed)**: Facebook Graph API v26.0 OAuth, AES-256-GCM encrypted token storage, selective page discovery, multi-account management UI.
- **Spec 004 (Next Target)**: **Dedicated Media Library & Cloudflare R2 Uploads** (PC file upload, video/image support, custom folders, tags, reusable captions, baseline quotas).
- **Spec 005 (Target)**: **Automated Queue Slots Publishing Engine** (Page slot definitions, queue manager, first comment automation, edge worker publisher, token deduction on success).
- **Spec 006 (Target)**: **Dedicated Facebook Page Insights** (Time-series followers, video views, watch time, reactions, demographics).
- **Spec 007 (Target)**: **Stripe Token Billing, Seller Referrals & Admin Commission Controller**.
