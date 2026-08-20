'use client';

import { useEffect } from 'react';

/** Silently recover from transient render errors — no full-screen error page. */
export default function Error({ reset }) {
  useEffect(() => {
    const timer = setTimeout(() => reset(), 150);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4faf6' }}>
      <p style={{ color: '#3d5a48', fontSize: '0.9rem' }}>Refreshing dashboard…</p>
    </div>
  );
}
