# Requirements Quality Checklist: Spec 068 Downloader Namespace Separation

- [x] Dedicated directory `apps/web/src/components/downloader/` created.
- [x] Downloader component migrated to `apps/web/src/components/downloader/media-downloader.tsx`.
- [x] Downloader page `apps/web/src/app/tenant/[subdomain]/downloader/page.tsx` updated to import from `@/components/downloader/media-downloader`.
- [x] Dedicated API directory `apps/web/src/app/api/tenant/[subdomain]/downloader/` created with `route.ts`.
- [x] Legacy API route `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts` re-exports `GET` and `POST` from `@/app/api/tenant/[subdomain]/downloader/route`.
- [x] API calls inside `media-downloader.tsx` updated to `/api/tenant/${subdomain}/downloader`.
- [x] Automated UI tests in `apps/web/tests/ui/media-downloader.test.tsx` updated and passing.
- [x] Automated API tests in `apps/web/tests/api/media-downloader.test.ts` updated and passing.
- [x] Principle 32 added to `.specify/memory/constitution.md`.
- [x] `docs/foundational-knowledge.md` synchronized.
