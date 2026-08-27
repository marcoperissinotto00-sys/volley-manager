'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';

interface Atleta {
  id: number;
  first_name?: string;
  last_name?: string;
  nome?: string;
  cognome?: string;
  jersey_number?: number | null;
  ruolo?: string | null;
  court_role?: string | null;
  codice_fiscale?: string | null;
  email?: string | null;
  cellulare?: string | null;
}

const ROLES = [
  'Palleggiatore',
  'Schiacciatore',
  'Centrale',
  'Opposto',
  'Libero',
];

export default function PlayersPage() {
  const [atleti, setAtleti] = useState<Atleta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);

  // Stato per tutti i campi del form
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

  // Recupera gli atleti dalla tabella 'atleti'
  async function fetchAtleti() {
    const { data, error } = await supabase
      .from('atleti') // <-- Usa correttamente la tabella ATLETI
      .select('*');

    if (!error && data) {
      setAtleti(data as Atleta[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAtleti();
  }, []);

  // Gestione dell'invio del form
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return;

    setSubmitting(true);

    const newAtletaData = {
      // Inseriamo sia first_name/last_name sia nome/cognome in base a come hai nominato i campi
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

    // Salvataggio sulla tabella ATLETI
    const { error } = await supabase
      .from('atleti')
      .insert([newAtletaData]);

    setSubmitting(false);

    if (error) {
      alert(`Errore salvataggio: ${error.message}`);
    } else {
      // Reset campi
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
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg shadow hover:bg-blue-700 transition-colors"
        >
          {showForm ? 'Chiudi Form' : '+ Nuovo Atleta'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 p-6 bg-slate-50 rounded-xl shadow border space-y-6">
          <h2 className="text-xl font-semibold text-slate-800 border-b pb-2">Nuova Scheda Atleta</h2>

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

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Salvataggio...' : 'Salva Scheda Atleta'}
            </button>
          </div>
        </form>
      )}

      {/* LISTA GIOCATORI */}
      {atleti.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">
          Nessun atleta presente nella tabella 'atleti'.
        </div>
      ) : (
        <ul className="space-y-3">
          {atleti.map((atleta) => (
            <li key={atleta.id} className="p-4 bg-white shadow rounded-lg flex justify-between items-center text-slate-900 border">
              <div className="flex items-center space-x-4">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 font-bold text-lg text-slate-700 rounded-full">
                  {atleta.jersey_number ? `#${atleta.jersey_number}` : '-'}
                </span>
                <div>
                  <div className="font-semibold text-lg">
                    {atleta.first_name || atleta.nome} {atleta.last_name || atleta.cognome}
                  </div>
                  <div className="text-xs text-slate-500">
                    {atleta.codice_fiscale || ''} {atleta.email ? `• ${atleta.email}` : ''}
                  </div>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                {atleta.ruolo || atleta.court_role || 'Non assegnato'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}