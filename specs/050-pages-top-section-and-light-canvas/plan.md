# Implementation Plan: Pages Top Section Redesign & Light Mode Canvas Contrast (Spec 050)

**Feature Directory**: `specs/050-pages-top-section-and-light-canvas`  
**Status**: Planned  

---

## 1. Architecture & Component Blueprint

### A. Light Mode Canvas Contrast
- **`apps/web/src/lib/theme.ts`**:
  ```ts
  export const LIGHT_THEME: ThemeTokens = {
    mode: 'light',
    surfaces: {
      canvas: '#f6f8fa', // Option A: Clean neutral light canvas
      panel: '#ffffff',
      subtle: '#f1f3f5',
      hover: '#e9ecef',
      active: '#dee2e6',
    },
    ...
  ```
- **`apps/web/src/app/globals.css`**:
  ```css
  [data-theme="light"],
  .light {
    --bg-canvas: #f6f8fa;
    --bg-panel: #ffffff;
    --bg-subtle: #f1f3f5;
    ...
  ```

### B. Pages Page Redesign (`apps/web/src/app/tenant/[subdomain]/pages/page.tsx`)

#### 1. Header Row
```tsx
<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md, marginBottom: SPACING.lg, flexWrap: 'wrap' }}>
  <div>
    <h1 data-testid="pages-page-title" style={{ margin: 0, fontSize: '1.375rem', fontWeight: 600, color: 'var(--text-main)' }}>
      Facebook Pages
    </h1>
    <p data-testid="pages-page-subtitle" style={{ margin: `${SPACING.xs} 0 0 0`, fontSize: '0.8125rem', color: 'var(--text-sub)' }}>
      {situationalSubtitle}
    </p>
  </div>

  <button
    type="button"
    data-testid="header-add-page-btn"
    onClick={() => setIsAddModalOpen(true)}
    style={{
      height: '34px',
      padding: `0 ${SPACING.md}`,
      backgroundColor: PALETTE.primary,
      color: '#000000',
      border: `1px solid ${PALETTE.primary}`,
      borderRadius: RADII.sm,
      fontSize: '0.8125rem',
      fontWeight: TYPOGRAPHY.weights.semibold,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      cursor: 'pointer',
      transition: 'transform 0.12s ease, box-shadow 0.12s ease',
    }}
  >
    <PlusIcon />
    <span>Add Page</span>
  </button>
</div>
```

#### 2. Split Horizon Toolbar Row
```tsx
<div
  data-testid="pages-scale-toolbar"
  style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.xl,
    borderBottom: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
    flexWrap: 'wrap',
  }}
>
  {/* Left: Ghost Search Input with Inset Icon & Quick Clear */}
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '240px', flex: '1 1 240px', maxWidth: '320px' }}>
    <SearchIcon style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)' }} />
    <input
      type="text"
      data-testid="pages-search-input"
      value={searchQuery}
      onChange={(e) => onSearchChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Escape') onSearchChange(''); }}
      placeholder="Filter by name or category..."
      style={{
        width: '100%',
        height: '34px',
        paddingLeft: '32px',
        paddingRight: searchQuery ? '28px' : '10px',
        background: 'transparent',
        border: '1px solid var(--border-subtle)',
        borderRadius: RADII.sm,
        fontSize: '0.8125rem',
        color: 'var(--text-main)',
        outline: 'none',
        transition: 'border-color 0.15s ease',
      }}
    />
    {searchQuery && (
      <button type="button" onClick={() => onSearchChange('')} ...>×</button>
    )}
  </div>

  {/* Right: Pure Typographic Filter Tabs + Smart Account Filter */}
  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.lg, flexWrap: 'wrap' }}>
    <nav style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          data-testid={tab.testId}
          onClick={() => onStatusFilterChange(tab.value)}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: isActive ? `2px solid ${PALETTE.primary}` : '2px solid transparent',
            padding: `${SPACING.xs} 0`,
            fontSize: '0.8125rem',
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--text-main)' : 'var(--text-sub)',
            cursor: 'pointer',
            transition: 'color 0.12s ease',
          }}
        >
          {tab.label} {tab.count !== undefined && tab.count > 0 && <span ...>({tab.count})</span>}
        </button>
      ))}
    </nav>

    {accountOptions.length > 1 && (
      <select data-testid="pages-account-filter" ...>
        ...
      </select>
    )}
  </div>
</div>
```

---

## 2. Test Verification Strategy
- Update unit tests in `apps/web/tests/ui/pages.test.tsx` to verify:
  1. Situational subtitle states (healthy, attention-needed, and active filter).
  2. Escape-key search clearing.
  3. Underline tab selection without boxed borders.
  4. Account filter visibility logic.
  5. Light mode `--bg-canvas` value in `theme.ts`.
