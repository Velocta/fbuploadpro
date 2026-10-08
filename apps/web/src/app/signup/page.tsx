import Link from 'next/link';

export default function SignupPage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '420px', margin: '4rem auto' }}>
      <h2>Create Your FBUploadPro Account</h2>
      <p style={{ color: '#555', fontSize: '0.95rem' }}>
        Reserve your dedicated subdomain and start automating Facebook publishing.
      </p>

      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
        <div>
          <label htmlFor="workspace" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Workspace Subdomain
          </label>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              id="workspace"
              type="text"
              placeholder="yourname"
              required
              pattern="[a-z0-9-]+"
              style={{ flex: 1, padding: '0.5rem', borderRadius: '4px 0 0 4px', border: '1px solid #ccc' }}
            />
            <span
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f1f1f1',
                border: '1px solid #ccc',
                borderLeft: 'none',
                borderRadius: '0 4px 4px 0',
                color: '#666',
                fontSize: '0.9rem',
              }}
            >
              .fbuploadpro.com
            </span>
          </div>
          <small style={{ color: '#888' }}>Lowercase letters, numbers, and hyphens only.</small>
        </div>

        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="you@domain.com"
            required
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 'bold' }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: '0.65rem 1rem',
            backgroundColor: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: '0.5rem',
          }}
        >
          Create Workspace & Sign Up
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: '#0066cc', fontWeight: 'bold', textDecoration: 'none' }}>
          Sign In
        </Link>
      </div>
    </main>
  );
}
