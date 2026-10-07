import React from 'react';
import { getServerSessionContext } from '../../../../lib/auth';

interface DashboardPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#202124' }}>
          Workspace Overview
        </h1>
        <p style={{ margin: '0.5rem 0 0', color: '#5f6368', fontSize: '0.95rem' }}>
          Active Tenant: <strong>{subdomain}</strong> {session?.email && `(${session.email})`}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #dadce0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#5f6368', textTransform: 'uppercase' }}>Subdomain Slug</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#1a73e8' }}>{subdomain}</p>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #dadce0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#5f6368', textTransform: 'uppercase' }}>Account Role</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#202124', textTransform: 'capitalize' }}>
            {session?.role || 'User'}
          </p>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #dadce0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#5f6368', textTransform: 'uppercase' }}>Publishing Status</h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1.5rem', fontWeight: 'bold', color: '#34a853' }}>Active</p>
        </div>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #dadce0' }}>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem' }}>Connected Facebook Channels</h2>
        <p style={{ color: '#5f6368', fontSize: '0.9rem' }}>
          Connect Facebook accounts and select target Facebook Pages for scheduled short-form video publishing.
        </p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
          <a
            href={`/tenant/${subdomain}/accounts`}
            style={{
              display: 'inline-block',
              textDecoration: 'none',
              padding: '0.6rem 1.2rem',
              backgroundColor: '#1877f2',
              color: '#fff',
              borderRadius: '4px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Manage Facebook Channels &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
