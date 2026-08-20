'use client';

import { useEffect } from 'react';

/** Root-level recovery — auto-reload instead of blocking error screen. */
export default function GlobalError({ reset }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        reset();
      } catch {
        window.location.href = '/';
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#f4faf6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#3d5a48', fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem' }}>Refreshing…</p>
      </body>
    </html>
  );
}
