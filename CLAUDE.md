@AGENTS.md
# Volleyball Manager — Contesto per Claude Code

## Stack tecnico
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Backend/DB**: Supabase (Auth + PostgreSQL + RLS)
- **Deploy**: Vercel, deploy automatico ad ogni push su `main`

## Struttura cartelle rilevante
```
app/
  layout.tsx          — Root layout con AuthProvider, ToastProvider e NavBar
  manifest.ts          — Manifest PWA (installabile su home screen)
  icon.png / apple-icon.png — Icone app: mascotte "Dindiats Volley" (tacchino con pallone), ritagliata da un'immagine fornita dall'utente
  page.tsx            — Redirect a /calendar
  login/page.tsx      — Login via Supabase Auth (email/password + Google)
  register/page.tsx   — Registrazione (ruolo default: player), anche via Google
  forgot-password/page.tsx — Richiesta link di recupero password
  reset-password/page.tsx  — Imposta nuova password (dopo il link ricevuto via email)
  calendar/page.tsx   — Calendario eventi con RSVP, appello, navigazione per mese, crea/modifica/elimina evento
  players/page.tsx    — Rosa squadra (users + athlete_details) + statistiche partite
  match/[id]/page.tsx — Gestione partita: formazioni per set (titolare/cambio/libero) + risultato
  profile/page.tsx    — "Il mio profilo": ogni utente modifica i propri dati anagrafici e la foto (ruolo/maglia restano gestiti dal coach)
  admin/page.tsx      — Console super-admin (solo user_role='admin'): crea squadre, genera/rigenera link di invito, attiva il primo coach di una nuova squadra
components/
  NavBar.tsx          — Header con identità/logout (link a /profile) + bottom tab bar (Calendario/Rosa)
  RequireAuth.tsx     — Protezione pagine (coachOnly per /match)
lib/
  supabase.ts         — Client Supabase (chiavi da .env.local)
  auth-context.tsx    — Context React: user, profile, isCoach, signOut
  toast-context.tsx   — Context React: showError(messaggio), notifiche di errore uniformi
```

## Schema database Supabase

### Tabelle principali

**`teams`** — squadre isolate (multi-tenant)
- `id` uuid PK
- `name` varchar
- `invite_code` text UNIQUE — generato random (8 caratteri), usato nel link `/register?team=<invite_code>`
- `is_active` bool
- `created_at` timestamptz, `created_by` uuid FK → users.id

**`users`** — profilo utente (collegato 1:1 a auth.users)
- `id` uuid PK (= auth.users.id)
- `first_name`, `last_name`, `email` varchar
- `user_role` enum: `admin | coach | player` — `admin` è il super-admin globale (governa tutte le squadre dalla pagina `/admin`, vedi sotto); `is_coach_of_my_team()` tratta `admin` come coach anche della propria `team_id`, se ne ha una (vedi RLS)
- `court_role` enum: `palleggiatore | schiacciatore | opposto | centrale | libero`
- `jersey_number` int4
- `is_active` bool
- `team_id` uuid FK → teams.id (NULL finché non si registra tramite link di invito, o per un super-admin senza squadra propria)
- `avatar_url` text — foto profilo (Supabase Storage, bucket `avatars`, pubblico in lettura)
- `created_at` timestamptz

**`athlete_details`** — dati anagrafici sensibili (1:1 con users)
- `user_id` uuid PK FK → users.id
- `codice_fiscale`, `sesso`, `data_nascita`, `luogo_nascita`, `prov_nascita`
- `indirizzo_residenza`, `cap`, `citta_residenza`, `prov_residenza`
- `cellulare`
- `scadenza_visita_medica` date
- `addetto_dae` bool, `scadenza_dae` date
- `addetto_antincendio` bool, `scadenza_antincendio` date

