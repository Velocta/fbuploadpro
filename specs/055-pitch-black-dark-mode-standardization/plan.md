# Implementation Plan: Pitch Black Dark Mode Standardization & Initial Load Synchronization (Spec 055)

**Branch**: `feat/055-pitch-black-dark-mode-standardization`  
**Status**: Ready for Implementation  
**Estimated Complexity**: Low / Focused  
**Category**: Frontend Design & Theme Architecture

---

## 1. Architectural Overview & Technical Changes

### 1.1 Token Realignment
In `apps/web/src/lib/theme.ts`:
```typescript
export const DARK_THEME: ThemeTokens = {
  mode: 'dark',
  surfaces: {
    canvas: '#000000',
    panel: '#0c0d10',
    subtle: '#121419',
    hover: '#1f242d',
    active: '#262c37',
  },
  borders: {
    hairline: '#1f242d',
    strong: '#2b323c',
    focus: 'rgba(250, 215, 52, 0.35)',
  },
  // text, shadows, status remain standard
};
```

In `apps/web/src/app/globals.css`:
```css
:root {
  /* Default (Dark Mode) Tokens - Aligned 100% with [data-theme="dark"] */
  --bg-canvas: #000000;
  --bg-panel: #0c0d10;
  --bg-subtle: #121419;
  --bg-hover: #1f242d;
  --bg-active: #262c37;
  --text-main: #ffffff;
  --text-sub: #9ca3af;
  --text-dim: #6b7280;
  --text-on-primary: #000000;
  --border-subtle: #1f242d;
  --border-strong: #2b323c;
  --ring-focus: rgba(250, 215, 52, 0.35);
}

[data-theme="dark"],
.dark {
  --bg-canvas: #000000;
  --bg-panel: #0c0d10;
  --bg-subtle: #121419;
  --bg-hover: #1f242d;
  --bg-active: #262c37;
  --text-main: #ffffff;
  --text-sub: #9ca3af;
  --text-dim: #6b7280;
  --text-on-primary: #000000;
  --border-subtle: #1f242d;
  --border-strong: #2b323c;
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.60);
  --shadow-elevated: 0 12px 24px -4px rgba(0, 0, 0, 0.85);
  --shadow-modal: 0 24px 48px -8px rgba(0, 0, 0, 0.95);
}
```

### 1.2 Layout Pre-Hydration Theme Script
In `apps/web/src/app/layout.tsx`:
Add inline blocking script in `<head>`:
```tsx
<html lang="en" suppressHydrationWarning>
  <head>
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (!theme) {
                var match = document.cookie.match(/(?:^|;\\s*)fbup_theme=([^;]+)/);
                if (match) theme = match[1];
              }
              if (theme === 'light') {
                document.documentElement.dataset.theme = 'light';
                document.documentElement.classList.add('light');
              } else {
                document.documentElement.dataset.theme = 'dark';
                document.documentElement.classList.add('dark');
              }
            } catch (e) {
              document.documentElement.dataset.theme = 'dark';
              document.documentElement.classList.add('dark');
            }
          })();
        `,
      }}
    />
  </head>
  <body>
    <DesktopTitleBar />
    <main>{children}</main>
  </body>
</html>
```

### 1.3 `WorkspaceStudioFooter` Theme Handlers
In `apps/web/src/components/workspace/workspace-studio-footer.tsx`:
- Synchronize `document.documentElement.dataset.theme = activeTheme` on mount.
- In `handleToggleTheme`, write to both `localStorage.setItem('theme', newTheme)` and `document.cookie = fbup_theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`.

---

## 2. Testing & Verification Strategy
- Update unit assertions in `apps/web/tests/ui/pages.test.tsx` for `DARK_THEME` surface tokens (`#000000`, `#0c0d10`, `#121419`, `#1f242d`).
- Rely strictly on GitHub Actions remote CI upon PR creation per project governance.
