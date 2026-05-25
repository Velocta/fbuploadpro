# RSS template renderer

Canonical render implementation lives in `webapp/src/server/lib/rss-template-renderer/render.ts`.

Workers call the webapp internal API `POST /api/v1/internal/facebook/rss-autoposter/render` with `x-rss-worker-secret`.

Preset JSON is mirrored in `webapp/src/lib/rss-autoposter/presets.ts`.
