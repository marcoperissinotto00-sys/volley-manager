'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

// Personalizza nome e icona usati da Android/iOS quando l'utente fa
// "Installa app" / "Aggiungi a schermata Home", in base alla squadra
// dell'utente loggato. Niente da fare qui per chi non ha ancora una
// squadra (team_id null): restano i valori di default di app/layout.tsx
// e app/manifest.ts (icona/nome "Dindiats Volley").
export default function TeamBranding() {
  const { team } = useAuth();

  useEffect(() => {
    if (!team) return;

    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = `/api/team-manifest/${team.id}`;

    if (team.logo_url) {
      let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (!appleIcon) {
        appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = team.logo_url;
    }

    let appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitle) {
      appleTitle = document.createElement('meta');
      appleTitle.name = 'apple-mobile-web-app-title';
      document.head.appendChild(appleTitle);
    }
    appleTitle.content = team.name;

    document.title = team.name;
  }, [team]);

  return null;
}
