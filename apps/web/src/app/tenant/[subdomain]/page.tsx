import React from 'react';
import Link from 'next/link';

interface TenantIndexProps {
  params: Promise<{ subdomain: string }>;
}

export default async function TenantIndexPage({ params }: TenantIndexProps) {
  const { subdomain } = await params;
  return (
    <section style={{ padding: '3rem 2rem', maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
      <h2>Welcome to your Workspace</h2>
      <p style={{ color: '#666', marginTop: '0.5rem' }}>
        You are connected to <strong>{subdomain}.fbuploadpro.com</strong>
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Link
          href={`/tenant/${subdomain}/dashboard`}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#0066cc',
            color: '#fff',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: '600',
          }}
        >
          Open Workspace Dashboard &rarr;
        </Link>
      </div>
    </section>
  );
}
