import type { CSSProperties } from 'react';
import { THEME, RADII, SPACING } from '@/lib/theme';

export const MODAL_BACKDROP_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: SPACING.md,
  boxSizing: 'border-box',
};

export const MODAL_CONTAINER_STYLE: CSSProperties = {
  width: '100%',
  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
  borderRadius: RADII.md,
  boxShadow: `var(--shadow-modal, ${THEME.default.shadows.modal})`,
  padding: SPACING.xl,
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.md,
};
