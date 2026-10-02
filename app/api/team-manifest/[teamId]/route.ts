import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Manifest PWA personalizzato per squadra: nome e icona usati da Android
// quando l'utente fa "Installa app" / "Aggiungi a schermata Home". Letto
// via RPC pubblica (nessuna sessione lato server, vedi lib/supabase.ts),
// quindi espone solo nome+logo, mai dati sensibili.
export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;

  const { data } = await supabase
    .rpc('get_team_branding', { p_team_id: teamId })
    .maybeSingle<{ name: string; logo_url: string | null }>();

  const name = data?.name || 'Dindiats Volley';
  const icon = data?.logo_url || '/icon.png';

  return NextResponse.json(
    {
      name,
      short_name: name,
      description: 'Gestione appuntamenti, presenze e rosa della squadra',
      start_url: '/calendar',
      display: 'standalone',
      background_color: '#094299',
      theme_color: '#2563eb',
      icons: [
        { src: icon, sizes: '192x192' },
        { src: icon, sizes: '512x512' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
