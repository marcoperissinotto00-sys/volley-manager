import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dindiats Volley',
    short_name: 'Dindiats',
    description: 'Gestione appuntamenti, presenze e rosa della squadra',
    start_url: '/calendar',
    display: 'standalone',
    background_color: '#094299',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
