'use client';

/** Recover from render errors without an infinite auto-reset loop. */
export default function Error({ error, reset }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4faf6', padding: '1.5rem' }}>
      <div className="glass-panel" style={{ padding: '1.5rem 2rem', maxWidth: 420, textAlign: 'center' }}>
        <p style={{ color: '#991b1b', fontWeight: 600, marginBottom: '0.5rem' }}>Dashboard error</p>
        <p style={{ color: '#3d5a48', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {error?.message || 'Something went wrong loading this page.'}
        </p>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Reload dashboard
        </button>
      </div>
    </div>
  );
}
