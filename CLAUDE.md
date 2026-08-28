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
  layout.tsx          — Root layout con AuthProvider e NavBar
  page.tsx            — Redirect a /calendar
  login/page.tsx      — Login via Supabase Auth
  register/page.tsx   — Registrazione (ruolo default: player)
  calendar/page.tsx   — Calendario eventi con RSVP, appello, storico
  players/page.tsx    — Rosa squadra (users + athlete_details)
  match/[id]/page.tsx — Gestione partita: formazioni per set + risultato
components/
  NavBar.tsx          — Barra navigazione con logout e badge ruolo
  RequireAuth.tsx     — Protezione pagine (coachOnly per /match)
lib/
  supabase.ts         — Client Supabase (chiavi da .env.local)
  auth-context.tsx    — Context React: user, profile, isCoach, signOut
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
- Vista default: prossimi 30 giorni, ordine crescente
- Pulsante "🕐 Storico": eventi passati, ordine decrescente
- Tab filtri: Tutti / Allenamenti / Partite
- Paginazione: 10 eventi per pagina
- RSVP per ogni evento: Ci sono / In ritardo / Forse / Non ci sono (toggle)
- "Chi ha risposto": lista nomi per stato
- **Appello presenze** (solo coach): spunta chi è fisicamente presente (`checked_in`)
- Per le partite: pulsante "🏐 Gestisci partita →" (solo coach)
- Form nuovo evento (solo coach):
  - Tipo: Allenamento / Partita / Evento
  - Per partite: avversario (obbligatorio) + casa/trasferta — il titolo è auto-generato
  - Per allenamenti/eventi: campo titolo manuale
  - Luogo con geocodifica automatica via Nominatim (OpenStreetMap, gratuito)

### Gestione partita (`/match/[id]`)
- Accessibile solo a coach/admin
- Avversario e sede letti dall'evento (non reinseriti)
- **Prima**: formazioni per set (tab Set 1–5)
  - Lista giocatori con check-box "in campo" e toggle "Libero"
  - Se c'è check-in, mostra solo i giocatori presenti; altrimenti tutti i giocatori attivi
  - Salvataggio automatico per ogni spunta
- **Poi**: risultato finale (set vinti–persi) + note partita

### Rosa squadra (`/players`)
- Lista tutti i giocatori attivi (da `users`)
- Solo coach/admin vedono i pulsanti Modifica e Disattiva
- Form modifica: ruolo squadra, ruolo in campo, numero maglia + anagrafica completa (da `athlete_details`)
- Nuovi giocatori si aggiungono registrandosi da `/register`

## Convenzioni di sviluppo
- Ogni componente pagina ha una funzione interna `*Content()` avvolta da `<RequireAuth>`
- `isCoach` viene da `useAuth()` e vale `true` per ruoli `coach` e `admin`
- Le query Supabase usano fetch separato (prima attendances, poi users per nomi) per evitare errori HTTP 300 da join nested
- Stile mobile-first: bottoni con `py-2.5`, `rounded-xl`, `active:scale-95`
- ESLint: i `useEffect` con fetch usano `// eslint-disable-next-line react-hooks/set-state-in-effect`

## Funzionalità da implementare (backlog)
- [ ] Vista calendario a griglia mensile (punto 7)
- [ ] Import CSV atleti (punto 3) — file `at2.csv` da caricare
- [ ] Caricamento allenamenti in bulk (punto 4)
- [ ] Notifiche push o email quando viene creato un evento
- [ ] Deploy su Vercel
- [ ] SMTP reale per email di conferma registrazione (ora disabilitata per test)
- [ ] Statistiche giocatori (presenze, partite giocate, set giocati)
- [ ] Pagina profilo personale per ogni giocatore

## Note importanti
- Il file `.env.local` contiene le chiavi Supabase e NON va committato (già in .gitignore)
- La conferma email è disabilitata su Supabase (Authentication → Sign In → Email) per facilitare i test
- Due utenti hanno ruolo `coach` (coach-giocatori: fanno entrambe le cose, nessun cambio profilo necessario)
- La tabella `atleti` è stata eliminata (era duplicato di `users`); i dati anagrafici ora sono in `athlete_details`