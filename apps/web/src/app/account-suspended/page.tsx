import Link from 'next/link';

export default function AccountSuspendedPage() {
  return (
    <main style={{ padding: '3rem 2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '500px', margin: '4rem auto', textAlign: 'center' }}>
      <h2 style={{ color: '#d93025' }}>Account Suspended</h2>
      <p style={{ color: '#555', marginTop: '1rem' }}>
        Your tenant workspace has been temporarily suspended. Please contact platform support or billing administration to resolve this notice.
      </p>
      <div style={{ marginTop: '2rem' }}>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#0066cc',
            color: '#fff',
            borderRadius: '4px',
            textDecoration: 'none',
          }}
        >
          Return to Platform Home
        </Link>
      </div>
    </main>
  );
}
