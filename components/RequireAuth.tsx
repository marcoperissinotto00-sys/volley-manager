'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Avvolgi una pagina con <RequireAuth> per obbligare il login.
 * Passa coachOnly per limitare la pagina a coach/admin
 * (es. una futura pagina di amministrazione avanzata).
 */
export default function RequireAuth({
  children,
  coachOnly = false,
}: {
  children: ReactNode;
  coachOnly?: boolean;
}) {
  const { user, profile, loading, isCoach, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (coachOnly && !isCoach) {
      router.replace('/calendar');
    }
  }, [loading, user, isCoach, coachOnly, router]);

  // Il profilo si carica in modo asincrono subito dopo che "user" diventa disponibile
  // (es. appena dopo il login): finché non arriva mostriamo solo "Caricamento…", mai
  // la schermata "in attesa di approvazione", che si applica solo a un profilo già
  // arrivato e effettivamente non attivo.
  if (loading || !user || (coachOnly && !isCoach) || !profile) {
    return (
      <div className="p-8 text-center text-slate-500">Caricamento…</div>
    );
  }

  if (!profile.is_active) {
    async function handleSignOut() {
      await signOut();
      router.replace('/login');
    }
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-sm text-center bg-white p-8 rounded-xl shadow">
          <div className="text-4xl mb-3">⏳</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Account in attesa di approvazione</h1>
          <p className="text-sm text-slate-500">
            Il tuo allenatore deve attivare il tuo account prima che tu possa accedere. Ti avviserà appena fatto.
          </p>
          <button
            onClick={handleSignOut}
            className="mt-5 px-4 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg active:scale-95 transition-all text-sm"
          >
            Esci
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
