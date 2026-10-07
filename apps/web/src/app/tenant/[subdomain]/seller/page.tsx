import { getServerSessionContext } from '../../../../lib/auth';
import { assertRole } from '../../../../lib/rbac';
import Link from 'next/link';

interface SellerPageProps {
  params: Promise<{ subdomain: string }>;
}

export default async function SellerPortalPage({ params }: SellerPageProps) {
  const { subdomain } = await params;
  const session = await getServerSessionContext();

  if (!session) {
    return (
      <section style={{ padding: '2rem' }}>
        <h2>Unauthorized</h2>
        <p>Please log in to view the seller portal.</p>
      </section>
    );
  }

  // Enforces RBAC: Throws 403 DomainError if user role is insufficient
  assertRole(session.role, 'seller');

  return (
    <section style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Seller Management Portal</h1>
      <p style={{ color: '#555' }}>
        Workspace: <strong>{subdomain}</strong> | Role: <span style={{ textTransform: 'uppercase', color: '#0066cc', fontWeight: 'bold' }}>{session.role}</span>
      </p>
      <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
        <h3>Seller Capabilities</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>Template Publishing & Asset Sharing</li>
          <li>Client Campaign Orchestration</li>
          <li>Automated Multi-Channel Reels Distribution</li>
        </ul>
      </div>
      <div style={{ marginTop: '1.5rem' }}>
        <Link href={`/tenant/${subdomain}/dashboard`} style={{ color: '#0066cc' }}>
          &larr; Back to Dashboard
        </Link>
      </div>
    </section>
  );
}
