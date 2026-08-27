'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number | null;
  court_role?: string | null;
}

const ROLES = [
  'Palleggiatore',
  'Schiacciatore',
  'Centrale',
  'Opposto',
  'Libero',
];

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);

  // Stato per il form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [courtRole, setCourtRole] = useState('');

  // Recupera i giocatori dal DB
  async function fetchPlayers() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_role', 'player')
      .order('jersey_number', { ascending: true });

    if (!error && data) {
      setPlayers(data as Player[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Gestione dell'invio del Form
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return;

    setSubmitting(true);

    const newPlayerData = {
      first_name: firstName,
      last_name: lastName,
      jersey_number: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
      court_role: courtRole || null,
      user_role: 'player', // Imposta il ruolo utente predefinito come giocatore
    };

    const { error } = await supabase.from('users').insert([newPlayerData]);

    setSubmitting(false);

    if (error) {
      alert(`Errore durante il salvataggio: ${error.message}`);
    } else {
      // Resetta i campi del form
      setFirstName('');
      setLastName('');
      setJerseyNumber('');
      setCourtRole('');
      setShowForm(false);
      // Ricarica la lista aggiornata
      fetchPlayers();
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Caricamento rosa in corso...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Anagrafica Squadra</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Chiudi Form' : '+ Nuovo Giocatore'}
        </button>
      </div>

      {/* MODULO DI INSERIMENTO */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-6 bg-slate-50 rounded-xl shadow-md border border-slate-200 space-y-4"
        >
          <h2 className="text-xl font-semibold text-slate-800 border-b pb-2">
            Aggiungi Giocatore
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="es. Mario"
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cognome *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="es. Rossi"
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Numero di Maglia
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                placeholder="es. 10"
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ruolo in Campo
              </label>
              <select
                value={courtRole}
                onChange={(e) => setCourtRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-900 bg-white"
              >
                <option value="">Seleziona Ruolo...</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvataggio...' : 'Salva Giocatore'}
            </button>
          </div>
        </form>
      )}

      {/* LISTA GIOCATORI */}
      {players.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">
          Nessun giocatore presente. Clicca su "+ Nuovo Giocatore" per iniziare.
        </div>
      ) : (
        <ul className="space-y-3">
          {players.map((player) => (
            <li
              key={player.id}
              className="p-4 bg-white shadow rounded-lg flex justify-between items-center text-slate-900 border border-slate-100"
            >
              <div className="flex items-center space-x-4">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 font-bold text-lg text-slate-700 rounded-full">
                  {player.jersey_number ? `#${player.jersey_number}` : '-'}
                </span>
                <span className="font-semibold text-lg">
                  {player.first_name} {player.last_name}
                </span>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                {player.court_role || 'Non assegnato'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}