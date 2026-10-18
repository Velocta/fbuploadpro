# Plan — Spec 074: Empty Catch Blocks + ESLint `no-empty`

## Approach

Two files, ~30 lines. Flip the lint rule, then document intent at each bare catch site.

## Changes

### 1. `eslint.config.mjs`
`"no-empty": ["error", { "allowEmptyCatch": true }]` → `"no-empty": "error"`

### 2. `apps/web/src/components/media/media-library-explorer.tsx`

All 7 bare `catch {}` sites wrap `JSON.parse` of drag-and-drop payload data. Invalid JSON means the dragged data isn't ours — ignoring is the correct behavior, but it must be explicit. Replace each `} catch {}` with:

```tsx
} catch {
  // Intentional: invalid JSON means the dropped data isn't ours — ignore.
}
```

Sites: lines ~1743, 1748 (folder drop), ~1954 (localStorage view-mode persist — quota/private-mode may throw; best-effort), ~2616, 2621, 2692, 2697 (breadcrumb/root drop targets).

For the localStorage site (~1954), use a more specific comment:
```tsx
} catch {
  // Intentional: localStorage may be unavailable (private mode/quota) — view mode just won't persist.
}
```

## Verification

- `pnpm --filter @fbuploadpro/web lint` passes with `allowEmptyCatch: false`.
- `grep -n "catch {}" media-library-explorer.tsx` returns nothing.
- CI green.
