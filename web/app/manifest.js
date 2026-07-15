/** Web app manifest — enables install as PWA on mobile/desktop. */
export default function manifest() {
  return {
    name: 'Titan Protection — Command Centre',
    short_name: 'Titan Protection',
    description: 'Security operations dashboard — guards, premises, patrols, and incidents.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f4faf6',
    theme_color: '#1b4332',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
