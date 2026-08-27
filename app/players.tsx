'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Assicurati che il percorso coincida con il file creato al Passo 1

// 1. Definiamo l'interfaccia del Giocatore
interface Player {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number?: number;
  court_role?: string;
}

export default function PlayersPage() {
  // 2. Specifichiamo il tipo dell'array di stato Player[]
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchPlayers();
  }, []);

  if (loading) return <div className="p-6">Caricamento in corso...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Anagrafica Squadra</h1>
      <ul className="space-y-2">
        {players.map((player) => (
          <li key={player.id} className="p-4 bg-white shadow rounded-lg flex justify-between items-center text-slate-900">
            <div>
              <span className="font-bold text-lg mr-3">
                {player.jersey_number ? `#${player.jersey_number}` : '-'}
              </span>
              <span className="font-medium">
                {player.first_name} {player.last_name}
              </span>
            </div>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
              {player.court_role || 'Non assegnato'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}