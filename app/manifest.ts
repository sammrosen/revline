import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RevLine | Revenue Infrastructure',
    short_name: 'RevLine',
    description: 'Private orchestration and monitoring platform for revenue-critical workflows.',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#7c3aed',
    icons: [
      { src: '/icons/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
