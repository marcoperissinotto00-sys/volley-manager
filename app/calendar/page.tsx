'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import RequireAuth from '@/components/RequireAuth';

type EventType = 'training' | 'match' | 'event';
type AttendanceStatus = 'present' | 'late' | 'maybe' | 'absent';
type FilterTab = 'all' | 'training' | 'match';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  training: 'Allenamento',
  match: 'Partita',
  event: 'Evento',
};

const STATUS_CONFIG: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: 'present', label: '✓ Ci sono', activeClass: 'bg-blue-600 border-blue-600 text-white' },
  { value: 'late', label: '⏱ In ritardo', activeClass: 'bg-amber-500 border-amber-500 text-white' },
  { value: 'maybe', label: '? Forse', activeClass: 'bg-amber-300 border-amber-300 text-slate-900' },
  { value: 'absent', label: '✕ Non ci sono', activeClass: 'bg-red-500 border-red-500 text-white' },
];

interface EventRow {
  id: string;
  title: string;
  event_type: EventType;
  date_time: string;
  location: string | null;
  notes: string | null;
  opponent_name: string | null;
  is_home_game: boolean | null;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
}

interface AttendanceRow {
  id: string;
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  checked_in: boolean;
  users?: { first_name: string; last_name: string };
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return { dateStr, timeStr };
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function eventTitle(ev: EventRow): string {
  if (ev.event_type === 'match' && ev.opponent_name) {
    return `vs ${ev.opponent_name}`;
  }
  return ev.title || '—';
}

async function geocodeAddress(address: string): Promise<{ lat: number; lon: number; mapsUrl: string } | null> {
  if (!address.trim()) return null;
  try {
    const query = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'it', 'User-Agent': 'VolleyManager/1.0' } }
    );
    const data = await res.json();
    if (!data || data.length === 0) return null;
    const { lat, lon } = data[0];
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    return { lat: parseFloat(lat), lon: parseFloat(lon), mapsUrl };
  } catch {
    return null;
  }
}

