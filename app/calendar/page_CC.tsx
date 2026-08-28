'use client';

import { useEffect, useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import RequireAuth from '@/components/RequireAuth';

type EventType = 'training' | 'match' | 'event';
type AttendanceStatus = 'present' | 'late' | 'maybe' | 'absent';

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

function isPast(iso: string) { return new Date(iso).getTime() < Date.now(); }
function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

// Geocodifica via Nominatim (OpenStreetMap) — gratuito, nessuna chiave
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [openWho, setOpenWho] = useState<Record<string, boolean>>({});
  const [openAppello, setOpenAppello] = useState<Record<string, boolean>>({});

  // campi form
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<EventType>('training');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [isHomeGame, setIsHomeGame] = useState(true);
  const [geoResult, setGeoResult] = useState<{ lat: number; lon: number; mapsUrl: string } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const geocodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchAll() {
    setLoading(true);
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .order('date_time', { ascending: true });

    if (!eventsError && eventsData) {
      setEvents(eventsData as EventRow[]);
      const ids = eventsData.map((e) => e.id);
      if (ids.length > 0) {
        const { data: attData } = await supabase
          .from('attendances')
          .select('*, users(first_name, last_name)')
          .in('event_id', ids);
        const grouped: Record<string, AttendanceRow[]> = {};
        (attData || []).forEach((a) => {
          if (!grouped[a.event_id]) grouped[a.event_id] = [];
          grouped[a.event_id].push(a as AttendanceRow);
        });
        setAttendances(grouped);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  // Geocodifica automatica con debounce 800ms dopo che l'utente smette di scrivere
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
    setTitle(''); setEventType('training'); setDateTime('');
    setLocation(''); setNotes(''); setOpponentName('');
    setIsHomeGame(true); setGeoResult(null); setGeoError(null);
    setShowForm(false);
  }

  async function handleCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!title || !dateTime) return;
    if (eventType === 'match' && !opponentName) {
      alert('Inserisci il nome dell\'avversario per le partite.');
      return;
    }
    setSubmitting(true);

    const payload = {
      title,
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
    fetchAll();
  }

  async function deleteEvent(id: string) {
    if (!confirm('Eliminare questo appuntamento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { alert(`Errore: ${error.message}`); return; }
    fetchAll();
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
    fetchAll();
  }

  async function toggleCheckin(attendance: AttendanceRow) {
    await supabase.from('attendances')
      .update({ checked_in: !attendance.checked_in })
      .eq('id', attendance.id);
    fetchAll();
  }

  if (loading) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Calendario</h1>
          <p className="text-sm text-slate-500 mt-1">Allenamenti, partite ed eventi della squadra.</p>
        </div>
        {isCoach && (
          <button onClick={() => setShowForm((v) => !v)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
            {showForm ? '✕ Chiudi' : '+ Nuovo'}
          </button>
        )}
      </div>

      {/* Form nuovo evento */}
      {showForm && isCoach && (
        <form onSubmit={handleCreateEvent} className="bg-white p-5 rounded-xl shadow space-y-4">
          <h2 className="font-semibold text-slate-800">Nuovo appuntamento</h2>

          {/* Tipo evento */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <div className="flex gap-2">
              {(['training', 'match', 'event'] as EventType[]).map((t) => (
                <button key={t} type="button" onClick={() => setEventType(t)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${eventType === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                  {EVENT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titolo</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={eventType === 'match' ? 'Es. Campionato — Girone A' : 'Es. Allenamento settimanale'}
                className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e ora</label>
              <input type="datetime-local" required value={dateTime} onChange={(e) => setDateTime(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
          </div>

          {/* Campi specifici per partita */}
          {eventType === 'match' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="md:col-span-2">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-700">Dettagli partita</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Avversario <span className="text-red-500">*</span></label>
                <input type="text" value={opponentName} onChange={(e) => setOpponentName(e.target.value)}
                  placeholder="Es. Pallavolo Rosso" className="w-full p-2 border rounded text-slate-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sede</label>
                <div className="flex gap-2">
                  {[{ label: '🏠 Casa', value: true }, { label: '✈️ Trasferta', value: false }].map((opt) => (
                    <button key={String(opt.value)} type="button" onClick={() => setIsHomeGame(opt.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${isHomeGame === opt.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Luogo con geocodifica */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Luogo
              {geocoding && <span className="ml-2 text-xs text-blue-500">🔍 Ricerca coordinate…</span>}
            </label>
            <input type="text" value={location} onChange={(e) => handleLocationChange(e.target.value)}
              placeholder="Es. Via Roma 1, Milano" className="w-full p-2 border rounded text-slate-900" />

            {geoResult && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span>📍 Posizione trovata</span>
                <span className="text-slate-400 text-xs">({geoResult.lat.toFixed(5)}, {geoResult.lon.toFixed(5)})</span>
                <a href={geoResult.mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto text-blue-600 hover:underline text-xs font-medium">Verifica su Maps →</a>
              </div>
            )}
            {geoError && (
              <div className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠️ {geoError}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (facoltativo)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg">Annulla</button>
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg disabled:opacity-50">
              {submitting ? 'Salvataggio…' : 'Salva appuntamento'}
            </button>
          </div>
        </form>
      )}

      {/* Lista eventi */}
      {events.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">Nessun appuntamento in calendario.</div>
      ) : (
        <ul className="space-y-4">
          {events.map((ev) => {
            const { dateStr, timeStr } = formatDateTime(ev.date_time);
            const list = attendances[ev.id] || [];
            const mine = user ? list.find((a) => a.user_id === user.id) : undefined;
            const confirmedList = list.filter((a) => ['present', 'late'].includes(a.status));
            const checkedInCount = list.filter((a) => a.checked_in).length;
            const open = !!openWho[ev.id];
            const appelloOpen = !!openAppello[ev.id];
            const past = isPast(ev.date_time);
            const today = isToday(ev.date_time);

            return (
              <li key={ev.id} className={`bg-white shadow rounded-xl border overflow-hidden ${past && !today ? 'opacity-60' : ''} ${today ? 'ring-2 ring-blue-500' : ''}`}>
                {today && (
                  <div className="bg-blue-600 text-white text-xs font-bold text-center py-1 tracking-wide uppercase">Oggi</div>
                )}

                <div className="p-4 flex justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-full">
                        {EVENT_TYPE_LABELS[ev.event_type]}
                      </span>
                      {ev.event_type === 'match' && ev.is_home_game != null && (
                        <span className="text-xs text-slate-500">{ev.is_home_game ? '🏠 Casa' : '✈️ Trasferta'}</span>
                      )}
                    </div>

                    <div className="text-lg font-bold text-slate-900">{ev.title}</div>
                    {ev.opponent_name && (
                      <div className="text-sm font-semibold text-amber-700 mt-0.5">vs {ev.opponent_name}</div>
                    )}
                    <div className="text-sm text-slate-600 mt-0.5">{dateStr} · {timeStr}</div>

                    {ev.location && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-slate-500">📍 {ev.location}</span>
                        {ev.maps_url && (
                          <a href={ev.maps_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline font-medium">
                            Apri Maps →
                          </a>
                        )}
                      </div>
                    )}

                    {ev.notes && <div className="text-sm text-slate-500 italic mt-1">{ev.notes}</div>}

                    {ev.event_type === 'match' && isCoach && (
                      <Link href={`/match/${ev.id}`} className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold rounded-lg hover:bg-amber-100">
                        🏐 Gestisci partita →
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="bg-slate-900 rounded-lg px-3 py-1.5 text-center min-w-[64px]">
                      <div className="text-amber-400 font-bold text-xl leading-none">{String(confirmedList.length).padStart(2, '0')}</div>
                      <div className="text-[9px] text-slate-300 uppercase tracking-wide mt-0.5">RSVP</div>
                    </div>
                    {checkedInCount > 0 && (
                      <div className="bg-green-700 rounded-lg px-3 py-1.5 text-center min-w-[64px]">
                        <div className="text-white font-bold text-xl leading-none">{String(checkedInCount).padStart(2, '0')}</div>
                        <div className="text-[9px] text-green-200 uppercase tracking-wide mt-0.5">presenti</div>
                      </div>
                    )}
                    {isCoach && (
                      <button onClick={() => deleteEvent(ev.id)} className="text-xs text-slate-400 hover:text-red-600">Elimina</button>
                    )}
                  </div>
                </div>

                {/* RSVP */}
                <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATUS_CONFIG.map((s) => (
                    <button key={s.value} onClick={() => setRsvp(ev.id, s.value)}
                      className={`px-2 py-2 rounded-lg border text-xs font-semibold transition-colors ${mine?.status === s.value ? s.activeClass : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Chi ha risposto */}
                <button onClick={() => setOpenWho((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                  className="w-full text-left px-4 pb-2 text-xs text-slate-500 hover:text-slate-700 border-t pt-2">
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

                {/* Appello presenze — solo coach */}
                {isCoach && confirmedList.length > 0 && (
                  <>
                    <button onClick={() => setOpenAppello((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                      className="w-full text-left px-4 pb-3 text-xs font-semibold text-green-700 hover:text-green-900 border-t pt-2">
                      {appelloOpen ? '▾' : '▸'} 📋 Appello presenze ({checkedInCount}/{confirmedList.length})
                    </button>
                    {appelloOpen && (
                      <div className="px-4 pb-4 bg-green-50 pt-3 space-y-2">
                        <p className="text-xs text-slate-500 mb-3">Spunta chi è fisicamente presente.</p>
                        {confirmedList.map((a) => {
                          const nome = a.users ? `${a.users.first_name} ${a.users.last_name}` : '—';
                          return (
                            <label key={a.id} className="flex items-center gap-3 cursor-pointer select-none">
                              <input type="checkbox" checked={a.checked_in} onChange={() => toggleCheckin(a)} className="w-5 h-5 accent-green-600" />
                              <span className={`text-sm font-medium ${a.checked_in ? 'text-green-800 font-semibold' : 'text-slate-600'}`}>
                                {nome}
                                {a.status === 'late' && <span className="ml-1 text-xs text-amber-600">(in ritardo)</span>}
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
