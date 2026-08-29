'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow text-center">
          <div className="text-4xl mb-3">📧</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Controlla la tua email</h1>
          <p className="text-sm text-slate-500">
            Se esiste un account con questo indirizzo, ti abbiamo inviato un link per reimpostare la password.
          </p>
          <Link href="/login" className="inline-block mt-5 text-blue-600 font-medium hover:underline">
            Torna al login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h1 className="text-2xl font-bold text-slate-900">Recupera password</h1>
          <p className="text-sm text-slate-500 mt-1">Ti inviamo un link per reimpostarla</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-slate-900 text-base"
              autoComplete="email"
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
            {submitting ? 'Invio…' : 'Invia link'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link href="/login" className="text-blue-600 font-medium hover:underline">← Torna al login</Link>
        </p>
      </div>
    </div>
  );
}
