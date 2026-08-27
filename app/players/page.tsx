'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function PlayersPage() {
  const [atleti, setAtleti] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    codice_fiscale: '',
    email: '',
    telefono: '',
    jersey_number: '',
    ruolo: '',
  });

  // Carica atleti
  const fetchAtleti = async () => {
    setLoading(true);
    setFetchError(null);
    
    const { data, error } = await supabase
      .from('atleti')
      .select('*');

    if (error) {
      console.error('Errore recupero atleti:', error);
      setFetchError(error.message);
    } else {
      console.log('Dati ricevuti da Supabase:', data);
      setAtleti(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAtleti();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('atleti').insert([formData]);

    if (error) {
      alert('Errore salvataggio: ' + error.message);
    } else {
      alert('Atleta salvato con successo!');
      setFormData({
        first_name: '',
        last_name: '',
        codice_fiscale: '',
        email: '',
        telefono: '',
        jersey_number: '',
        ruolo: '',
      });
      fetchAtleti();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Gestione Atleti</h1>

      {/* FORM REGISTRAZIONE */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow mb-8 space-y-4 border">
        <h2 className="text-lg font-semibold text-slate-700">Nuovo Atleta</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Cognome</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Codice Fiscale</label>
            <input
              type="text"
              name="codice_fiscale"
              value={formData.codice_fiscale}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Numero Maglia</label>
            <input
              type="number"
              name="jersey_number"
              value={formData.jersey_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Ruolo</label>
            <input
              type="text"
              name="ruolo"
              value={formData.ruolo}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 p-2 text-slate-900"
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
        >
          Salva Atleta
        </button>
      </form>

      {/* MESSAGGIO DI ERRORE */}
      {fetchError && (
        <div className="p-4 mb-4 bg-red-100 text-red-800 rounded-lg">
          <strong>Errore Supabase:</strong> {fetchError}
        </div>
      )}

      {/* LISTA ATLETI */}
      <h2 className="text-xl font-bold mb-4 text-slate-800">Elenco Atleti ({atleti.length})</h2>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Caricamento in corso...</div>
      ) : atleti.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-lg shadow text-slate-500">
          Nessun atleta registrato.
        </div>
      ) : (
        <ul className="space-y-3">
          {atleti.map((atleta) => {
            const nome = atleta.first_name || atleta.nome || 'Senza Nome';
            const cognome = atleta.last_name || atleta.cognome || '';
            const numero = atleta.jersey_number || atleta.numero_maglia || '-';
            const ruolo = atleta.ruolo || atleta.court_role || 'Non specificato';

            return (
              <li key={atleta.id} className="p-4 bg-white shadow rounded-lg flex justify-between items-center text-slate-900 border">
                <div className="flex items-center space-x-4">
                  <span className="w-10 h-10 flex items-center justify-center bg-slate-100 font-bold text-lg text-slate-700 rounded-full">
                    #{numero}
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
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  {ruolo}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}