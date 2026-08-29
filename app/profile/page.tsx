'use client';

import { useEffect, useRef, useState, FormEvent, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import RequireAuth from '@/components/RequireAuth';

const COURT_ROLE_LABELS: Record<string, string> = {
  palleggiatore: 'Palleggiatore',
  schiacciatore: 'Schiacciatore',
  opposto: 'Opposto',
  centrale: 'Centrale',
  libero: 'Libero',
};

// Giorni mancanti alla scadenza (negativo se già scaduta)
function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDateIt(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function ProfileContent() {
  const { user, profile, refreshProfile } = useAuth();
  const { showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [anagraficaOpen, setAnagraficaOpen] = useState(false);
  const [residenzaOpen, setResidenzaOpen] = useState(false);
  const [certificatiOpen, setCertificatiOpen] = useState(false);

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

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
  }, [profile]);

  useEffect(() => {
    async function fetchDetails() {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('athlete_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        showError(`Impossibile caricare i tuoi dati: ${error.message}`);
      } else if (data) {
        setCodiceFiscale(data.codice_fiscale || '');
        setSesso(data.sesso || 'M');
        setDataNascita(data.data_nascita || '');
        setLuogoNascita(data.luogo_nascita || '');
        setProvNascita(data.prov_nascita || '');
        setIndirizzoResidenza(data.indirizzo_residenza || '');
        setCap(data.cap || '');
        setCittaResidenza(data.citta_residenza || '');
        setProvResidenza(data.prov_residenza || '');
        setCellulare(data.cellulare || '');
        setScadenzaVisitaMedica(data.scadenza_visita_medica || '');
        setAddettoDae(Boolean(data.addetto_dae));
        setScadenzaDae(data.scadenza_dae || '');
        setAddettoAntincendio(Boolean(data.addetto_antincendio));
        setScadenzaAntincendio(data.scadenza_antincendio || '');
        // Apri di default solo le sezioni che contengono già dei dati
        setAnagraficaOpen(Boolean(data.codice_fiscale || data.data_nascita || data.luogo_nascita || data.prov_nascita || data.cellulare));
        setResidenzaOpen(Boolean(data.indirizzo_residenza || data.cap || data.citta_residenza || data.prov_residenza));
        setCertificatiOpen(Boolean(data.scadenza_visita_medica || data.addetto_dae || data.addetto_antincendio));
      }
      setLoading(false);
    }
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      showError('Seleziona un file immagine.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      showError('La foto non può superare i 5 MB.');
      return;
    }

    setUploadingPhoto(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadErr) {
      showError(`Impossibile caricare la foto: ${uploadErr.message}`);
      setUploadingPhoto(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    const { error: updateErr } = await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id);
    setUploadingPhoto(false);
    if (updateErr) {
      showError(`Impossibile salvare la foto: ${updateErr.message}`);
      return;
    }
    await refreshProfile();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { error: userErr } = await supabase
      .from('users')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', user.id);

    const { error: detailsErr } = await supabase.from('athlete_details').upsert(
      {
        user_id: user.id,
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
      showError(`Errore durante il salvataggio: ${userErr?.message || detailsErr?.message}`);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await refreshProfile();
  }

  if (loading) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Il mio profilo</h1>
        <p className="text-sm text-slate-500 mt-1">I tuoi dati personali. Ruolo, maglia e stato sono gestiti dall&apos;allenatore.</p>
      </div>

      {scadenzaVisitaMedica && daysUntil(scadenzaVisitaMedica) <= 15 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          ⚠️ La tua visita medica{' '}
          {daysUntil(scadenzaVisitaMedica) < 0
            ? `è scaduta il ${formatDateIt(scadenzaVisitaMedica)}.`
            : daysUntil(scadenzaVisitaMedica) === 0
              ? 'scade oggi.'
              : `scade tra ${daysUntil(scadenzaVisitaMedica)} giorn${daysUntil(scadenzaVisitaMedica) === 1 ? 'o' : 'i'} (${formatDateIt(scadenzaVisitaMedica)}).`}
          {' '}Ricordati di rinnovarla.
        </div>
      )}

      {/* Foto profilo */}
      <div className="bg-white p-5 rounded-xl shadow flex items-center gap-4">
        <div className="relative shrink-0 w-20 h-20">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover border" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-500 border">
              {profile ? `${profile.first_name[0] || ''}${profile.last_name[0] || ''}` : ''}
            </div>
          )}
          {uploadingPhoto && (
            <div className="absolute inset-0 bg-white/70 rounded-full flex items-center justify-center text-xs text-slate-500">…</div>
          )}
        </div>
        <div>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPhoto}
            className="px-4 py-2.5 bg-blue-50 text-blue-700 text-sm font-semibold rounded-xl active:scale-95 transition-all disabled:opacity-50">
            📷 {profile?.avatar_url ? 'Cambia foto' : 'Aggiungi foto'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
      </div>

      {/* Dati gestiti dal coach — sola lettura */}
      <div className="bg-white p-4 rounded-xl shadow flex items-center gap-2 flex-wrap text-sm">
        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold">
          {profile?.jersey_number ? `#${profile.jersey_number}` : 'Nessuna maglia'}
        </span>
        {profile?.court_role && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
            {COURT_ROLE_LABELS[profile.court_role] || profile.court_role}
          </span>
        )}
        <span className="text-xs text-slate-400 ml-auto">Gestiti dall&apos;allenatore</span>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl shadow space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cognome</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setAnagraficaOpen((v) => !v)}
            className="w-full text-left px-3 py-2.5 bg-slate-50 text-sm font-semibold text-slate-700 active:bg-slate-100">
            {anagraficaOpen ? '▾' : '▸'} Anagrafica & contatti
          </button>
          {anagraficaOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codice fiscale</label>
                <input type="text" maxLength={16} value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value.toUpperCase())}
                  className="w-full p-2.5 border rounded-lg text-slate-900 uppercase text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sesso</label>
                <select value={sesso} onChange={(e) => setSesso(e.target.value)} className="w-full p-2.5 border rounded-lg text-slate-900 bg-white text-base">
                  <option value="M">Maschio (M)</option>
                  <option value="F">Femmina (F)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data di nascita</label>
                <input type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Luogo di nascita</label>
                <input type="text" value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prov. nascita</label>
                <input type="text" maxLength={2} value={provNascita} onChange={(e) => setProvNascita(e.target.value.toUpperCase())}
                  className="w-full p-2.5 border rounded-lg text-slate-900 uppercase text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cellulare</label>
                <input type="tel" value={cellulare} onChange={(e) => setCellulare(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setResidenzaOpen((v) => !v)}
            className="w-full text-left px-3 py-2.5 bg-slate-50 text-sm font-semibold text-slate-700 active:bg-slate-100">
            {residenzaOpen ? '▾' : '▸'} Residenza
          </button>
          {residenzaOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Indirizzo</label>
                <input type="text" value={indirizzoResidenza} onChange={(e) => setIndirizzoResidenza(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Città</label>
                <input type="text" value={cittaResidenza} onChange={(e) => setCittaResidenza(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CAP / Prov</label>
                <div className="flex gap-2">
                  <input type="text" placeholder="CAP" maxLength={5} value={cap} onChange={(e) => setCap(e.target.value)}
                    className="w-2/3 p-2.5 border rounded-lg text-slate-900 text-base" />
                  <input type="text" placeholder="PR" maxLength={2} value={provResidenza} onChange={(e) => setProvResidenza(e.target.value.toUpperCase())}
                    className="w-1/3 p-2.5 border rounded-lg text-slate-900 uppercase text-base" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <button type="button" onClick={() => setCertificatiOpen((v) => !v)}
            className="w-full text-left px-3 py-2.5 bg-slate-50 text-sm font-semibold text-slate-700 active:bg-slate-100">
            {certificatiOpen ? '▾' : '▸'} Certificati & scadenze
          </button>
          {certificatiOpen && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza visita medica</label>
                <input type="date" value={scadenzaVisitaMedica} onChange={(e) => setScadenzaVisitaMedica(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg">
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 mb-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={addettoDae} onChange={(e) => setAddettoDae(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                  <span>Addetto DAE</span>
                </label>
                {addettoDae && (
                  <input type="date" value={scadenzaDae} onChange={(e) => setScadenzaDae(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
                )}
              </div>
              <div className="p-3 bg-slate-50 border rounded-lg">
                <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 mb-2 py-1 cursor-pointer">
                  <input type="checkbox" checked={addettoAntincendio} onChange={(e) => setAddettoAntincendio(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                  <span>Addetto antincendio</span>
                </label>
                {addettoAntincendio && (
                  <input type="date" value={scadenzaAntincendio} onChange={(e) => setScadenzaAntincendio(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-slate-900 text-base" />
                )}
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={submitting}
          className={`w-full py-2.5 rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-50 ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}`}>
          {submitting ? 'Salvataggio…' : saved ? '✓ Salvato' : 'Salva modifiche'}
        </button>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
