# Phase 0 Research: First Comment Scope Alignment

## Decision 1: Scope Selection for First Comment Automation

- **Decision**: Include `pages_manage_engagement` in the Facebook OAuth scope set alongside `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, and `business_management`.
- **Rationale**:
  - Under Meta Graph API v26.0, `POST /{post-id}/comments` on a published page post is classified as an engagement creation action.
  - While `pages_manage_posts` authorizes creating the root post (feed, photos, videos, reels), creating comments on that post requires `pages_manage_engagement` when running in Meta Live production mode.
  - Adding `pages_manage_engagement` ensures the automated First Comment feature in `apps/worker/src/dispatcher.ts` does not fail with Meta OAuth error `(#200) Requires pages_manage_engagement permission to manage the object`.
- **Alternatives Considered**:
  - *Keep existing 4 scopes*: Rejected because First Comments would fail silently or produce warning logs in production whenever users schedule posts with first comments.
  - *Add legacy `read_insights` and `pages_manage_metadata`*: Rejected because `read_insights` is redundant with `pages_read_engagement`, and `pages_manage_metadata` is only for editing Page bio/address information. Over-requesting scopes increases Meta App Review scrutiny without functional benefit.

## Decision 2: Scope Propagation Points

- **Decision**: Update scopes across:
  1. Standard OAuth initiation: `apps/web/src/app/api/auth/facebook/route.ts`
  2. Magic Link OAuth initiation: `apps/web/src/app/connect/facebook/route.ts`
  3. BYOC Settings Display: `apps/web/src/components/settings/byoc-settings-view.tsx`
  4. Documentation: `docs/foundational-knowledge.md`
- **Rationale**: These represent the single source of truth for Facebook OAuth redirection and workspace setup instructions.
