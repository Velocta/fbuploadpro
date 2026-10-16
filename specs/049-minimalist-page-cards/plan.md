# Implementation Plan: Minimalist Standout Facebook Page Cards (Spec 049)

**Feature Directory**: `specs/049-minimalist-page-cards`  
**Status**: Planned  

---

## 1. Architecture & Component Blueprint

### Target Component: `apps/web/src/components/pages/page-card.tsx`

#### Layout Structure (Direction 2: Precision Editorial):
```
<div role="link" ...>
  {/* Top Row: Avatar with Dynamic Status Ring + Page Identity + Top-Right Glyph */}
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, minWidth: 0 }}>
      {/* Avatar (Image or Initials) with statusRingBorder */}
      <Avatar ... style={{ border: statusRingBorder, borderRadius: RADII.full, ... }} />
      <div style={{ minWidth: 0 }}>
        <h3 data-testid="page-name">{page.pageName}</h3>
        <span data-testid="page-category">{page.category || 'Facebook Page'}</span>
      </div>
    </div>
    {/* Subtle interactive affordance glyph */}
    <div style={{ color: 'var(--text-dim)', transition: 'color 0.15s ease, transform 0.15s ease' }}>
      ↗
    </div>
  </div>

  {/* Rose Attention Standout Banner (if needsAttention) */}
  {needsAttention && attentionMessage && (
    <div data-testid="page-attention-banner" ...>...</div>
  )}

  {/* Symmetrical Two-Column Data Row */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: SPACING.lg, gap: SPACING.md }}>
    {/* Left Column: Followers Count & Gain */}
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACING.xs }}>
        <span data-testid="page-current-followers" style={{ fontSize: '1.125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {currentFollowers.toLocaleString('en-US')}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>followers</span>
      </div>
      <div data-testid="page-followers-gained" style={{ fontSize: '0.75rem', color: gainedColor, fontVariantNumeric: 'tabular-nums', marginTop: '2px' }}>
        {formattedGained} net gain
      </div>
    </div>

    {/* Right Column: Pure Typographic Status (NO DOT) & Parent Account */}
    <div style={{ textAlign: 'right' }}>
      <div data-testid="page-status" style={{ fontSize: '0.8125rem', fontWeight: 600, color: statusColor, letterSpacing: '0.02em' }}>
        {statusLabel}
      </div>
      <div data-testid="page-parent-account" style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
        Account: {page.accountDisplayName || 'Connected Account'}
      </div>
    </div>
  </div>
</div>
```

---

## 2. Dynamic Status Ring Mapping

| Status | Text Color (`statusColor`) | Avatar Ring Border (`statusRingBorder`) | Card Border (Resting) |
| :--- | :--- | :--- | :--- |
| `active` | `#2EBD85` (`PALETTE.accent4`) | `1.5px solid #2EBD85` | `1px solid var(--border-subtle)` |
| `paused` | `#F0B90B` (`PALETTE.primary`) | `1.5px solid #F0B90B` | `1px solid var(--border-subtle)` |
| `invalid_token` | `#F6465D` (`PALETTE.accent3`) | `1.5px solid #F6465D` | `1px solid #F6465D` |
| `page_checkpoint`| `#F6465D` (`PALETTE.accent3`) | `1.5px solid #F6465D` | `1px solid #F6465D` |
| `fb_rate_limited`| `#F6465D` (`PALETTE.accent3`) | `1.5px solid #F6465D` | `1px solid #F6465D` |
| `disconnected` | `var(--text-dim)` | `1px solid var(--border-subtle)` | `1px solid var(--border-subtle)` |

---

## 3. Micro-Interactions & Hover Physics
- Resting card border: `1px solid var(--border-subtle)` (or `#F6465D` if `needsAttention`).
- On mouse enter:
  - `transform: translateY(-2px)`
  - `borderColor: needsAttention ? PALETTE.accent3 : 'rgba(46, 189, 133, 0.35)'` (subtle emerald highlight on active)
  - `boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.35)'`
  - Top-right arrow glyph `↗` changes color from `var(--text-dim)` to `var(--text-main)`.

---

## 4. Testing & Verification Plan
1. Run existing test suite in `apps/web/tests/ui/pages.test.tsx` to verify all testids, numbers, colors, and navigation remain 100% green.
2. Update any specific test expectations if they expected the old dot element or nested box layout.
3. Verify that all 6 status types correctly display pure typographic status text and the avatar ring.
