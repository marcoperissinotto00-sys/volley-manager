'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const TABS = [
  { href: '/calendar', label: 'Calendario', icon: '📅' },
  { href: '/players', label: 'Rosa', icon: '🏐' },
];

export default function NavBar() {
  const { user, profile, isCoach, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [medicalExpiring, setMedicalExpiring] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('athlete_medical_status').select('scadenza_visita_medica').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!data?.scadenza_visita_medica) { setMedicalExpiring(false); return; }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const target = new Date(data.scadenza_visita_medica); target.setHours(0, 0, 0, 0);
        const days = Math.round((target.getTime() - today.getTime()) / 86400000);
        setMedicalExpiring(days <= 15);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <>
      {/* Barra superiore: identità utente */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <Link href="/profile" className="flex items-center gap-2 min-w-0 active:opacity-70 transition-opacity">
            <span className="relative shrink-0">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/icon.png" alt="" className="w-7 h-7 rounded-full object-cover border" />
              )}
              {medicalExpiring && (
                <span
                  title="Visita medica in scadenza"
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"
                />
              )}
            </span>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
            </span>
            {isCoach && (
              <span className="shrink-0 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                Allenatore
              </span>
            )}
          </Link>
          <button
            onClick={handleSignOut}
            className="shrink-0 px-3 py-2 bg-slate-100 active:scale-95 text-slate-700 rounded-lg text-sm font-medium transition-all"
          >
            Esci
          </button>
        </div>
      </header>

      {/* Barra inferiore: navigazione principale, comoda da usare col pollice */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-2 p-2">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <span className="text-xl leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
