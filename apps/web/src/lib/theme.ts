/**
 * @file theme.ts
 * @description Canonical Design System Theme Configuration & Tokens for FBUploadPro Webapp.
 * 
 * STRICT ARCHITECTURAL RULE:
 * NEVER declare or hardcode ad-hoc colors, borders, shadows, or styling literals in components.
 * ALWAYS import and reference all visual properties, palette colors, spacing, and status indicators
 * directly from this file (or via the corresponding CSS variables defined in globals.css).
 */

// ============================================================================
// 1. PRIMITIVE PALETTE (Official 8-Color Palette)
// ============================================================================

export const PALETTE = {
  /** Dominant brand keystone — primary buttons, active moments (14.86:1 AAA on black) */
  primary: '#fad734',
  /** Secondary highlight — links, callouts, active underline tabs */
  accent1: '#b29527',
  /** Deep bronze — tertiary highlight, active tab borders, deep pressed states */
  accent2: '#766018',
  /** Rose / Danger — negative status, error states, sell indicator, critical alerts */
  accent3: '#f6465d',
  /** Emerald / Success — positive status, operational states, buy indicator, success */
  accent4: '#2ebd85',
  /** Pitch Black — base canvas surface in dark mode */
  background: '#000000',
  /** Pure White — readable foreground typography in dark mode (21.0:1 AAA on black) */
  text: '#ffffff',
  /** Pitch Slate — 1px hairline borders, dividers, subtle recessed UI surfaces */
  neutral: '#1f242d',
} as const;

export type PaletteKey = keyof typeof PALETTE;

// ============================================================================
// 2. SPATIAL GRID & CORNER RADII TOKENS
// ============================================================================

export const SPACING = {
  /** 4px: Micro gaps, inline icon margins */
  xs: '4px',
  /** 8px: Compact element spacing, input internal padding Y */
  sm: '8px',
  /** 12px: Standard control padding X */
  md: '12px',
  /** 16px: Standard container padding, card inner margins */
  lg: '16px',
  /** 24px: Card sectional gap, grid gutters */
  xl: '24px',
  /** 32px: Page section rhythm */
  xxl: '32px',
  /** 48px: Major boundary margins */
  xxxl: '48px',
} as const;

export const RADII = {
  /** 4px: Checkboxes, micro switches, segmented toggles */
  xs: '4px',
  /** 6px: Primary/Secondary buttons, form text inputs, select triggers */
  sm: '6px',
  /** 8px: Cards, data tables, sheet containers, dialog modals */
  md: '8px',
  /** 9999px: Strictly reserved for circular avatars and 6px status micro-dots. NEVER for capsule pill badges. */
  full: '9999px',
} as const;

// ============================================================================
// 3. OPTICAL TYPOGRAPHY METRICS
// ============================================================================

export const TYPOGRAPHY = {
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFeatureSettings: "'cv02', 'cv03', 'cv04', 'cv11'",
  tabularNums: 'tabular-nums',
  tracking: {
    display: '-0.025em',
    h1: '-0.020em',
    h2: '-0.015em',
    h3: '-0.010em',
    body: '0.000em',
    caption: '+0.040em',
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    heavy: 800,
  },
} as const;

// ============================================================================
// 4. UNBOXED STATUS SIGNALS (Strictly Zero Capsule / Pill Badges)
// ============================================================================

export const STATUS_SIGNALS = {
  operational: {
    color: PALETTE.accent4,
    dot: PALETTE.accent4,
    halo: '0 0 8px rgba(46, 189, 133, 0.50)',
    label: 'Operational',
  },
  queued: {
    color: PALETTE.primary,
    dot: PALETTE.primary,
    halo: '0 0 8px rgba(250, 215, 52, 0.50)',
    label: 'Queued',
  },
  critical: {
    color: PALETTE.accent3,
    dot: PALETTE.accent3,
    halo: '0 0 8px rgba(246, 70, 93, 0.50)',
    label: 'Critical',
  },
  idle: {
    color: '#6b7280',
    dot: '#474d57',
    dotLight: '#848e9c',
    halo: '0 0 4px rgba(71, 77, 87, 0.40)',
    label: 'Idle',
  },
} as const;

// ============================================================================
// 5. SEMANTIC THEME TOKENS (Dark & Light Mode)
// ============================================================================

