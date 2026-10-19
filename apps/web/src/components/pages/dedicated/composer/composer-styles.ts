import type { CSSProperties } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';

/** Small field label used above composer controls. */
export const composerLabelStyle: CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: TYPOGRAPHY.weights.medium,
  color: `var(--text-sub, ${THEME.default.text.secondary})`,
};

/** Quiet helper/hint line under a control. */
export const composerHintStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: `var(--text-sub, ${THEME.default.text.secondary})`,
  lineHeight: 1.5,
};

/** Blocking inline error text. */
export const composerErrorStyle: CSSProperties = {
  fontSize: '0.8125rem',
  color: PALETTE.accent3,
  lineHeight: 1.5,
};

/** Plain text-button option (segmented controls, quiet actions). */
export function segmentedOptionStyle(isActive: boolean, isDisabled = false): CSSProperties {
  return {
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${isActive ? PALETTE.primary : 'transparent'}`,
    borderRadius: 0,
    padding: `${SPACING.xs} ${SPACING.sm}`,
    fontSize: '0.875rem',
    fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
    color: isDisabled
      ? `var(--text-sub, ${THEME.default.text.secondary})`
      : isActive
        ? `var(--text-main, ${THEME.default.text.primary})`
        : `var(--text-sub, ${THEME.default.text.secondary})`,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.55 : 1,
  };
}

/** Text input style honoring the theme input preset. */
export function composerInputStyle(): CSSProperties {
  return {
    ...COMPONENT_STYLES.input(THEME.default),
    width: '100%',
    boxSizing: 'border-box',
  };
}

/** Quiet secondary button (secondary actions inside the composer). */
export function composerSecondaryButtonStyle(): CSSProperties {
  return {
    ...COMPONENT_STYLES.secondaryButton(THEME.default),
    height: '34px',
    fontSize: '0.8125rem',
  };
}

/** Field wrapper: label + control stacked with a small gap. */
export const composerFieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xs,
};

/** Error-tinted input border for invalid fields. */
export const composerInputErrorBorder: CSSProperties = {
  border: `1px solid ${PALETTE.accent3}`,
};

export { RADII, SPACING, TYPOGRAPHY, PALETTE, THEME, COMPONENT_STYLES };
