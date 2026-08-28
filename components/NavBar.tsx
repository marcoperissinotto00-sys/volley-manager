'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const TABS = [
  { href: '/calendar', label: 'Calendario', icon: '📅' },
  { href: '/players', label: 'Rosa', icon: '🏐' },
];

export default function NavBar() {
  const { user, profile, isCoach, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🏐</span>
            <span className="text-sm font-semibold text-slate-900 truncate">
              {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
            </span>
            {isCoach && (
              <span className="shrink-0 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                Allenatore
              </span>
            )}
          </div>
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
        <div className="max-w-4xl mx-auto grid grid-cols-2">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-semibold active:bg-slate-50 transition-colors ${
                  active ? 'text-blue-600' : 'text-slate-500'
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