**`events`** — calendario appuntamenti
- `id` uuid PK
- `team_id` uuid FK → teams.id NOT NULL — impostato in automatico da un trigger BEFORE INSERT dalla squadra di chi crea l'evento, non falsificabile lato client
- `title` varchar (auto-generato per partite: "vs Avversario")
- `event_type` enum: `training | match | event`
- `date_time` timestamptz
- `location` varchar
- `notes` text
- `opponent_name` varchar (solo per match)
- `is_home_game` bool (solo per match)
- `latitude` double precision, `longitude` double precision
- `maps_url` text
- `created_by` uuid FK → users.id

**`attendances`** — presenze agli eventi
- `id` uuid PK
- `event_id` uuid FK → events.id (cascade delete)
- `user_id` uuid FK → users.id
- `status` enum: `present | absent | late | maybe`
- `checked_in` bool (presenza fisica confermata dall'allenatore)
- `updated_at` timestamptz
- UNIQUE: (event_id, user_id)

**`matches`** — dettagli partita (1:1 con events di tipo match)
- `id` uuid PK
- `event_id` uuid FK → events.id UNIQUE
- `opponent_name` varchar
- `is_home_game` bool
- `sets_won`, `sets_lost` int4
- `notes` text

**`match_set_stats`** — chi gioca ogni set
- `id` uuid PK
- `match_id` uuid FK → matches.id (cascade delete)
- `user_id` uuid FK → users.id
- `set_number` int4 (1–5)
- `played_as_libero` bool
- `is_starter` bool default true — titolare (true) o cambio (false) in quel set

### Funzioni e trigger
- `public.my_team_id()` — SECURITY DEFINER, la `team_id` di chi è loggato
- `public.is_super_admin()` — SECURITY DEFINER, `true` se `user_role = 'admin'`
- `public.is_coach_of_my_team()` — SECURITY DEFINER, `true` se `user_role in ('coach', 'admin')`; un admin con una `team_id` propria viene trattato come coach di quella squadra (non delle altre: le policy che la usano richiedono sempre anche `team_id = my_team_id()`)
- `public.handle_new_user()` — trigger su auth.users INSERT: crea automaticamente la riga in public.users con ruolo 'player', `is_active = false` (in attesa di approvazione, vedi Autenticazione), nome/cognome da `raw_user_meta_data` (form o Google); `team_id` resta NULL finché non si usa un link di invito
- `public.resolve_team_by_invite_code(code)` / `public.claim_team_by_invite_code(code)` — vedi Autenticazione → iscrizione via link di invito
- `public.set_event_team_id()` — trigger BEFORE INSERT su `events`: imposta `team_id` e `created_by` da chi crea l'evento

### Viste
- `public.athlete_medical_status` — vista su `athlete_details` filtrata per `team_id = my_team_id()`, espone solo `user_id, scadenza_visita_medica, addetto_dae, scadenza_dae`, leggibile da qualunque utente loggato (`grant select ... to authenticated`). Serve perché `athlete_details` è leggibile via RLS solo da coach/interessato: senza questa vista un giocatore normale non potrebbe vedere lo stato visita/DAE dei compagni nel badge "per tutti" di `/players` (bug scoperto e corretto in sessione: il badge sembrava dire "mancante" per chiunque non fosse il coach o l'interessato)

### RLS (multi-squadra, dal 2026-09-26)
Tutte le tabelle hanno RLS attiva, isolata per `team_id`. Le policy usano `my_team_id()` / `is_super_admin()` / `is_coach_of_my_team()` (vedi sopra) per evitare ricorsione infinita e per far rispettare l'isolamento tra squadre: un coach vede/modifica solo la propria squadra, un super-admin (`user_role='admin'`) vede tutte le `teams`/`users` ma non entra nel calendario/rosa delle squadre altrui a meno che non abbia anche lui una `team_id` (in quel caso è coach di quella soltanto).

Ogni utente può aggiornare la propria riga in `users` e `athlete_details` (policy `auth.uid() = id` / `auth.uid() = user_id`, per la pagina `/profile`). Il trigger `protect_coach_managed_fields` su `users` impedisce a chi non è coach/admin di modificare `user_role`, `court_role`, `jersey_number`, `is_active`, `email` anche aggirando la UI (li riporta al valore precedente lato DB); impedisce anche a chi non è super-admin di cambiare `team_id` (eccetto durante `claim_team_by_invite_code`) o di assegnare/togliere il ruolo `admin`. Bucket Storage `avatars`: lettura pubblica, scrittura solo nella propria cartella `{user_id}/...`.

File di migrazione (in `supabase/`, da eseguire con l'SQL Editor di Supabase, non committati come "eseguiti automaticamente"): `migration_prod_step1_additive.sql` (schema), `migration_prod_step2_rls_switch.sql` (switch RLS), `migration_prod_phase2_invite.sql` (link di invito), `migration_prod_phase3_admin_as_coach.sql` (admin anche coach della propria squadra).

## Funzionalità implementate

### Autenticazione
- Login/registrazione via Supabase Auth: email + password, oppure Google (`supabase.auth.signInWithOAuth({ provider: 'google' })`, stesso bottone su `/login` e `/register` — per un account Google è la stessa identica chiamata sia per il primo accesso che per quelli successivi)
- **Recupero password**: `/forgot-password` (invia il link via `resetPasswordForEmail`) → `/reset-password` (imposta la nuova password dopo il click sul link). SMTP configurato (Resend, dominio sandbox `resend.dev`) — **funziona solo verso l'email del coach**: in sandbox Resend consegna solo all'indirizzo del proprio account, non ad altri giocatori, finché non si verifica un dominio proprio o si passa a Gmail SMTP. Nel frattempo, se un giocatore perde la password va reimpostata a mano dal coach (Supabase → Authentication → Users)
- **Iscrizione via link di invito** (`/register?team=<invite_code>`): la pagina risolve il codice via RPC `resolve_team_by_invite_code` e mostra il nome della squadra prima del form; blocca la registrazione con un link mancante/non valido; dopo la `signUp()` chiama `claim_team_by_invite_code` per assegnare `team_id`. Per Google, il codice viaggia nel redirect OAuth (`redirectTo=/calendar?claim_team=...`) e viene applicato da `RequireAuth` al ritorno, prima del gate "in attesa di approvazione"
- Ogni nuovo utente ha ruolo `player` di default e `is_active = false` (in attesa di approvazione dal coach della sua squadra)
- Per promuovere a `coach`: il coach/super-admin della squadra lo fa da `/players`; il **primo** coach di una squadra appena creata (nessuno ancora attivo che possa farlo) va attivato dal super-admin da `/admin`
- Per promuovere a super-admin (`user_role='admin'`): nessuna UI, solo manualmente via SQL Editor/Table Editor Supabase — scelta deliberata, è un ruolo raro e ad alto privilegio
- Chi ha ruolo `coach` o `admin` è considerato `isCoach` nell'app; solo chi ha ruolo `admin` è `isSuperAdmin` (vedi `/admin`)
- Nota: un utente creato via Google potrebbe avere nome/cognome vuoti nella riga `users` se il trigger `handle_new_user` legge solo `raw_user_meta_data->>'first_name'/'last_name'` (popolati solo dalla registrazione via form) — in tal caso può sistemarli lui stesso da `/profile`

### Calendario (`/calendar`)
- Toggle "📋 Lista" / "🗓️ Calendario": vista lista (default) o griglia mensile sola-visualizzazione (nessuna creazione/modifica dalla griglia), per individuare colpo d'occhio eventi nello stesso giorno; ogni cella mostra pallini colorati per tipo evento e un bordo rosso se ci sono 2+ eventi quel giorno; tap su un giorno apre sotto la griglia il dettaglio (orario, tipo, titolo, luogo) di tutti gli eventi di quel giorno, ordinati per ora
- Navigazione per mese (frecce ‹ › + etichetta mese, pulsante "Oggi" per tornare al mese corrente): comune a vista lista e griglia, un unico stato (`calendarMonth`) condiviso tra le due — cambiare mese in una vista resta impostato anche passando all'altra
- Vista lista: eventi del mese selezionato, ordine crescente
- Tab filtri: Tutti / Allenamenti / Partite (valgono sia per lista che per griglia)
- Paginazione: 10 eventi per pagina (solo vista lista, entro il mese selezionato)
- RSVP per ogni evento: Ci sono / In ritardo / Forse / Non ci sono (toggle)
- "Chi ha risposto": lista nomi per stato
- **Appello presenze** (solo coach): spunta chi è fisicamente presente (`checked_in`); l'elenco include chi ha risposto Ci sono, In ritardo o Forse (non chi ha risposto Non ci sono)
- Per le partite: pulsante "🏐 Gestisci partita →" (solo coach) e badge risultato (es. "3–0") in lista una volta salvato
- Form nuovo evento / modifica evento esistente (solo coach, pulsanti "Modifica"/"Elimina" su ogni card):
  - Tipo: Allenamento / Partita / Evento — non modificabile in fase di modifica (per non disallineare i dati collegati, es. `matches`)
  - Per partite: avversario (obbligatorio) + casa/trasferta — il titolo è auto-generato ("vs Avversario"), non mostrato in card (c'è già il badge)
  - Per allenamenti: titolo auto-generato ("Allenamento"), non mostrato in card — la data/ora è evidenziata accanto al badge
  - Per eventi generici: campo titolo manuale
  - Luogo con geocodifica automatica via Nominatim (OpenStreetMap, gratuito); le coordinate esistenti si mantengono in modifica se il campo luogo non viene toccato

### Gestione partita (`/match/[id]`)
- Accessibile solo a coach/admin
- Avversario e sede letti dall'evento (non reinseriti)
- **Prima**: formazioni per set (tab Set 1–5)
  - Lista giocatori con check-box "in campo", toggle "Titolare/Cambio" (`is_starter`, colonna aggiunta manualmente via migrazione) e toggle "Libero"
  - Contatore "X titolari · Y cambi" nell'header del set
  - Se c'è check-in, mostra solo i giocatori presenti; altrimenti tutti i giocatori attivi
  - Salvataggio automatico e ottimistico per ogni spunta (vedi Convenzioni di sviluppo)
- **Poi**: risultato finale (set vinti–persi, stile tabellone elettronico) + note partita — richiede pulsante "Salva" esplicito, non è automatico come le formazioni
- Intestazione partita: solo data, avversario, sede, luogo — niente titolo evento né risultato duplicato (il risultato si vede solo nel tabellone)

### Rosa squadra (`/players`)
- Lista tutti i giocatori (attivi e non, questi ultimi con opacità ridotta), da `users`
- Solo coach/admin vedono i pulsanti Modifica, Disattiva/Attiva ed Elimina
- **Elimina** (solo coach, con conferma): cancella riga `users` + `athlete_details`/`attendances`/`match_set_stats` collegati. Non tocca l'account Supabase Auth (nessun privilegio admin lato client): se la persona accede di nuovo in futuro, `loadProfile()` in `lib/auth-context.tsx` non trova più il profilo e ne ricrea uno pulito (ruolo `player`, `is_active=false`) come se fosse una nuova iscrizione — richiede la policy `users_insert_own_row` (self-insert con valori vincolati a player/non attivo, per evitare che un utente si auto-assegni ruolo/attivazione)
- **"📊 Statistiche partite"** (solo coach, sezione collassabile): per ogni giocatore, partite giocate (match distinti), volte titolare, volte cambio — aggregato client-side da `match_set_stats`
- Form modifica: ruolo squadra, ruolo in campo, numero maglia sempre visibili; anagrafica, residenza, certificati sono sezioni collassabili (aperte di default solo se il giocatore ha già dati in quella sezione)
- Nuovi giocatori si aggiungono registrandosi da `/register`
- Avatar: se `avatar_url` è presente viene mostrato al posto del cerchio con `#numero maglia` (il numero, se presente, si sposta accanto all'email)
- Badge visita medica/DAE (visibili a tutti, non solo al coach): non mostrano la scadenza ma solo lo stato — "✓/✕ Visita medica" in base a `scadenza_visita_medica >= oggi`; "✓ DAE" (verde) o "⚠ DAE scaduto" (ambra) solo se `addetto_dae` è vero
- Alert coach "⚠️ Visite mediche in scadenza" in cima alla pagina: elenca chi ha la visita medica scaduta o in scadenza entro 15 giorni (con data), solo se `isCoach`
- Pallino rosso sull'avatar (in Rosa e nell'header della NavBar, per l'utente loggato) se la visita medica scade entro 15 giorni — stesso calcolo del badge/alert, solo un indicatore visivo aggiuntivo

### Il mio profilo (`/profile`)
- Ogni utente (giocatore incluso) modifica qui i propri dati: nome/cognome, foto, anagrafica, residenza, certificati — stesse sezioni collassabili di `/players`, ma senza ruolo squadra/ruolo in campo/numero maglia (badge in sola lettura, gestiti solo dal coach da `/players`)
- Foto profilo: upload su Storage bucket `avatars/{user_id}/avatar.<ext>` (`upsert: true`, sovrascrive sempre lo stesso file), poi `users.avatar_url` viene aggiornato con l'URL pubblico + `?t=timestamp` per invalidare la cache immagine
- Accesso dalla NavBar: tap sul proprio nome/avatar nell'header
- Vedi anche RLS/trigger `protect_coach_managed_fields` sopra: l'auto-modifica non può toccare ruolo/maglia/stato/email
- Alert personale in cima alla pagina se la propria `scadenza_visita_medica` è scaduta o scade entro 15 giorni (visibile solo al proprietario del profilo; per il coach l'equivalente aggregato su tutta la squadra è in `/players`)

### Admin (`/admin`)
- Accessibile solo a `user_role='admin'` (super-admin globale); link dedicato nella bottom nav (terza voce, solo per lui)
- **Nuova squadra**: form nome → crea riga `teams` (codice invito generato automaticamente dal default di colonna)
- **Lista squadre**: stato attiva/disattivata (toggle), link di invito (`/register?team=<invite_code>`) con copia negli appunti, condivisione WhatsApp e rigenerazione codice (invalida subito il link precedente, richiede conferma)
- **Membri per squadra** (sezione espandibile): nome, email, ruolo, stato; per un membro in attesa (`is_active=false`) due pulsanti — "Attiva coach" (`user_role='coach'`, `is_active=true`, pensato per il primo coach di una squadra appena creata, che altrimenti non avrebbe nessuno che lo attivi) e "Attiva" (come semplice giocatore); ogni membro ha anche "Elimina" (stesso comportamento distruttivo di `/players`: cancella `athlete_details`/`attendances`/`match_set_stats`, poi la riga `users`, account Auth intatto)
- **Elimina squadra** (pulsante rosso sulla card, conferma nativa del browser): cancella in cascata `match_set_stats` → `matches` → `attendances` → `events` della squadra, poi libera i membri (`users.team_id = null`, restano come utenti) e infine la riga `teams`. Irreversibile. Non permette invece di creare/assegnare il ruolo `admin` — operazione rara e ad alto rischio, lasciata a SQL Editor/Table Editor manuale

## Convenzioni di sviluppo
- Ogni componente pagina ha una funzione interna `*Content()` avvolta da `<RequireAuth>`
- `isCoach` viene da `useAuth()` e vale `true` per ruoli `coach` e `admin`
- Le query Supabase usano fetch separato (prima attendances, poi users per nomi) per evitare errori HTTP 300 da join nested
- Stile mobile-first: bottoni con `py-2.5`, `rounded-xl`, `active:scale-95`
- ESLint: i `useEffect` con fetch usano `// eslint-disable-next-line react-hooks/set-state-in-effect`
- Errori verso l'utente: mai `alert()`, usare `useToast()` da `lib/toast-context.tsx` (`showError(messaggio)`)
- Scritture su Supabase toccate da tap ripetuti (RSVP, appello, formazioni, titolare/cambio) aggiornano lo stato locale in modo ottimistico prima della risposta di rete, e lo ripristinano solo se la scrittura fallisce (vedi `setRsvp`/`toggleCheckin` in `app/calendar/page.tsx` e `togglePlayerInSet`/`toggleLibero`/`toggleStarter` in `app/match/[id]/page.tsx`)

## Palette colori (semantica, non un design system formale)
- **Blu** (`blue-600`): azione primaria, RSVP "Ci sono", badge ruolo giocatore, tab attiva
- **Ambra** (`amber-400/500`): partite, tabellone risultato, RSVP "In ritardo", Libero, DAE/antincendio
- **Violetto** (`violet-500`): stati "secondari/alternativi" — RSVP "Forse", toggle "Cambio" in formazione
- **Verde**: conferma/salvato, presenza fisica confermata (appello)
- **Rosso**: eliminazione, RSVP "Non ci sono", errori/toast
- **Slate**: neutro — allenamenti, stati inattivi/disabilitati

## Funzionalità da implementare (backlog)
- [x] Vista calendario a griglia mensile (punto 7) — sola visualizzazione, per individuare sovrapposizioni
- [ ] Notifiche push o email quando viene creato un evento
- [x] Deploy su Vercel — automatico ad ogni push su `main`
- [x] Recupero password (`/forgot-password` → `/reset-password`) e login con Google — **richiede configurazione manuale su Supabase/Google Cloud, vedi sotto**
- [x] ~~SMTP reale per email di conferma registrazione~~ — scelta deliberatamente di non riattivarla: l'attivazione manuale via `is_active` (vedi sotto) è già un controllo più forte, la conferma email sarebbe ridondante. Resta comunque da sistemare un dominio verificato per far funzionare il recupero password verso tutti i giocatori, non solo il coach (vedi nota SMTP/Resend sopra)
- [x] Statistiche giocatori: partite giocate, volte titolare, volte cambio (Rosa squadra → "📊 Statistiche partite", solo coach)
- [ ] Statistiche giocatori: presenze e set giocati (manca ancora)
- [x] Pagina profilo personale per ogni giocatore (`/profile` — dati anagrafici e foto; ruolo/maglia restano al coach)
- [x] Multi-squadra: schema + RLS isolata per `team_id`, iscrizione via link di invito (`/register?team=...`), console super-admin `/admin` per creare squadre e attivare il primo coach
- [ ] Multi-squadra: onboarding di una seconda squadra reale (oggi esiste solo "Dindiats Volley" — l'isolamento è a posto lato dati/RLS ma non è ancora stato provato con una seconda squadra vera)

## Note importanti
- Il file `.env.local` contiene le chiavi Supabase e NON va committato (già in .gitignore)
- La conferma email è disabilitata su Supabase (Authentication → Sign In → Email) **per scelta definitiva**, non solo per i test: la sostituisce l'attivazione manuale via `is_active` (vedi Autenticazione)
- Due utenti hanno ruolo `coach` (coach-giocatori: fanno entrambe le cose, nessun cambio profilo necessario)
- La tabella `atleti` è stata eliminata (era duplicato di `users`); i dati anagrafici ora sono in `athlete_details`
- Nome definitivo della squadra/app: **Dindiats Volley** (manifest PWA, titolo pagina, header login/registrazione)