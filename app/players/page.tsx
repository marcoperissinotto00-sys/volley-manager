'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface Atleta {
  id: number;
  first_name?: string;
  last_name?: string;
  jersey_number?: number | null;
  ruolo?: string | null;
  atleta_fb_team?: string | null;
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
  email?: string | null;
  scadenza_visita_medica?: string | null;
  addetto_dae?: boolean;
  scadenza_dae?: string | null;
  addetto_antincendio?: boolean;
  scadenza_antincendio?: string | null;
}

const ROLES = ['Palleggiatore', 'Schiacciatore', 'Centrale', 'Opposto', 'Libero'];

export default function PlayersPage() {
  const [atleti, setAtleti] = useState<Atleta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Stato campi form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [courtRole, setCourtRole] = useState('');
  const [atletaFbTeam, setAtletaFbTeam] = useState('');
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
  const [email, setEmail] = useState('');
  const [scadenzaVisitaMedica, setScadenzaVisitaMedica] = useState('');
  const [addettoDae, setAddettoDae] = useState(false);
  const [scadenzaDae, setScadenzaDae] = useState('');
  const [addettoAntincendio, setAddettoAntincendio] = useState(false);
  const [scadenzaAntincendio, setScadenzaAntincendio] = useState('');

  // Reset del form
  function resetForm() {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setJerseyNumber('');
    setCourtRole('');
    setAtletaFbTeam('');
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
    setEmail('');
    setScadenzaVisitaMedica('');
    setAddettoDae(false);
    setScadenzaDae('');
    setAddettoAntincendio(false);
    setScadenzaAntincendio('');
  }

  // Caricamento lista atleti
  async function fetchAtleti() {
    const { data, error } = await supabase
      .from('atleti')
      .select('*')
      .order('id', { ascending: false });

    if (!error && data) {
      setAtleti(data as Atleta[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAtleti();
  }, []);

  // Popola la form per la modifica
  function handleEdit(atleta: Atleta) {
    setEditingId(atleta.id);
    setFirstName(atleta.first_name || (atleta as any).nome || '');
    setLastName(atleta.last_name || (atleta as any).cognome || '');
    setJerseyNumber(atleta.jersey_number ? String(atleta.jersey_number) : '');
    setCourtRole(atleta.ruolo || (atleta as any).court_role || '');
    setAtletaFbTeam(atleta.atleta_fb_team || '');
    setCodiceFiscale(atleta.codice_fiscale || '');
    setSesso(atleta.sesso || 'M');
    setDataNascita(atleta.data_nascita || '');
    setLuogoNascita(atleta.luogo_nascita || '');
    setProvNascita(atleta.prov_nascita || '');
    setIndirizzoResidenza(atleta.indirizzo_residenza || '');
    setCap(atleta.cap || '');
    setCittaResidenza(atleta.citta_residenza || '');
    setProvResidenza(atleta.prov_residenza || '');
    setCellulare(atleta.cellulare || '');
    setEmail(atleta.email || '');
    setScadenzaVisitaMedica(atleta.scadenza_visita_medica || '');
    setAddettoDae(Boolean(atleta.addetto_dae));
    setScadenzaDae(atleta.scadenza_dae || '');
    setAddettoAntincendio(Boolean(atleta.addetto_antincendio));
    setScadenzaAntincendio(atleta.scadenza_antincendio || '');
    setShowForm(true);
  }

  // Eliminazione atleta
  async function handleDelete(id: number) {
    if (!confirm('Sei sicuro di voler eliminare questa scheda atleta?')) return;

    const { error } = await supabase.from('atleti').delete().eq('id', id);

    if (error) {
      alert(`Errore durante l'eliminazione: ${error.message}`);
    } else {
      fetchAtleti();
    }
  }

  // Salva (Insert o Update)
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return;

    setSubmitting(true);

    const atletaData = {
      first_name: firstName,
      last_name: lastName,
      jersey_number: jerseyNumber ? parseInt(jerseyNumber, 10) : null,
      ruolo: courtRole || null,
      atleta_fb_team: atletaFbTeam || null,
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
      email: email || null,
      scadenza_visita_medica: scadenzaVisitaMedica || null,
      addetto_dae: addettoDae,
      scadenza_dae: addettoDae && scadenzaDae ? scadenzaDae : null,
      addetto_antincendio: addettoAntincendio,
      scadenza_antincendio: addettoAntincendio && scadenzaAntincendio ? scadenzaAntincendio : null,
    };

    let error;

    if (editingId) {
      // Modifica atleta esistente
      const res = await supabase.from('atleti').update(atletaData).eq('id', editingId);
      error = res.error;
    } else {
      // Inserimento nuovo atleta
      const res = await supabase.from('atleti').insert([atletaData]);
      error = res.error;
    }

    setSubmitting(false);

    if (error) {
      alert(`Errore salvataggio: ${error.message}`);
    } else {
      resetForm();
      setShowForm(false);
      fetchAtleti();
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Caricamento rosa in corso...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Anagrafica Atleti</h1>
        <button
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Chiudi Form' : '+ Nuovo Atleta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-slate-50 rounded-xl shadow border space-y-6">
          <h2 className="text-xl font-semibold text-slate-800 border-b pb-2">
            {editingId ? 'Modifica Scheda Atleta' : 'Nuova Scheda Atleta'}
          </h2>

          {/* Dati di Gioco */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cognome *</label>
              <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">N. Maglia</label>
              <input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ruolo</label>
              <select value={courtRole} onChange={(e) => setCourtRole(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white">
                <option value="">Seleziona...</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Atleta FB / Team</label>
              <input type="text" value={atletaFbTeam} onChange={(e) => setAtletaFbTeam(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
          </div>

          {/* Dati Anagrafici */}
          <h3 className="text-md font-semibold text-slate-700 border-b pt-2 pb-1">Anagrafica & Contatti</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Codice Fiscale</label>
              <input type="text" maxLength={16} value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())} className="w-full p-2 border rounded text-slate-900 uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sesso</label>
              <select value={sesso} onChange={(e) => setSesso(e.target.value)} className="w-full p-2 border rounded text-slate-900 bg-white">
                <option value="M">Maschio (M)</option>
                <option value="F">Femmina (F)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data di Nascita</label>
              <input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Luogo di Nascita</label>
              <input type="text" value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prov. Nascita</label>
              <input type="text" maxLength={2} value={provNascita} onChange={(e) => setProvNascita(e.target.value.toUpperCase())} className="w-full p-2 border rounded text-slate-900 uppercase" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cellulare</label>
              <input type="tel" value={cellulare} onChange={(e) => setCellulare(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
          </div>

          {/* Residenza */}
          <h3 className="text-md font-semibold text-slate-700 border-b pt-2 pb-1">Residenza</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Indirizzo Residenza</label>
              <input type="text" value={indirizzoResidenza} onChange={(e) => setIndirizzoResidenza(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Città</label>
              <input type="text" value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CAP / Prov</label>
              <div className="flex gap-2">
                <input type="text" placeholder="CAP" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value)} className="w-2/3 p-2 border rounded text-slate-900" />
                <input type="text" placeholder="PR" maxLength={2} value={provResidenza} onChange={(e) => setProvResidenza(e.target.value.toUpperCase())} className="w-1/3 p-2 border rounded text-slate-900 uppercase" />
              </div>
            </div>
          </div>

          {/* Certificati e Qualifiche */}
          <h3 className="text-md font-semibold text-slate-700 border-b pt-2 pb-1">Certificati & Scadenze</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza Visita Medica</label>
              <input type="date" value={scadenzaVisitaMedica} onChange={(e) => setScadenzaVisitaMedica(e.target.value)} className="w-full p-2 border rounded text-slate-900" />
            </div>

            <div className="p-3 bg-white border rounded">
              <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-2">
                <input type="checkbox" checked={addettoDae} onChange={(e) => setAddettoDae(e.target.checked)} className="rounded text-blue-600" />
                <span>Addetto DAE</span>
              </label>
              {addettoDae && (
                <input type="date" value={scadenzaDae} onChange={(e) => setScadenzaDae(e.target.value)} className="w-full p-2 border rounded text-slate-900 text-sm" />
              )}
            </div>

            <div className="p-3 bg-white border rounded">
              <label className="flex items-center space-x-2 text-sm font-medium text-slate-700 mb-2">
                <input type="checkbox" checked={addettoAntincendio} onChange={(e) => setAddettoAntincendio(e.target.checked)} className="rounded text-blue-600" />
                <span>Addetto Antincendio</span>
              </label>
              {addettoAntincendio && (
                <input type="date" value={scadenzaAntincendio} onChange={(e) => setScadenzaAntincendio(e.target.value)} className="w-full p-2 border rounded text-slate-900 text-sm" />
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-300 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvataggio...' : editingId ? 'Aggiorna Atleta' : 'Salva Scheda Atleta'}
            </button>
          </div>
        </form>
      )}

      {/* Lista Atleti */}
      {atleti.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">
          Nessun atleta registrato.
        </div>
      ) : (
        <ul className="space-y-3">
          {atleti.map((atleta) => {
            const nome = atleta.first_name || (atleta as any).nome || '';
            const cognome = atleta.last_name || (atleta as any).cognome || '';
            const numero = atleta.jersey_number ? `#${atleta.jersey_number}` : '-';
            const ruolo = atleta.ruolo || (atleta as any).court_role || 'Non assegnato';

            return (
              <li key={atleta.id} className="p-4 bg-white shadow rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-slate-900 border">
                <div className="flex items-center space-x-4">
                  <span className="w-10 h-10 flex items-center justify-center bg-slate-100 font-bold text-lg text-slate-700 rounded-full shrink-0">
                    {numero}
                  </span>
                  <div>
                    <div className="font-semibold text-lg">
                      {nome} {cognome}
                    </div>
                    <div className="text-xs text-slate-500">
                      {atleta.codice_fiscale || ''} {atleta.email ? `• ${atleta.email}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    {ruolo}
                  </span>
                  <button
                    onClick={() => handleEdit(atleta)}
                    className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-sm font-medium rounded-md hover:bg-amber-100 transition-colors"
                  >
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(atleta.id)}
                    className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-md hover:bg-red-100 transition-colors"
                  >
                    Elimina
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}