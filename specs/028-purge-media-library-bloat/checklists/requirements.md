# Requirements Quality Checklist: Spec 028

- [x] Forward migration drops `caption_templates`, `user_storage_quotas`, `media_items.caption_template_id`, `media_items.tags`, `idx_media_items_tags`, and `media_folders.color` without altering historical migrations.
- [x] `deriveDefaultCaptionFromFilename` cleanly strips the file extension (`My Viral Reel.mp4` -> `My Viral Reel`) as the default `caption_text` on upload confirmation.
- [x] All `captions` and `quota` routes and test files are removed.
- [x] All broken `user_storage_quotas` upserts in `supabase-auth.ts` are removed.
- [x] All Turborepo quality gates (`build`, `lint`, `typecheck`, `test`) pass with zero errors.
