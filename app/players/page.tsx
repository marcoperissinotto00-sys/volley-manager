'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth, UserRole } from '@/lib/auth-context';
import RequireAuth from '@/components/RequireAuth';

const COURT_ROLES = ['palleggiatore', 'schiacciatore', 'opposto', 'centrale', 'libero'];
const COURT_ROLE_LABELS: Record<string, string> = {
  palleggiatore: 'Palleggiatore',
  schiacciatore: 'Schiacciatore',
  opposto: 'Opposto',
  centrale: 'Centrale',
  libero: 'Libero',
};

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_role: UserRole;
  court_role: string | null;
  jersey_number: number | null;
  is_active: boolean;
  codice_fiscale?: string | null;
  sesso?: string | null;
  data_nascita?: string | null;
  luogo_nascita?: string | null;
  prov_nascita?: string | null;
  indirizzo_residenza?: string | null;
  cap?: string | null;
  citta_residenza?: string | null;
  prov_residenza?: string | null;
  cellulare?: string | null;
  scadenza_visita_medica?: string | null;
  addetto_dae?: boolean;
  scadenza_dae?: string | null;
  addetto_antincendio?: boolean;
  scadenza_antincendio?: string | null;
}

function PlayersPageContent() {
  const { isCoach } = useAuth();

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [jerseyNumber, setJerseyNumber] = useState('');
  const [courtRole, setCourtRole] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('player');
  const [codiceFiscale, setCodiceFiscale] = useState('');
  const [sesso, setSesso] = useState('M');
  const [dataNascita, setDataNascita] = useState('');
  const [luogoNascita, setLuogoNascita] = useState('');
  const [provNascita, setProvNascita] = useState('');
  const [indirizzoResidenza, setIndirizzoResidenza] = useState('');
  const [cap, setCap] = useState('');
  const [cittaResidenza, setCittaResidenza] = useState('');
  const [provResidenza, setProvResidenza] = useState('');
  const [cellulare, setCellulare] = useState('');
  const [scadenzaVisitaMedica, setScadenzaVisitaMedica] = useState('');
  const [addettoDae, setAddettoDae] = useState(false);
  const [scadenzaDae, setScadenzaDae] = useState('');
  const [addettoAntincendio, setAddettoAntincendio] = useState(false);
  const [scadenzaAntincendio, setScadenzaAntincendio] = useState('');

  async function fetchPlayers() {
    setLoading(true);
    const [{ data: usersData, error: usersError }, { data: detailsData }] = await Promise.all([
      supabase.from('users').select('*').order('jersey_number', { ascending: true, nullsFirst: false }),
      supabase.from('athlete_details').select('*'),
    ]);

    if (!usersError && usersData) {
      const detailsMap = new Map((detailsData || []).map((d) => [d.user_id, d]));
      const merged = usersData.map((u) => ({ ...u, ...(detailsMap.get(u.id) || {}) }));
      setPlayers(merged as PlayerRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dei dati all'avvio della pagina
    fetchPlayers();
  }, []);

  function resetForm() {
    setEditingId(null);
    setJerseyNumber('');
    setCourtRole('');
    setUserRole('player');
    setCodiceFiscale('');
    setSesso('M');
    setDataNascita('');
    setLuogoNascita('');
    setProvNascita('');
    setIndirizzoResidenza('');
    setCap('');
    setCittaResidenza('');
    setProvResidenza('');
    setCellulare('');
    setScadenzaVisitaMedica('');
    setAddettoDae(false);
    setScadenzaDae('');
    setAddettoAntincendio(false);
    setScadenzaAntincendio('');
  }

  function handleEdit(p: PlayerRow) {
    setEditingId(p.id);
    setJerseyNumber(p.jersey_number ? String(p.jersey_number) : '');
    setCourtRole(p.court_role || '');
    setUserRole(p.user_role);
    setCodiceFiscale(p.codice_fiscale || '');
    setSesso(p.sesso || 'M');
    setDataNascita(p.data_nascita || '');
    setLuogoNascita(p.luogo_nascita || '');
    setProvNascita(p.prov_nascita || '');
    setIndirizzoResidenza(p.indirizzo_residenza || '');
    setCap(p.cap || '');
    setCittaResidenza(p.citta_residenza || '');
    setProvResidenza(p.prov_residenza || '');
    setCellulare(p.cellulare || '');
    setScadenzaVisitaMedica(p.scadenza_visita_medica || '');
    setAddettoDae(Boolean(p.addetto_dae));
    setScadenzaDae(p.scadenza_dae || '');
    setAddettoAntincendio(Boolean(p.addetto_antincendio));
    setScadenzaAntincendio(p.scadenza_antincendio || '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);

    const { error: userErr } = await supabase
      .from('users')
      .update({
        jersey_number: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
        court_role: courtRole || null,
        user_role: userRole,
      })
      .eq('id', editingId);

    const { error: detailsErr } = await supabase.from('athlete_details').upsert(
      {
        user_id: editingId,
        codice_fiscale: codiceFiscale.toUpperCase() || null,
        sesso,
        data_nascita: dataNascita || null,
        luogo_nascita: luogoNascita || null,
        prov_nascita: provNascita.toUpperCase() || null,
        indirizzo_residenza: indirizzoResidenza || null,
        cap: cap || null,
        citta_residenza: cittaResidenza || null,
        prov_residenza: provResidenza.toUpperCase() || null,
        cellulare: cellulare || null,
        scadenza_visita_medica: scadenzaVisitaMedica || null,
        addetto_dae: addettoDae,
        scadenza_dae: addettoDae && scadenzaDae ? scadenzaDae : null,
        addetto_antincendio: addettoAntincendio,
        scadenza_antincendio: addettoAntincendio && scadenzaAntincendio ? scadenzaAntincendio : null,
      },
      { onConflict: 'user_id' }
    );

    setSubmitting(false);

    if (userErr || detailsErr) {
      alert(`Errore durante il salvataggio: ${userErr?.message || detailsErr?.message}`);
      return;
    }

    resetForm();
    fetchPlayers();
  }

  async function toggleActive(p: PlayerRow) {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) {
      alert(`Errore: ${error.message}`);
      return;
    }
    fetchPlayers();
  }

  if (loading) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rosa squadra</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isCoach
            ? 'Ogni giocatore compare qui dopo essersi registrato. Modifica ruolo, maglia e dati anagrafici da qui.'
            : 'Elenco dei membri della squadra.'}
        </p>
      </div>

      {editingId && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow space-y-4">
          <h2 className="font-semibold text-slate-800">Modifica scheda giocatore</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Numero maglia</label>
              <input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ruolo in campo</label>
              <select value={courtRole} onChange={(e) => setCourtRole(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900 bg-white">
                <option value="">Seleziona...</option>
                {COURT_ROLES.map((r) => (
                  <option key={r} value={r}>{COURT_ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ruolo squadra</label>
              <select value={userRole} onChange={(e) => setUserRole(e.target.value as UserRole)} className="w-full p-2.5 border rounded-lg text-slate-900 bg-white">
                <option value="player">Giocatore</option>
                <option value="coach">Allenatore</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 border-b pt-2 pb-1">Anagrafica & contatti</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Codice fiscale</label>
              <input type="text" maxLength={16} value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} className="w-full p-2.5 border rounded-lg text-slate-900 uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sesso</label>
              <select value={sesso} onChange={(e) => setSesso(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900 bg-white">
                <option value="M">Maschio (M)</option>
                <option value="F">Femmina (F)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data di nascita</label>
              <input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Luogo di nascita</label>
              <input type="text" value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prov. nascita</label>
              <input type="text" maxLength={2} value={provNascita} onChange={(e) => setProvNascita(e.target.value.toUpperCase())} className="w-full p-2.5 border rounded-lg text-slate-900 uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cellulare</label>
              <input type="tel" value={cellulare} onChange={(e) => setCellulare(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 border-b pt-2 pb-1">Residenza</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Indirizzo</label>
              <input type="text" value={indirizzoResidenza} onChange={(e) => setIndirizzoResidenza(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Città</label>
              <input type="text" value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CAP / Prov</label>
              <div className="flex gap-2">
                <input type="text" placeholder="CAP" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value)} className="w-2/3 p-2.5 border rounded-lg text-slate-900" />
                <input type="text" placeholder="PR" maxLength={2} value={provResidenza} onChange={(e) => setProvResidenza(e.target.value.toUpperCase())} className="w-1/3 p-2.5 border rounded-lg text-slate-900 uppercase" />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 border-b pt-2 pb-1">Certificati & scadenze</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza visita medica</label>
              <input type="date" value={scadenzaVisitaMedica} onChange={(e) => setScadenzaVisitaMedica(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900" />
            </div>
            <div className="p-3 bg-slate-50 border rounded-lg">
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 mb-2 py-1 cursor-pointer">
                <input type="checkbox" checked={addettoDae} onChange={(e) => setAddettoDae(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                <span>Addetto DAE</span>
              </label>
              {addettoDae && (
                <input type="date" value={scadenzaDae} onChange={(e) => setScadenzaDae(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              )}
            </div>
            <div className="p-3 bg-slate-50 border rounded-lg">
              <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 mb-2 py-1 cursor-pointer">
                <input type="checkbox" checked={addettoAntincendio} onChange={(e) => setAddettoAntincendio(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                <span>Addetto antincendio</span>
              </label>
              {addettoAntincendio && (
                <input type="date" value={scadenzaAntincendio} onChange={(e) => setScadenzaAntincendio(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-slate-200 text-slate-700 font-medium rounded-lg active:scale-95 transition-all">
              Annulla
            </button>
            <button type="submit" disabled={submitting} className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50">
              {submitting ? 'Salvataggio…' : 'Salva modifiche'}
            </button>
          </div>
        </form>
      )}

      {players.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">Nessun membro registrato ancora.</div>
      ) : (
        <ul className="space-y-3">
          {players.map((p) => (
            <li key={p.id} className={`p-4 bg-white shadow rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border ${!p.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-center space-x-4">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 font-bold text-lg text-slate-700 rounded-full shrink-0">
                  {p.jersey_number ? `#${p.jersey_number}` : '-'}
                </span>
                <div>
                  <div className="font-semibold text-lg text-slate-900">
                    {p.first_name} {p.last_name}
                    {p.user_role !== 'player' && (
                      <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold align-middle">
                        {p.user_role === 'coach' ? 'Allenatore' : 'Admin'}
                      </span>
                    )}
                    {!p.is_active && (
                      <span className="ml-2 px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-xs font-bold align-middle">Inattivo</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">{p.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-end">
                {p.court_role && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    {COURT_ROLE_LABELS[p.court_role] || p.court_role}
                  </span>
                )}
                {isCoach && (
                  <>
                    <button onClick={() => handleEdit(p)} className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium rounded-lg active:scale-95 transition-all">
                      Modifica
                    </button>
                    <button onClick={() => toggleActive(p)} className="px-3 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-sm font-medium rounded-lg active:scale-95 transition-all">
                      {p.is_active ? 'Disattiva' : 'Riattiva'}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PlayersPage() {
  return (
    <RequireAuth>
      <PlayersPageContent />
    </RequireAuth>
  );
}