function CalendarPageContent() {
  const { user, isCoach } = useAuth();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [attendances, setAttendances] = useState<Record<string, AttendanceRow[]>>({});
  const [matchResults, setMatchResults] = useState<Record<string, { sets_won: number | null; sets_lost: number | null }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [openWho, setOpenWho] = useState<Record<string, boolean>>({});
  const [openAppello, setOpenAppello] = useState<Record<string, boolean>>({});
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [showHistory, setShowHistory] = useState(false);

  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const PAGE_SIZE = 10;

  // Campi form
  const [eventType, setEventType] = useState<EventType>('training');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [isHomeGame, setIsHomeGame] = useState(true);
  const [trainingTitle, setTrainingTitle] = useState('');
  const [geoResult, setGeoResult] = useState<{ lat: number; lon: number; mapsUrl: string } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const geocodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAll(page = currentPage, tab = filterTab, history = showHistory) {
    setLoading(true);
    const now = new Date();
    const todayIso = now.toISOString();
    const in30DaysIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .range(from, to);

    if (history) {
      // storico: eventi passati, dal più recente al più vecchio
      query = query.lt('date_time', todayIso).order('date_time', { ascending: false });
    } else {
      // default: prossimi 30 giorni, crescente
      query = query.gte('date_time', todayIso).lte('date_time', in30DaysIso).order('date_time', { ascending: true });
    }

    if (tab === 'training') query = query.eq('event_type', 'training');
    if (tab === 'match') query = query.eq('event_type', 'match');

    const { data: eventsData, error: eventsError, count } = await query;

    if (!eventsError && eventsData) {
      setEvents(eventsData as EventRow[]);
      setTotalEvents(count ?? 0);

      const ids = eventsData.map((e) => e.id);
      if (ids.length > 0) {
        const { data: attData } = await supabase
          .from('attendances')
          .select('*')
          .in('event_id', ids);

        if (attData && attData.length > 0) {
          const userIds = Array.from(new Set(attData.map((a) => a.user_id)));
          const { data: usersData } = await supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', userIds);
          const userMap = new Map((usersData || []).map((u) => [u.id, u]));
          const grouped: Record<string, AttendanceRow[]> = {};
          attData.forEach((a) => {
            const row: AttendanceRow = { ...a, users: userMap.get(a.user_id) };
            if (!grouped[a.event_id]) grouped[a.event_id] = [];
            grouped[a.event_id].push(row);
          });
          setAttendances(grouped);
        } else {
          setAttendances({});
        }

        const matchIds = eventsData.filter((e) => e.event_type === 'match').map((e) => e.id);
        if (matchIds.length > 0) {
          const { data: matchesData } = await supabase
            .from('matches')
            .select('event_id, sets_won, sets_lost')
            .in('event_id', matchIds);
          const resultsMap: Record<string, { sets_won: number | null; sets_lost: number | null }> = {};
          (matchesData || []).forEach((m) => {
            resultsMap[m.event_id] = { sets_won: m.sets_won, sets_lost: m.sets_lost };
          });
          setMatchResults(resultsMap);
        } else {
          setMatchResults({});
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll(1, filterTab, showHistory);
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTab, showHistory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll(currentPage, filterTab, showHistory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  function handleLocationChange(value: string) {
    setLocation(value);
    setGeoResult(null);
    setGeoError(null);
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
    if (value.trim().length < 5) return;
    geocodeTimeout.current = setTimeout(async () => {
      setGeocoding(true);
      const result = await geocodeAddress(value);
      setGeocoding(false);
      if (result) {
        setGeoResult(result);
      } else {
        setGeoError('Indirizzo non trovato. Prova a essere più specifico.');
      }
    }, 800);
  }

  function resetForm() {
    setEventType('training'); setDateTime('');
    setLocation(''); setNotes(''); setOpponentName('');
    setIsHomeGame(true); setGeoResult(null); setGeoError(null);
    setTrainingTitle(''); setShowForm(false);
  }

  async function handleCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!dateTime) return;
    if (eventType === 'match' && !opponentName) {
      alert('Inserisci il nome dell\'avversario per le partite.');
      return;
    }
    if (eventType === 'event' && !trainingTitle) {
      alert('Inserisci un titolo per l\'evento.');
      return;
    }
    setSubmitting(true);

    // Per le partite e gli allenamenti il titolo è generato automaticamente
    const autoTitle = eventType === 'match'
      ? `vs ${opponentName}`
      : eventType === 'training'
        ? 'Allenamento'
        : trainingTitle;

    const payload = {
      title: autoTitle,
      event_type: eventType,
      date_time: new Date(dateTime).toISOString(),
      location: location || null,
      notes: notes || null,
      created_by: user?.id,
      opponent_name: eventType === 'match' ? opponentName : null,
      is_home_game: eventType === 'match' ? isHomeGame : null,
      latitude: geoResult?.lat ?? null,
      longitude: geoResult?.lon ?? null,
      maps_url: geoResult?.mapsUrl ?? null,
    };

    const { error } = await supabase.from('events').insert([payload]);
    setSubmitting(false);
    if (error) { alert(`Errore: ${error.message}`); return; }
    resetForm();
    fetchAll(currentPage, filterTab);
  }

  async function deleteEvent(id: string) {
    if (!confirm('Eliminare questo appuntamento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { alert(`Errore: ${error.message}`); return; }
    if (events.length === 1 && currentPage > 1) {
      setCurrentPage((p) => p - 1);
    } else {
      fetchAll(currentPage, filterTab, showHistory);
    }
  }

  async function setRsvp(eventId: string, status: AttendanceStatus) {
    if (!user) return;
    const current = attendances[eventId]?.find((a) => a.user_id === user.id);
    if (current && current.status === status) {
      await supabase.from('attendances').delete().eq('id', current.id);
    } else {
      await supabase.from('attendances').upsert(
        { event_id: eventId, user_id: user.id, status },
        { onConflict: 'event_id,user_id' }
      );
    }
    fetchAll(currentPage, filterTab, showHistory);
  }

  async function toggleCheckin(attendance: AttendanceRow) {
    await supabase.from('attendances')
      .update({ checked_in: !attendance.checked_in })
      .eq('id', attendance.id);
    fetchAll(currentPage, filterTab, showHistory);
  }

  const totalPages = Math.ceil(totalEvents / PAGE_SIZE) || 1;

  if (loading && events.length === 0) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {showHistory ? 'Storico eventi passati' : 'Prossimi 30 giorni'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setShowHistory((v) => !v); setShowForm(false); setCurrentPage(1); }}
            className={`px-3 py-2.5 font-semibold rounded-xl text-sm transition-all active:scale-95 border ${showHistory ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
            {showHistory ? '← Prossimi' : '🕐 Storico'}
          </button>
          {isCoach && !showHistory && (
            <button onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all text-sm">
              {showForm ? '✕' : '+ Nuovo'}
            </button>
          )}
        </div>
      </div>

      {/* Tab filtri */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {([['all', 'Tutti'], ['training', 'Allenamenti'], ['match', 'Partite']] as [FilterTab, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setFilterTab(val)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${filterTab === val ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Form nuovo evento */}
      {showForm && isCoach && (
        <form onSubmit={handleCreateEvent} className="bg-white p-5 rounded-xl shadow space-y-4">
          <h2 className="font-semibold text-slate-800">Nuovo appuntamento</h2>

          {/* Tipo */}
          <div className="flex gap-2">
            {(['training', 'match', 'event'] as EventType[]).map((t) => (
              <button key={t} type="button" onClick={() => setEventType(t)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${eventType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                {EVENT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Titolo solo per eventi generici: partite e allenamenti hanno un titolo automatico */}
            {eventType === 'event' && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Titolo</label>
                <input type="text" required value={trainingTitle} onChange={(e) => setTrainingTitle(e.target.value)}
                  placeholder="Es. Cena di squadra"
                  className="w-full p-3 border rounded-xl text-slate-900 text-base" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e ora</label>
              <input type="datetime-local" required value={dateTime} onChange={(e) => setDateTime(e.target.value)}
                className="w-full p-3 border rounded-xl text-slate-900 text-base" />
            </div>
          </div>

          {/* Dettagli partita */}
          {eventType === 'match' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="sm:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Dettagli partita</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Avversario <span className="text-red-500">*</span></label>
                <input type="text" value={opponentName} onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="Es. Pallavolo Rosso" className="w-full p-3 border rounded-xl text-slate-900 text-base" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sede</label>
                <div className="flex gap-2">
                  {[{ label: '🏠 Casa', value: true }, { label: '✈️ Trasferta', value: false }].map((opt) => (
                    <button key={String(opt.value)} type="button" onClick={() => setIsHomeGame(opt.value)}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${isHomeGame === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Luogo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Luogo {geocoding && <span className="ml-1 text-xs text-blue-500">🔍 Ricerca…</span>}
            </label>
            <input type="text" value={location} onChange={(e) => handleLocationChange(e.target.value)}
              placeholder="Es. Via Roma 1, Milano" className="w-full p-3 border rounded-xl text-slate-900 text-base" />
            {geoResult && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span>📍 Posizione trovata</span>
                <a href={geoResult.mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-blue-600 hover:underline text-xs font-medium px-2 py-1.5 -my-1.5 -mr-1">Verifica →</a>
              </div>
            )}
            {geoError && (
              <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ {geoError}</div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (facoltativo)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border rounded-xl text-slate-900 text-base" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-slate-200 text-slate-700 font-medium rounded-xl">Annulla</button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-xl disabled:opacity-50">
              {submitting ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      )}

      {/* Lista eventi */}
      {events.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl shadow text-slate-500">
          {showHistory
            ? 'Nessun evento passato trovato.'
            : filterTab === 'all' ? 'Nessun appuntamento nei prossimi 30 giorni.' : `Nessuna ${filterTab === 'match' ? 'partita' : 'allenamento'} nei prossimi 30 giorni.`}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {events.map((ev) => {
              const { dateStr, timeStr } = formatDateTime(ev.date_time);
              const list = attendances[ev.id] || [];
              const mine = user ? list.find((a) => a.user_id === user.id) : undefined;
              const confirmedList = list.filter((a) => ['present', 'late', 'maybe'].includes(a.status));
              const checkedInCount = list.filter((a) => a.checked_in).length;
              const open = !!openWho[ev.id];
              const appelloOpen = !!openAppello[ev.id];
              const today = isToday(ev.date_time);

              return (
                <li key={ev.id} className={`bg-white shadow-sm rounded-2xl border overflow-hidden ${today ? 'ring-2 ring-blue-500' : ''}`}>
                  {today && (
                    <div className="bg-blue-600 text-white text-xs font-bold text-center py-1.5 tracking-widest uppercase">Oggi</div>
                  )}

                  <div className="p-4 flex justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 text-xs font-bold uppercase rounded-full ${ev.event_type === 'match' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                          {EVENT_TYPE_LABELS[ev.event_type]}
                        </span>
                        {ev.event_type === 'match' && ev.is_home_game != null && (
                          <span className="text-xs text-slate-500">{ev.is_home_game ? '🏠 Casa' : '✈️ Trasferta'}</span>
                        )}
                        {ev.event_type === 'match' && matchResults[ev.id]?.sets_won != null && matchResults[ev.id]?.sets_lost != null && (
                          <span className="px-2 py-0.5 bg-slate-900 text-amber-400 font-mono font-bold text-xs rounded-full tabular-nums">
                            {matchResults[ev.id].sets_won}–{matchResults[ev.id].sets_lost}
                          </span>
                        )}
                        {ev.event_type === 'training' && (
                          <span className="text-sm font-bold text-slate-900">{dateStr} · {timeStr}</span>
                        )}
                      </div>

                      {/* Titolo: per partite "vs Avversario", per eventi generici il titolo; gli allenamenti non ne hanno bisogno (il badge basta) */}
                      {ev.event_type !== 'training' && (
                        <>
                          <div className="text-base font-bold text-slate-900 leading-snug">{eventTitle(ev)}</div>
                          <div className="text-sm text-slate-500 mt-0.5">{dateStr} · {timeStr}</div>
                        </>
                      )}

                      {ev.location && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">📍 {ev.location}</span>
                          {ev.maps_url && (
                            <a href={ev.maps_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-600 font-medium px-2 py-1.5 -my-1.5">Maps →</a>
                          )}
                        </div>
                      )}
                      {ev.notes && <div className="text-xs text-slate-400 italic mt-1">{ev.notes}</div>}

                      {ev.event_type === 'match' && isCoach && (
                        <Link href={`/match/${ev.id}`}
                          className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg active:scale-95 transition-all">
                          🏐 Gestisci partita →
                        </Link>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="bg-slate-900 rounded-xl px-3 py-1.5 text-center min-w-[56px]">
                        <div className="text-amber-400 font-bold text-lg leading-none">{String(confirmedList.length).padStart(2, '0')}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">RSVP</div>
                      </div>
                      {checkedInCount > 0 && (
                        <div className="bg-green-700 rounded-xl px-3 py-1.5 text-center min-w-[56px]">
                          <div className="text-white font-bold text-lg leading-none">{String(checkedInCount).padStart(2, '0')}</div>
                          <div className="text-[9px] text-green-300 uppercase tracking-wide mt-0.5">presenti</div>
                        </div>
                      )}
                      {isCoach && (
                        <button onClick={() => deleteEvent(ev.id)} className="text-xs text-slate-400 active:text-red-700 px-2 py-1.5 -mr-2">Elimina</button>
                      )}
                    </div>
                  </div>

                  {/* RSVP — bottoni grandi per mobile */}
                  <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                    {STATUS_CONFIG.map((s) => (
                      <button key={s.value} onClick={() => setRsvp(ev.id, s.value)}
                        className={`py-3 rounded-xl border text-sm font-semibold transition-colors active:scale-95 ${mine?.status === s.value ? s.activeClass : 'bg-white border-slate-200 text-slate-700'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Chi ha risposto */}
                  <button onClick={() => setOpenWho((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                    className="w-full text-left px-4 py-3 text-xs text-slate-500 border-t active:bg-slate-50">
                    {open ? '▾' : '▸'} Chi ha risposto ({list.length})
                  </button>
                  {open && (
                    <div className="px-4 pb-4 text-sm space-y-2 bg-slate-50 pt-3">
                      {STATUS_CONFIG.map((s) => {
                        const names = list.filter((a) => a.status === s.value)
                          .map((a) => a.users ? `${a.users.first_name} ${a.users.last_name}` : '—');
                        return (
                          <div key={s.value}>
                            <b className="text-xs uppercase tracking-wide text-slate-500">{s.label} ({names.length})</b>
                            <div className="text-slate-800">{names.join(', ') || '—'}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Appello — solo coach */}
                  {isCoach && confirmedList.length > 0 && (
                    <>
                      <button onClick={() => setOpenAppello((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                        className="w-full text-left px-4 py-3 text-xs font-semibold text-green-700 border-t active:bg-green-50">
                        {appelloOpen ? '▾' : '▸'} 📋 Appello ({checkedInCount}/{confirmedList.length})
                      </button>
                      {appelloOpen && (
                        <div className="px-4 pb-4 bg-green-50 pt-3 space-y-3">
                          <p className="text-xs text-slate-500">Spunta chi è fisicamente presente.</p>
                          {confirmedList.map((a) => {
                            const nome = a.users ? `${a.users.first_name} ${a.users.last_name}` : '—';
                            return (
                              <label key={a.id} className="flex items-center gap-3 cursor-pointer select-none py-1">
                                <input type="checkbox" checked={a.checked_in} onChange={() => toggleCheckin(a)}
                                  className="w-6 h-6 accent-green-600" />
                                <span className={`text-sm font-medium ${a.checked_in ? 'text-green-800 font-semibold' : 'text-slate-600'}`}>
                                  {nome}
                                  {a.status === 'late' && <span className="ml-1 text-xs text-amber-600">(in ritardo)</span>}
                                  {a.status === 'maybe' && <span className="ml-1 text-xs text-amber-600">(forse)</span>}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Paginazione */}
          {totalEvents > PAGE_SIZE && (
            <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow border text-sm">
              <button type="button" disabled={currentPage === 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl disabled:opacity-40 transition-colors">
                ← Prec.
              </button>
              <span className="text-slate-600 text-xs font-medium">
                {currentPage} / {totalPages} ({totalEvents} eventi)
              </span>
              <button type="button" disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl disabled:opacity-40 transition-colors">
                Succ. →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <RequireAuth>
      <CalendarPageContent />
    </RequireAuth>
  );
}
