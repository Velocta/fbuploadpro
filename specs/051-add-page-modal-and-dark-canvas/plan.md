# Implementation Plan: Add Page Dialog Redesign & Dark Mode Midnight Slate Canvas (Spec 051)

**Feature Directory**: `specs/051-add-page-modal-and-dark-canvas`  
**Status**: Planned  

---

## 1. Architecture & Component Blueprint

### A. Dark Mode Midnight Slate Calibration
- **`apps/web/src/lib/theme.ts`**:
  ```ts
  export const DARK_THEME: ThemeTokens = {
    mode: 'dark',
    surfaces: {
      canvas: '#0a0c10', // Soft midnight slate (replaces pitch black #000000)
      panel: '#12151c',  // Elevated cards & modals (replaces #0c0d10)
      subtle: '#181c26', // Recessed wells & table headers
      hover: '#1f2430',  // Interactive hover
      active: '#272d3d', // Active/pressed
    },
    borders: {
      hairline: '#222735', // Whisper-quiet structural dividers
      strong: '#2d3444',   // Input borders
      focus: 'rgba(250, 215, 52, 0.35)',
    },
    ...
  };
  ```
- **`apps/web/src/app/globals.css`**:
  Update `:root` dark mode defaults:
  ```css
  --bg-canvas: #0a0c10;
  --bg-panel: #12151c;
  --bg-subtle: #181c26;
  --bg-hover: #1f2430;
  --bg-active: #272d3d;
  --border-subtle: #222735;
  --border-strong: #2d3444;
  ```

### B. AddPageModal Refactor (`apps/web/src/components/pages/add-page-modal.tsx`)

#### 1. Header with Integrated Breadcrumb
```tsx
<DialogHeader>
  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
    {step === 'select-pages' && (
      <button
        type="button"
        data-testid="change-account-btn"
        onClick={handleBackToAccounts}
        aria-label="Back to accounts"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-sub)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: '4px',
          marginRight: '2px',
          borderRadius: RADII.xs,
        }}
      >
        <ArrowLeftIcon />
      </button>
    )}
    <div>
      <DialogTitle>
        {step === 'select-account'
          ? 'Select a Facebook Account'
          : 'Select Facebook Pages to Add'}
      </DialogTitle>
      <DialogDescription>
        {step === 'select-account'
          ? 'Choose which connected Facebook account you want to import pages from.'
          : `${selectedAccount?.displayName || 'Connected Account'} · ${discoveredPages.length} ${
              discoveredPages.length === 1 ? 'page available' : 'pages available'
            }`}
      </DialogDescription>
    </div>
  </div>
</DialogHeader>
```

#### 2. Frameless Discovered Page Row
- Eliminates heavy `1px solid var(--border-subtle)` box around every single row.
- Rows use transparent resting background, soft hover fill (`var(--bg-hover)`), and clean horizontal hairlines.
- Subtle check affordance:
  - Custom SVG check box or cleanly styled check indicator with accentColor.
  - Selected row gets a whisper tint (`rgba(250, 215, 52, 0.05)` or subtle hover fill) instead of a harsh blue outline.
- Already imported pages:
  - Checkbox disabled and checked.
  - Row opacity: `0.6`.
  - Whisper label: `Already added` (`var(--text-dim)`).

#### 3. Inline Search Filter
- A compact ghost search input at the top of Step 2:
  - `placeholder="Filter pages..."`
  - Inset search icon.
  - Fast client-side filtering by `pageName` and `category`.

#### 4. Dynamic Primary Button
- Primary confirmation button dynamically computes:
  - `selectedPageIds.length === 0`: `'Add Selected Pages'` (disabled)
  - `selectedPageIds.length === 1`: `'Import 1 Page'`
  - `selectedPageIds.length > 1`: `Import ${selectedPageIds.length} Pages`
  - `isSubmitting`: `'Adding Pages...'`

---

## 2. Test Plan & Contracts
- All tests in `apps/web/tests/ui/pages.test.tsx` must pass:
  - Step 1 account discovery and filtering (`sampleExpiredAccount` filtered out).
  - Step 1 no active accounts notice.
  - Step 1 click transitions to Step 2 with GET `/api/tenant/{subdomain}/accounts/{accountId}/pages/discover`.
  - Step 2 discovered pages rendering, already added page indication, `Select All` logic.
  - Step 2 submission calling POST `/api/tenant/{subdomain}/pages/import` with `{ accountId, selectedPageIds }`.
