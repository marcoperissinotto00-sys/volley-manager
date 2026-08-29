@AGENTS.md
# Volleyball Manager — Contesto per Claude Code

## Stack tecnico
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **Backend/DB**: Supabase (Auth + PostgreSQL + RLS)
- **Deploy**: Vercel (non ancora configurato)

## Struttura cartelle rilevante
```
app/
  layout.tsx          — Root layout con AuthProvider, ToastProvider e NavBar
  manifest.ts          — Manifest PWA (installabile su home screen)
  icon.png / apple-icon.png — Icone app (placeholder, in attesa di versione definitiva)
  page.tsx            — Redirect a /calendar
  login/page.tsx      — Login via Supabase Auth
  register/page.tsx   — Registrazione (ruolo default: player)
  calendar/page.tsx   — Calendario eventi con RSVP, appello, storico, crea/modifica/elimina evento
  players/page.tsx    — Rosa squadra (users + athlete_details) + statistiche partite
  match/[id]/page.tsx — Gestione partita: formazioni per set (titolare/cambio/libero) + risultato
components/
  NavBar.tsx          — Header con identità/logout + bottom tab bar (Calendario/Rosa)
  RequireAuth.tsx     — Protezione pagine (coachOnly per /match)
lib/
  supabase.ts         — Client Supabase (chiavi da .env.local)
  auth-context.tsx    — Context React: user, profile, isCoach, signOut
  toast-context.tsx   — Context React: showError(messaggio), notifiche di errore uniformi
```

## Schema database Supabase

### Tabelle principali

**`users`** — profilo utente (collegato 1:1 a auth.users)
- `id` uuid PK (= auth.users.id)
- `first_name`, `last_name`, `email` varchar
- `user_role` enum: `admin | coach | player`
- `court_role` enum: `palleggiatore | schiacciatore | opposto | centrale | libero`
- `jersey_number` int4
- `is_active` bool
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
- `public.is_coach_or_admin()` — SECURITY DEFINER, usata nelle RLS policy per evitare ricorsione
- `public.handle_new_user()` — trigger su auth.users INSERT: crea automaticamente la riga in public.users con ruolo 'player'

### RLS
Tutte le tabelle hanno RLS attiva. Le policy usano `is_coach_or_admin()` per evitare ricorsione infinita (bug noto se si usa una subquery diretta su `users` dentro una policy su `users`).

## Funzionalità implementate

### Autenticazione
- Login/registrazione via Supabase Auth (email + password)
- Ogni nuovo utente ha ruolo `player` di default
- Per promuovere a `coach`: Table Editor Supabase → tabella `users` → cambia `user_role`
- Chi ha ruolo `coach` o `admin` è considerato `isCoach` nell'app

### Calendario (`/calendar`)
- Toggle "📋 Lista" / "🗓️ Calendario": vista lista (default) o griglia mensile sola-visualizzazione (nessuna creazione/modifica dalla griglia), per individuare colpo d'occhio eventi nello stesso giorno; ogni cella mostra pallini colorati per tipo evento e un bordo rosso se ci sono 2+ eventi quel giorno; tap su un giorno apre sotto la griglia il dettaglio (orario, tipo, titolo, luogo) di tutti gli eventi di quel giorno, ordinati per ora
- Vista lista default: prossimi 30 giorni, ordine crescente
- Pulsante "🕐 Storico": eventi passati, ordine decrescente
- Tab filtri: Tutti / Allenamenti / Partite (valgono sia per lista che per griglia)
- Paginazione: 10 eventi per pagina (solo vista lista)
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
- Solo coach/admin vedono i pulsanti Modifica e Disattiva
- **"📊 Statistiche partite"** (solo coach, sezione collassabile): per ogni giocatore, partite giocate (match distinti), volte titolare, volte cambio — aggregato client-side da `match_set_stats`
- Form modifica: ruolo squadra, ruolo in campo, numero maglia sempre visibili; anagrafica, residenza, certificati sono sezioni collassabili (aperte di default solo se il giocatore ha già dati in quella sezione)
- Nuovi giocatori si aggiungono registrandosi da `/register`

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
- [ ] Import CSV atleti (punto 3) — file `at2.csv` da caricare
- [ ] Caricamento allenamenti in bulk (punto 4)
- [ ] Notifiche push o email quando viene creato un evento
- [ ] Deploy su Vercel
- [ ] SMTP reale per email di conferma registrazione (ora disabilitata per test)
- [x] Statistiche giocatori: partite giocate, volte titolare, volte cambio (Rosa squadra → "📊 Statistiche partite", solo coach)
- [ ] Statistiche giocatori: presenze e set giocati (manca ancora)
- [ ] Pagina profilo personale per ogni giocatore

## Note importanti
- Il file `.env.local` contiene le chiavi Supabase e NON va committato (già in .gitignore)
- La conferma email è disabilitata su Supabase (Authentication → Sign In → Email) per facilitare i test
- Due utenti hanno ruolo `coach` (coach-giocatori: fanno entrambe le cose, nessun cambio profilo necessario)
- La tabella `atleti` è stata eliminata (era duplicato di `users`); i dati anagrafici ora sono in `athlete_details`