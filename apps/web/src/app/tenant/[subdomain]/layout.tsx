import React from 'react';
import Link from 'next/link';
import { getServerSessionContext } from '../../../lib/auth';
import { createDatabaseClient } from '@fbuploadpro/database';

interface TenantLayoutProps {
  params: Promise<{ subdomain: string }>;
  children: React.ReactNode;
}

export default async function TenantLayout({ params, children }: TenantLayoutProps) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();

  let tokensBalance = 0;
  if (session && process.env.DATABASE_URL) {
    try {
      const db = createDatabaseClient({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 1000,
      });
      const row = await db.queryOne<{ tokens_balance: string | number }>(
        'SELECT tokens_balance FROM users WHERE id = $1',
        [session.userId]
      );
      if (row) {
        tokensBalance = Number(row.tokens_balance);
      }
      await db.close();
    } catch {
      // In testing or fallback environments, graceful degradation to 0
      tokensBalance = 0;
    }
  }

  const role = session?.role || 'user';
  const roleColors: Record<string, string> = {
    admin: '#8e24aa',
    seller: '#00897b',
    user: '#0066cc',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 2rem',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/tenant/${subdomain}/dashboard`} style={{ textDecoration: 'none', color: '#111', fontWeight: 'bold', fontSize: '1.2rem' }}>
            FBUploadPro
          </Link>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              backgroundColor: '#f1f3f4',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#333',
            }}
          >
            {subdomain}
          </span>
          <span
            style={{
              padding: '0.2rem 0.6rem',
              backgroundColor: roleColors[role] || '#0066cc',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#ffffff',
              textTransform: 'uppercase',
            }}
          >
            {role}
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link href={`/tenant/${subdomain}/dashboard`} style={{ textDecoration: 'none', color: '#555', fontSize: '0.9rem' }}>
            Dashboard
          </Link>
          <Link href={`/tenant/${subdomain}/accounts`} style={{ textDecoration: 'none', color: '#555', fontSize: '0.9rem' }}>
            Facebook Channels
          </Link>
          {(role === 'seller' || role === 'admin') && (
            <Link href={`/tenant/${subdomain}/seller`} style={{ textDecoration: 'none', color: '#555', fontSize: '0.9rem' }}>
              Seller Portal
            </Link>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              backgroundColor: '#e8f0fe',
              borderRadius: '16px',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: '#1a73e8',
            }}
          >
            <span>⚡</span>
            <span>{tokensBalance} Tokens</span>
          </div>
          <Link
            href="/login"
            style={{
              textDecoration: 'none',
              fontSize: '0.85rem',
              color: '#d93025',
              padding: '0.35rem 0.75rem',
              border: '1px solid #fad2cf',
              borderRadius: '4px',
            }}
          >
            Sign Out
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1, backgroundColor: '#f8f9fa' }}>{children}</main>

      <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #e0e0e0', backgroundColor: '#fff', fontSize: '0.8rem', color: '#777', textAlign: 'center' }}>
        FBUploadPro &copy; 2026 | Multi-Tenant Workspace [{subdomain}]
      </footer>
    </div>
  );
}
