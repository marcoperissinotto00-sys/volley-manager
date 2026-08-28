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
  const { user, loading, isCoach } = useAuth();
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

  if (loading || !user || (coachOnly && !isCoach)) {
    return (
      <div className="p-8 text-center text-slate-500">Caricamento…</div>
    );
  }

  return <>{children}</>;
}
