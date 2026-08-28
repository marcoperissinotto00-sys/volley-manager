'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import RequireAuth from '@/components/RequireAuth';

interface EventRow {
  id: string;
  title: string;
  date_time: string;
  location: string | null;
  opponent_name: string | null;
  is_home_game: boolean | null;
  maps_url: string | null;
}

interface MatchRow {
  id: string;
  event_id: string;
  opponent_name: string;
  is_home_game: boolean;
  sets_won: number | null;
  sets_lost: number | null;
  notes: string | null;
}

interface SetStatRow {
  id: string;
  match_id: string;
  user_id: string;
  set_number: number;
  played_as_libero: boolean;
  is_starter: boolean;
}

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  jersey_number: number | null;
  court_role: string | null;
}

function MatchPageContent() {
  const params = useParams();
  const eventId = params.id as string;
  const { showError } = useToast();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [setStats, setSetStats] = useState<SetStatRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [checkedInPlayers, setCheckedInPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSet, setActiveSet] = useState(1);

  // form risultato (avversario e sede vengono dall'evento, non li ripetiamo)
  const [setsWon, setSetsWon] = useState('');
  const [setsLost, setSetsLost] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  const [savingResult, setSavingResult] = useState(false);
  const [resultSaved, setResultSaved] = useState(false);

  const MAX_SETS = 5;

  async function fetchAll() {
    setLoading(true);

    const [
      { data: evData, error: evError },
      { data: matchData, error: matchError },
      { data: playersData, error: playersError },
      { data: attData, error: attError },
    ] = await Promise.all([
      supabase.from('events').select('id, title, date_time, location, opponent_name, is_home_game, maps_url').eq('id', eventId).single(),
      supabase.from('matches').select('*').eq('event_id', eventId).maybeSingle(),
      supabase.from('users').select('id, first_name, last_name, jersey_number, court_role').eq('is_active', true).order('jersey_number', { ascending: true, nullsFirst: false }),
      supabase.from('attendances').select('user_id').eq('event_id', eventId).eq('checked_in', true),
    ]);

    const loadError = evError || matchError || playersError || attError;
    if (loadError) showError(`Impossibile caricare i dati: ${loadError.message}`);

    if (evData) setEvent(evData as EventRow);

    if (matchData) {
      setMatch(matchData as MatchRow);
      setSetsWon(matchData.sets_won != null ? String(matchData.sets_won) : '');
      setSetsLost(matchData.sets_lost != null ? String(matchData.sets_lost) : '');
      setMatchNotes(matchData.notes || '');

      const { data: realStats, error: statsError } = await supabase
        .from('match_set_stats')
        .select('*')
        .eq('match_id', matchData.id);
      if (statsError) showError(`Impossibile caricare le formazioni: ${statsError.message}`);
      setSetStats((realStats || []) as SetStatRow[]);
    }

    setPlayers((playersData || []) as PlayerRow[]);
    setCheckedInPlayers((attData || []).map((a) => a.user_id));
    setLoading(false);
  }

  useEffect(() => {
    if (eventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Crea o aggiorna il record match con avversario/sede dall'evento
  async function ensureMatch(): Promise<string | null> {
    if (match) return match.id;
    if (!event) return null;

    const { data, error } = await supabase.from('matches').insert([{
      event_id: eventId,
      opponent_name: event.opponent_name || 'Avversario',
      is_home_game: event.is_home_game ?? true,
      sets_won: null,
      sets_lost: null,
      notes: null,
    }]).select().single();

    if (error || !data) {
      showError(`Impossibile creare la partita: ${error?.message ?? 'errore sconosciuto'}`);
      return null;
    }
    setMatch(data as MatchRow);
    return data.id;
  }

  async function saveResult() {
    setSavingResult(true);
    const matchId = await ensureMatch();
    if (!matchId) { setSavingResult(false); return; }

    const { error } = await supabase.from('matches').update({
      sets_won: setsWon !== '' ? parseInt(setsWon) : null,
      sets_lost: setsLost !== '' ? parseInt(setsLost) : null,
      notes: matchNotes || null,
    }).eq('id', matchId);

    setSavingResult(false);
    if (error) {
      showError(`Impossibile salvare il risultato: ${error.message}`);
    } else {
      setResultSaved(true);
      setTimeout(() => setResultSaved(false), 2000);
    }
    await fetchAll();
  }

  async function togglePlayerInSet(playerId: string, setNumber: number) {
    const matchId = await ensureMatch();
    if (!matchId) return;

    const existing = setStats.find((s) => s.match_id === matchId && s.user_id === playerId && s.set_number === setNumber);
    const { error } = existing
      ? await supabase.from('match_set_stats').delete().eq('id', existing.id)
      : await supabase.from('match_set_stats').insert([{
          match_id: matchId,
          user_id: playerId,
          set_number: setNumber,
          played_as_libero: false,
          is_starter: true,
        }]);
    if (error) showError(`Impossibile aggiornare la formazione: ${error.message}`);

    const { data } = await supabase.from('match_set_stats').select('*').eq('match_id', matchId);
    setSetStats((data || []) as SetStatRow[]);
  }

  async function toggleLibero(playerId: string, setNumber: number) {
    if (!match) return;
    const existing = setStats.find((s) => s.match_id === match.id && s.user_id === playerId && s.set_number === setNumber);
    if (!existing) return;
    const { error } = await supabase.from('match_set_stats').update({ played_as_libero: !existing.played_as_libero }).eq('id', existing.id);
    if (error) showError(`Impossibile aggiornare il libero: ${error.message}`);
    const { data } = await supabase.from('match_set_stats').select('*').eq('match_id', match.id);
    setSetStats((data || []) as SetStatRow[]);
  }

  async function toggleStarter(playerId: string, setNumber: number) {
    if (!match) return;
    const existing = setStats.find((s) => s.match_id === match.id && s.user_id === playerId && s.set_number === setNumber);
    if (!existing) return;
    const { error } = await supabase.from('match_set_stats').update({ is_starter: !existing.is_starter }).eq('id', existing.id);
    if (error) showError(`Impossibile aggiornare titolare/cambio: ${error.message}`);
    const { data } = await supabase.from('match_set_stats').select('*').eq('match_id', match.id);
    setSetStats((data || []) as SetStatRow[]);
  }

  function startersInSet(setNumber: number) {
    return setStats.filter((s) => s.set_number === setNumber && s.is_starter).length;
  }

  function playersInSet(setNumber: number) {
    return setStats.filter((s) => s.set_number === setNumber);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  if (loading) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;
  if (!event) return <div className="p-6 text-center text-red-600">Evento non trovato.</div>;

  const availablePlayers = checkedInPlayers.length > 0
    ? players.filter((p) => checkedInPlayers.includes(p.id))
    : players;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 -mx-2 -my-1">
        <Link href="/calendar" className="hover:text-blue-600 px-2 py-1">← Calendario</Link>
        <span>/</span>
        <span className="text-slate-900 font-medium px-2 py-1">Gestione partita</span>
      </div>

      {/* Intestazione — dati dall'evento */}
      <div className="bg-slate-900 text-white rounded-xl p-5 space-y-3">
        <div className="text-xs text-slate-400 uppercase tracking-wider">{formatDate(event.date_time)}</div>

        {/* Avversario e sede — letti dall'evento */}
        <div className="flex items-center gap-3 flex-wrap">
          {event.opponent_name && (
            <span className="px-3 py-1 bg-amber-500 text-slate-900 font-bold rounded-full text-sm">
              vs {event.opponent_name}
            </span>
          )}
          {event.is_home_game != null && (
            <span className="text-slate-300 text-sm">
              {event.is_home_game ? '🏠 Casa' : '✈️ Trasferta'}
            </span>
          )}
        </div>

        {/* Luogo con link Maps */}
        {event.location && (
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            <span>📍 {event.location}</span>
            {event.maps_url && (
              <a href={event.maps_url} target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline text-xs px-2 py-1.5 -my-1.5">
                Apri Maps →
              </a>
            )}
          </div>
        )}
      </div>

      {/* Risultato */}
      <div className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Risultato finale</h2>
        <div className="bg-slate-900 rounded-xl p-5 flex items-center justify-center gap-5">
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Set vinti</div>
            <input type="number" min="0" max="3" value={setsWon}
              onChange={(e) => { setSetsWon(e.target.value); setResultSaved(false); }}
              className="w-16 bg-transparent text-center text-amber-400 font-mono font-bold text-5xl tabular-nums outline-none border-b-2 border-slate-700 focus:border-amber-400 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
          <span className="text-slate-600 font-mono font-bold text-5xl pb-1">–</span>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Set persi</div>
            <input type="number" min="0" max="3" value={setsLost}
              onChange={(e) => { setSetsLost(e.target.value); setResultSaved(false); }}
              className="w-16 bg-transparent text-center text-amber-400 font-mono font-bold text-5xl tabular-nums outline-none border-b-2 border-slate-700 focus:border-amber-400 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
          </div>
        </div>
        <button onClick={saveResult} disabled={savingResult}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm active:scale-95 transition-all ${resultSaved ? 'bg-green-600 text-white' : 'bg-slate-900 text-white'} disabled:opacity-50`}>
          {savingResult ? 'Salvo…' : resultSaved ? '✓ Salvato' : 'Salva'}
        </button>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Note partita</label>
          <input type="text" value={matchNotes}
            onChange={(e) => { setMatchNotes(e.target.value); setResultSaved(false); }}
            placeholder="Es. ottima difesa nel 3° set"
            className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
        </div>
      </div>

      {/* Formazioni set */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Formazioni per set</h2>
          {checkedInPlayers.length === 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
              Nessun check-in: tutti i giocatori attivi
            </span>
          )}
        </div>

        {/* Tab set */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {Array.from({ length: MAX_SETS }, (_, i) => i + 1).map((n) => {
            const count = playersInSet(n).length;
            return (
              <button key={n} onClick={() => setActiveSet(n)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${activeSet === n ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                Set {n}
                {count > 0 && <span className="ml-1 text-xs text-blue-600">({count})</span>}
              </button>
            );
          })}
        </div>

        {/* Lista giocatori per il set attivo */}
        <div className="bg-white rounded-xl shadow divide-y">
          <div className="px-4 py-3 bg-slate-50 rounded-t-xl flex justify-between items-center">
            <span className="font-semibold text-slate-700">Set {activeSet}</span>
            <span className="text-sm text-slate-500">
              {startersInSet(activeSet)} titolari · {playersInSet(activeSet).length - startersInSet(activeSet)} cambi
            </span>
          </div>

          {availablePlayers.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">Nessun giocatore disponibile.</div>
          ) : (
            availablePlayers.map((p) => {
              const stat = setStats.find((s) => s.user_id === p.id && s.set_number === activeSet);
              const inField = !!stat;
              return (
                <div key={p.id} className={`flex items-stretch gap-3 transition-colors ${inField ? 'bg-blue-50' : ''}`}>
                  <label className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 cursor-pointer select-none active:bg-blue-100/50">
                    <input type="checkbox" checked={inField} onChange={() => togglePlayerInSet(p.id, activeSet)}
                      className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${inField ? 'text-blue-900' : 'text-slate-700'}`}>
                        {p.jersey_number != null && <span className="text-slate-400 mr-1">#{p.jersey_number}</span>}
                        {p.first_name} {p.last_name}
                      </span>
                      {p.court_role && <span className="ml-2 text-xs text-slate-400">{p.court_role}</span>}
                    </div>
                  </label>
                  {inField && (
                    <div className="flex items-center gap-3 pr-4 py-3 shrink-0">
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm shrink-0">
                        <input type="checkbox" checked={!stat?.is_starter} onChange={() => toggleStarter(p.id, activeSet)}
                          className="w-5 h-5 accent-purple-500" />
                        <span className={`text-xs font-semibold ${!stat?.is_starter ? 'text-purple-700' : 'text-slate-400'}`}>Cambio</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-sm shrink-0">
                        <input type="checkbox" checked={!!stat?.played_as_libero} onChange={() => toggleLibero(p.id, activeSet)}
                          className="w-5 h-5 accent-amber-500" />
                        <span className={`text-xs font-semibold ${stat?.played_as_libero ? 'text-amber-700' : 'text-slate-400'}`}>Libero</span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-slate-400 text-center">Le formazioni si salvano automaticamente set per set.</p>
      </div>
    </div>
  );
}

export default function MatchPage() {
  return (
    <RequireAuth coachOnly>
      <MatchPageContent />
    </RequireAuth>
  );
}
