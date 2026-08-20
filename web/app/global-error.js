'use client';

/** Root-level error — manual reload only (no auto-reset loop). */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f4faf6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ padding: '1.5rem 2rem', maxWidth: 420, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#991b1b', fontWeight: 600, marginBottom: '0.5rem' }}>Application error</p>
          <p style={{ color: '#3d5a48', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {error?.message || 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                reset();
              } catch {
                window.location.href = '/';
              }
            }}
            style={{ padding: '0.5rem 1rem', background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
