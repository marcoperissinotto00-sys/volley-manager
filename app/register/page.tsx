'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    // Se la conferma email è attiva, non c'è ancora una sessione
    if (data.session) {
      router.replace('/calendar');
    } else {
      setNeedsConfirmation(true);
    }
  }

  if (needsConfirmation) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">
            Ti abbiamo inviato un link di conferma. Aprilo per attivare l&apos;account, poi torna qui ad accedere.
          </p>
          <Link href="/login" className="inline-block mt-5 text-blue-600 font-medium hover:underline">
            Vai al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🏐</div>
          <h1 className="text-2xl font-bold text-slate-900">Unisciti alla squadra</h1>
          <p className="text-sm text-slate-500 mt-1">Crea il tuo account giocatore</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cognome</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-slate-900"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-slate-900"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creazione account…' : 'Crea account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          Hai già un account?{' '}
          <Link href="/login" className="text-blue-600 font-medium hover:underline">
            Accedi
          </Link>
        </p>

        <p className="text-center text-xs text-slate-400 mt-3">
          Ti registri come giocatore. Il tuo allenatore potrà promuoverti se necessario.
        </p>
      </div>
    </div>
  );
}
