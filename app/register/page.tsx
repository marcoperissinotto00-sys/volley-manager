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

  async function handleGoogleSignup() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/calendar` },
    });
    if (error) setError(error.message);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" className="w-16 h-16 rounded-full object-cover mx-auto mb-2 border" />
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

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400 font-medium">oppure</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2.5"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3a7.4 7.4 0 0 1-11-3.89H1.08v3.09A12 12 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.07 14.19a7.2 7.2 0 0 1 0-4.38V6.72H1.08a12 12 0 0 0 0 10.56l3.99-3.09z" />
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.08 6.72l3.99 3.09A7.17 7.17 0 0 1 12 4.77z" />
          </svg>
          Registrati con Google
        </button>

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
