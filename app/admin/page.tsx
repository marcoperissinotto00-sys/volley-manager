'use client';

import { useEffect, useMemo, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast-context';
import RequireAuth from '@/components/RequireAuth';

interface TeamRow {
  id: string;
  name: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  logo_url: string | null;
  regolamento_url: string | null;
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_role: 'admin' | 'coach' | 'player';
  is_active: boolean;
  team_id: string | null;
}

function genInviteCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

const ROLE_LABELS: Record<MemberRow['user_role'], string> = {
  admin: 'Admin',
  coach: 'Allenatore',
  player: 'Giocatore',
};

function AdminPageContent() {
  const { showError } = useToast();

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  const [busyTeamId, setBusyTeamId] = useState<string | null>(null);
  const [regoBusyTeamId, setRegoBusyTeamId] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: teamsData, error: teamsError }, { data: usersData, error: usersError }] = await Promise.all([
      supabase.from('teams').select('*').order('created_at', { ascending: true }),
      supabase.from('users').select('id, first_name, last_name, email, user_role, is_active, team_id').order('last_name'),
    ]);
    if (teamsError) showError(`Impossibile caricare le squadre: ${teamsError.message}`);
    if (usersError) showError(`Impossibile caricare gli utenti: ${usersError.message}`);
    setTeams((teamsData as TeamRow[]) || []);
    setMembers((usersData as MemberRow[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, []);

  const membersByTeam = useMemo(() => {
    const map: Record<string, MemberRow[]> = {};
    for (const m of members) {
      if (!m.team_id) continue;
      if (!map[m.team_id]) map[m.team_id] = [];
      map[m.team_id].push(m);
    }
    return map;
  }, [members]);

  async function handleCreateTeam(e: FormEvent) {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name) return;
    setCreating(true);
    const { error } = await supabase.from('teams').insert({ name });
    setCreating(false);
    if (error) { showError(`Impossibile creare la squadra: ${error.message}`); return; }
    setNewTeamName('');
    fetchAll();
  }

  async function toggleTeamActive(team: TeamRow) {
    setBusyTeamId(team.id);
    const { error } = await supabase.from('teams').update({ is_active: !team.is_active }).eq('id', team.id);
    setBusyTeamId(null);
    if (error) { showError(`Impossibile aggiornare la squadra: ${error.message}`); return; }
    fetchAll();
  }

  async function deleteTeam(team: TeamRow) {
    if (!confirm(
      `Eliminare DEFINITIVAMENTE la squadra "${team.name}"?\n\n` +
      `Vengono cancellati tutti i suoi eventi (allenamenti, partite, presenze, formazioni). ` +
      `I membri restano come utenti ma perdono l'associazione alla squadra.\n\n` +
      `Questa azione non si può annullare.`
    )) return;

    setBusyTeamId(team.id);

    const { data: teamEvents, error: eventsFetchError } = await supabase.from('events').select('id').eq('team_id', team.id);
    if (eventsFetchError) { setBusyTeamId(null); showError(`Impossibile eliminare: ${eventsFetchError.message}`); return; }
    const eventIds = (teamEvents || []).map((e) => e.id);

    if (eventIds.length > 0) {
      const { data: teamMatches, error: matchesFetchError } = await supabase.from('matches').select('id').in('event_id', eventIds);
      if (matchesFetchError) { setBusyTeamId(null); showError(`Impossibile eliminare: ${matchesFetchError.message}`); return; }
      const matchIds = (teamMatches || []).map((m) => m.id);

      if (matchIds.length > 0) {
        const { error } = await supabase.from('match_set_stats').delete().in('match_id', matchIds);
        if (error) { setBusyTeamId(null); showError(`Impossibile eliminare: ${error.message}`); return; }
      }

      const deletes = await Promise.all([
        supabase.from('matches').delete().in('event_id', eventIds),
        supabase.from('attendances').delete().in('event_id', eventIds),
      ]);
      const relatedError = deletes.find((d) => d.error)?.error;
      if (relatedError) { setBusyTeamId(null); showError(`Impossibile eliminare: ${relatedError.message}`); return; }

      const { error: eventsDeleteError } = await supabase.from('events').delete().eq('team_id', team.id);
      if (eventsDeleteError) { setBusyTeamId(null); showError(`Impossibile eliminare: ${eventsDeleteError.message}`); return; }
    }

    const { error: unassignError } = await supabase.from('users').update({ team_id: null }).eq('team_id', team.id);
    if (unassignError) { setBusyTeamId(null); showError(`Impossibile eliminare: ${unassignError.message}`); return; }

    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    setBusyTeamId(null);
    if (error) { showError(`Impossibile eliminare: ${error.message}`); return; }
    fetchAll();
  }

  async function regenerateInviteCode(team: TeamRow) {
    if (!confirm(`Rigenerare il link di invito di "${team.name}"? Il link attuale smetterà subito di funzionare.`)) return;
    setBusyTeamId(team.id);
    const { error } = await supabase.from('teams').update({ invite_code: genInviteCode() }).eq('id', team.id);
    setBusyTeamId(null);
    if (error) { showError(`Impossibile rigenerare il link: ${error.message}`); return; }
    fetchAll();
  }

  async function uploadRegolamento(team: TeamRow, file: File) {
    setRegoBusyTeamId(team.id);
    const ext = file.name.split('.').pop() || 'pdf';
    const path = `${team.id}/regolamento.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('team-documents')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setRegoBusyTeamId(null);
      showError(`Impossibile caricare il regolamento: ${uploadError.message}`);
      return;
    }
    const { data: publicUrlData } = supabase.storage.from('team-documents').getPublicUrl(path);
    const regolamento_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    const { error } = await supabase.from('teams').update({ regolamento_url }).eq('id', team.id);
    setRegoBusyTeamId(null);
    if (error) { showError(`Impossibile salvare il regolamento: ${error.message}`); return; }
    fetchAll();
  }

  async function removeRegolamento(team: TeamRow) {
    setRegoBusyTeamId(team.id);
    const { error } = await supabase.from('teams').update({ regolamento_url: null }).eq('id', team.id);
    setRegoBusyTeamId(null);
    if (error) { showError(`Impossibile rimuovere il regolamento: ${error.message}`); return; }
    fetchAll();
  }

  function inviteLink(team: TeamRow) {
    return `${origin}/register?team=${team.invite_code}`;
  }

  async function copyInviteLink(team: TeamRow) {
    try {
      await navigator.clipboard.writeText(inviteLink(team));
      setCopiedTeamId(team.id);
      setTimeout(() => setCopiedTeamId((id) => (id === team.id ? null : id)), 2000);
    } catch {
      showError('Impossibile copiare il link: selezionalo e copialo a mano.');
    }
  }

  function whatsappInviteUrl(team: TeamRow) {
    const text = `🏐 Iscriviti a "${team.name}": ${inviteLink(team)}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }

  async function promoteMember(member: MemberRow, role: 'coach' | 'player') {
    setBusyMemberId(member.id);
    const { error } = await supabase.from('users').update({ user_role: role, is_active: true }).eq('id', member.id);
    setBusyMemberId(null);
    if (error) { showError(`Impossibile attivare ${member.first_name}: ${error.message}`); return; }
    fetchAll();
  }

  async function deleteMember(member: MemberRow) {
    if (!confirm(
      `Eliminare definitivamente ${member.first_name} ${member.last_name}?\n\n` +
      `Vengono cancellati dati anagrafici, presenze e statistiche partite. ` +
      `L'account di accesso resta valido: se in futuro rientra, riapparirà come nuovo iscritto in attesa di approvazione.`
    )) return;

    setBusyMemberId(member.id);
    const deletes = await Promise.all([
      supabase.from('match_set_stats').delete().eq('user_id', member.id),
      supabase.from('attendances').delete().eq('user_id', member.id),
      supabase.from('athlete_details').delete().eq('user_id', member.id),
    ]);
    const relatedError = deletes.find((d) => d.error)?.error;
    if (relatedError) {
      setBusyMemberId(null);
      showError(`Impossibile eliminare: ${relatedError.message}`);
      return;
    }

    const { error } = await supabase.from('users').delete().eq('id', member.id);
    setBusyMemberId(null);
    if (error) { showError(`Impossibile eliminare: ${error.message}`); return; }
    fetchAll();
  }

  if (loading && teams.length === 0) return <div className="p-6 text-center text-slate-500">Caricamento…</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-xs text-slate-500 mt-0.5">Gestione squadre e inviti</p>
      </div>

      {/* Nuova squadra */}
      <form onSubmit={handleCreateTeam} className="bg-white p-4 rounded-xl shadow space-y-3">
        <h2 className="font-semibold text-slate-800">Nuova squadra</h2>
        <div className="flex gap-2">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nome squadra"
            className="flex-1 p-3 border rounded-xl text-slate-900 text-base"
          />
          <button type="submit" disabled={creating || !newTeamName.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-xl active:scale-95 disabled:opacity-50 transition-all">
            Crea
          </button>
        </div>
      </form>

      {/* Lista squadre */}
      <div className="space-y-3">
        {teams.map((team) => {
          const teamMembers = membersByTeam[team.id] || [];
          const pending = teamMembers.filter((m) => !m.is_active);
          const expanded = expandedTeamId === team.id;
          return (
            <div key={team.id} className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  {team.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border shrink-0" />
                  )}
                  <div>
                    <h3 className="font-bold text-slate-900">{team.name}</h3>
                    <span className={`text-xs font-semibold ${team.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                      {team.is_active ? '● Attiva' : '● Disattivata'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => toggleTeamActive(team)} disabled={busyTeamId === team.id}
                    className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                    {team.is_active ? 'Disattiva' : 'Attiva'}
                  </button>
                  <button onClick={() => deleteTeam(team)} disabled={busyTeamId === team.id}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                    Elimina
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="text-xs text-slate-500">Link di invito</div>
                <div className="text-xs font-mono text-slate-700 break-all">{inviteLink(team)}</div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => copyInviteLink(team)}
                    className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg active:scale-95 transition-all">
                    {copiedTeamId === team.id ? '✓ Copiato' : '📋 Copia link'}
                  </button>
                  <a href={whatsappInviteUrl(team)} target="_blank" rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-lg active:scale-95 transition-all">
                    📤 WhatsApp
                  </a>
                  <button onClick={() => regenerateInviteCode(team)} disabled={busyTeamId === team.id}
                    className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                    ↻ Rigenera
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="text-xs text-slate-500">Regolamento del campionato</div>
                {team.regolamento_url ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={team.regolamento_url} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg active:scale-95 transition-all">
                      📋 Apri regolamento
                    </a>
                    <button onClick={() => removeRegolamento(team)} disabled={regoBusyTeamId === team.id}
                      className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                      Rimuovi
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">Nessun regolamento caricato.</div>
                )}
                <label className="inline-block px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg active:scale-95 transition-all cursor-pointer">
                  {regoBusyTeamId === team.id ? 'Caricamento…' : '📄 Carica PDF'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={regoBusyTeamId === team.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) uploadRegolamento(team, file);
                    }}
                  />
                </label>
              </div>

              <button onClick={() => setExpandedTeamId(expanded ? null : team.id)}
                className="text-xs text-slate-500 font-semibold active:scale-95 transition-all">
                {expanded ? '▴ Nascondi membri' : `▾ ${teamMembers.length} membr${teamMembers.length === 1 ? 'o' : 'i'}${pending.length ? ` · ${pending.length} in attesa` : ''}`}
              </button>

              {expanded && (
                <div className="space-y-0.5 pt-1">
                  {teamMembers.length === 0 && (
                    <div className="text-xs text-slate-400 py-2">Nessun membro ancora — condividi il link di invito.</div>
                  )}
                  {teamMembers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-2 border-t flex-wrap">
                      <div className="min-w-0 flex items-center gap-2">
                        <div>
                          <div className="font-medium text-slate-900 truncate">{m.first_name} {m.last_name}</div>
                          <div className="text-xs text-slate-400 truncate">{m.email}</div>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${m.user_role === 'coach' ? 'bg-amber-100 text-amber-800' : m.user_role === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_LABELS[m.user_role]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!m.is_active ? (
                          <>
                            <button onClick={() => promoteMember(m, 'coach')} disabled={busyMemberId === m.id}
                              className="px-2 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                              Attiva coach
                            </button>
                            <button onClick={() => promoteMember(m, 'player')} disabled={busyMemberId === m.id}
                              className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                              Attiva
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-green-600 font-semibold">✓ Attivo</span>
                        )}
                        <button onClick={() => deleteMember(m)} disabled={busyMemberId === m.id}
                          className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg active:scale-95 transition-all disabled:opacity-50">
                          Elimina
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {teams.length === 0 && (
          <div className="p-10 text-center bg-white rounded-xl shadow text-slate-500 text-sm">
            Nessuna squadra ancora. Creane una sopra.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth superAdminOnly>
      <AdminPageContent />
    </RequireAuth>
  );
}
