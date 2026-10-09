import React from 'react';
import { THEME } from '@/lib/theme';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ children }: TenantLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: THEME.default.surfaces.canvas,
        color: THEME.default.text.primary,
        fontFamily: THEME.default.typography.fontFamily,
      }}
    >
      <main style={{ flex: 1, padding: THEME.default.spacing.xl }}>
        {children}
      </main>
    </div>
  );
}
