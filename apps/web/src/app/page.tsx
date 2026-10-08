import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>FBUploadPro</h1>
      <p>High-throughput multi-tenant Facebook publishing automation platform.</p>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#0066cc',
            color: '#ffffff',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          Sign In
        </Link>
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            padding: '0.6rem 1.2rem',
            backgroundColor: '#f1f5f9',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          Create Account
        </Link>
      </div>
    </main>
  );
}
