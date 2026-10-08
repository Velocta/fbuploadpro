import React from 'react';
import { THEME } from '@/lib/theme';

export default function InsightsLoading() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: THEME.default.spacing.xl, textAlign: 'center' }}>
      <p style={{ color: THEME.default.text.secondary, fontSize: '0.875rem' }}>Loading insights...</p>
    </div>
  );
}