export interface ThemeTokens {
  mode: 'dark' | 'light';
  surfaces: {
    canvas: string;
    panel: string;
    subtle: string;
    hover: string;
    active: string;
  };
  borders: {
    hairline: string;
    strong: string;
    focus: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    onPrimary: string;
    link: string;
  };
  shadows: {
    card: string;
    elevated: string;
    modal: string;
  };
  status: typeof STATUS_SIGNALS;
  spacing: typeof SPACING;
  radii: typeof RADII;
  typography: typeof TYPOGRAPHY;
}

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
  text: {
    primary: '#ffffff',
    secondary: '#9ca3af',
    muted: '#6b7280',
    onPrimary: '#000000',
    link: '#b29527',
  },
  shadows: {
    card: '0 2px 8px rgba(0, 0, 0, 0.60)',
    elevated: '0 12px 24px -4px rgba(0, 0, 0, 0.85)',
    modal: '0 24px 48px -8px rgba(0, 0, 0, 0.95)',
  },
  status: STATUS_SIGNALS,
  spacing: SPACING,
  radii: RADII,
  typography: TYPOGRAPHY,
};

export const LIGHT_THEME: ThemeTokens = {
  mode: 'light',
  surfaces: {
    canvas: '#ffffff',
    panel: '#ffffff',
    subtle: '#f8f9fa',
    hover: '#f1f3f5',
    active: '#e9ecef',
  },
  borders: {
    hairline: '#eaecef',
    strong: '#cbd5e1',
    focus: 'rgba(250, 215, 52, 0.35)',
  },
  text: {
    primary: '#000000',
    secondary: '#474d57',
    muted: '#848e9c',
    onPrimary: '#000000',
    link: '#b29527',
  },
  shadows: {
    card: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.02)',
    elevated: '0 4px 12px -2px rgba(0, 0, 0, 0.08)',
    modal: '0 20px 32px -4px rgba(0, 0, 0, 0.12)',
  },
  status: STATUS_SIGNALS,
  spacing: SPACING,
  radii: RADII,
  typography: TYPOGRAPHY,
};

// ============================================================================
// 6. CANONICAL ACCESSORS & REUSABLE COMPONENT PRESETS
// ============================================================================

export const THEME = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
  default: DARK_THEME,
} as const;

/**
 * Returns the active ThemeTokens object based on the current theme mode.
 */
export function getTheme(mode: 'dark' | 'light' = 'dark'): ThemeTokens {
  return mode === 'light' ? LIGHT_THEME : DARK_THEME;
}

/**
 * Pre-composed, standard component style presets to prevent ad-hoc styling.
 */
export const COMPONENT_STYLES = {
  /**
   * Primary Action Button Preset (Gold fill, bold black text, inset highlight)
   * WCAG AAA 14.86:1 contrast ratio.
   */
  primaryButton: {
    height: '38px',
    padding: `0 ${SPACING.md}`,
    backgroundColor: PALETTE.primary,
    color: PALETTE.background,
    border: 'none',
    borderRadius: RADII.sm,
    fontWeight: TYPOGRAPHY.weights.bold,
    fontSize: '0.875rem',
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.35)',
    transition: 'all 0.12s ease',
  },
  /**
   * Secondary Action Button Preset (1px hairline border)
   */
  secondaryButton: (theme: ThemeTokens = DARK_THEME) => ({
    height: '38px',
    padding: `0 ${SPACING.md}`,
    backgroundColor: 'transparent',
    color: theme.text.primary,
    border: `1px solid ${theme.borders.hairline}`,
    borderRadius: RADII.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    fontSize: '0.875rem',
    cursor: 'pointer',
    transition: 'all 0.12s ease',
  }),
  /**
   * Text Input Resting State Preset (DESIGN.md Section 7.2)
   */
  input: (theme: ThemeTokens = DARK_THEME) => ({
    height: '38px',
    backgroundColor: theme.surfaces.canvas,
    color: theme.text.primary,
    border: `1px solid ${theme.mode === 'light' ? theme.borders.strong : theme.borders.hairline}`,
    borderRadius: RADII.sm,
    padding: `0 ${SPACING.sm}`,
    fontSize: '0.875rem',
    outline: 'none',
    transition: 'all 0.15s ease',
  }),
  /**
   * Card / Panel Container Preset (DESIGN.md Section 6 & 7)
   */
  card: (theme: ThemeTokens = DARK_THEME) => ({
    backgroundColor: theme.surfaces.panel,
    border: `1px solid ${theme.borders.hairline}`,
    borderRadius: RADII.md,
    boxShadow: theme.shadows.card,
  }),
  /**
   * Unboxed Status Dot Preset (DESIGN.md Section 7.3)
   */
  statusDot: (type: keyof typeof STATUS_SIGNALS, mode: 'dark' | 'light' = 'dark') => ({
    width: '6px',
    height: '6px',
    borderRadius: RADII.full,
    backgroundColor: type === 'idle' && mode === 'light' ? STATUS_SIGNALS.idle.dotLight : STATUS_SIGNALS[type].dot,
    boxShadow: STATUS_SIGNALS[type].halo,
    display: 'inline-block',
    flexShrink: 0,
  }),
} as const;
