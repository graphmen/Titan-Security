'use client';

import { useEffect } from 'react';

/** Register service worker for PWA install + offline shell. */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* non-fatal — app still works without SW */
    });
  }, []);
  return null;
}
