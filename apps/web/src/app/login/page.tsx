export default function LoginPage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '400px', margin: '4rem auto' }}>
      <h2>Sign In to Workspace</h2>
      <p style={{ color: '#555' }}>Enter your credentials to access your tenant workspace.</p>
      <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
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
            padding: '0.6rem 1rem',
            backgroundColor: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Sign In
        </button>
      </form>
    </main>
  );
}
