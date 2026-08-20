'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[Titan Protection]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f4faf6', color: '#0f1f17' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', borderRadius: 16, padding: '2rem', boxShadow: '0 4px 18px rgba(15,31,23,0.08)' }}>
            <img src="/emblem-wordmark.png" alt="Titan Protection" style={{ height: 48, marginBottom: '1.25rem' }} />
            <h1 style={{ fontSize: '1.25rem', color: '#1b4332', marginBottom: '0.5rem' }}>Something went wrong</h1>
            <p style={{ fontSize: '0.9rem', color: '#3d5a48', marginBottom: '1.5rem' }}>
              The dashboard hit an unexpected error. Your data is safe — reload to continue.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{ background: '#1b4332', color: '#fff', border: 'none', borderRadius: 8, padding: '0.6rem 1.2rem', cursor: 'pointer', fontWeight: 600 }}
              >
                Reload page
              </button>
              <a
                href="/login"
                style={{ background: '#fff', color: '#1b4332', border: '1px solid #d8e8de', borderRadius: 8, padding: '0.6rem 1.2rem', textDecoration: 'none', fontWeight: 600 }}
              >
                Sign in again
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
