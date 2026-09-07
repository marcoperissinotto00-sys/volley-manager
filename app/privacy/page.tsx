export const metadata = {
  title: 'Privacy Policy — Dindiats Volley',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 text-slate-700">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Informativa sulla Privacy</h1>
        <p className="text-sm text-slate-500 mt-1">Dindiats Volley — Ultimo aggiornamento: 7 settembre 2026</p>
      </div>

      <p>
        La presente informativa descrive le modalità di trattamento dei dati personali degli utenti
        che utilizzano l&apos;applicazione &ldquo;Dindiats Volley&rdquo;, uno strumento gestionale ad uso interno
        del gruppo sportivo per organizzare calendario, presenze, formazioni e rosa squadra, ai sensi
        del Regolamento (UE) 2016/679 (&ldquo;GDPR&rdquo;).
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">1. Titolare del trattamento</h2>
        <p>
          Il titolare del trattamento è Marco Perissinotto, gestore dell&apos;applicazione, contattabile
          all&apos;indirizzo email <a href="mailto:marcoperissinotto00@gmail.com" className="text-blue-600 hover:underline">marcoperissinotto00@gmail.com</a>.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">2. Dati trattati</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Dati identificativi e di contatto</b>: nome, cognome, email, numero di cellulare.</li>
          <li><b>Dati account</b>: credenziali di accesso gestite da Supabase Auth (password mai visibile al titolare), oppure accesso tramite account Google.</li>
          <li><b>Dati sportivi</b>: ruolo in squadra, ruolo in campo, numero di maglia, presenze/assenze agli eventi, statistiche partite (titolare/cambio, set giocati).</li>
          <li><b>Foto profilo</b>, caricata facoltativamente dall&apos;utente.</li>
          <li><b>Dati anagrafici</b>: codice fiscale, sesso, data e luogo di nascita, indirizzo di residenza.</li>
          <li>
            <b>Dati relativi alla salute</b> (categoria particolare, art. 9 GDPR): data di scadenza del
            certificato di idoneità sportiva (visita medica); indicazione dell&apos;abilitazione come
            addetto DAE/antincendio e relative scadenze di formazione. Sono trattati esclusivamente per
            verificare l&apos;idoneità alla pratica sportiva e il rispetto degli obblighi di sicurezza
            durante gli eventi.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">3. Finalità e base giuridica</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gestione organizzativa della squadra (calendario, presenze, formazioni, rosa): esecuzione del rapporto associativo e consenso dell&apos;interessato.</li>
          <li>Verifica dell&apos;idoneità sportiva e della sicurezza (dati sanitari): consenso esplicito dell&apos;interessato, necessario per rispettare gli obblighi previsti per l&apos;attività sportiva dilettantistica.</li>
          <li>Autenticazione e sicurezza dell&apos;account: esecuzione del rapporto d&apos;uso dell&apos;applicazione.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">4. Natura del conferimento</h2>
        <p>
          Il conferimento dei dati anagrafici e sanitari è facoltativo ma necessario per essere inserito
          regolarmente in rosa e nelle formazioni di gara; il mancato conferimento può comportare
          l&apos;impossibilità di essere schierati in partita.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">5. Modalità del trattamento</h2>
        <p>
          I dati sono trattati con strumenti informatici tramite il database Supabase e la piattaforma
          Vercel per l&apos;erogazione dell&apos;applicazione, con misure di sicurezza tecniche quali
          l&apos;accesso protetto da autenticazione e regole di Row Level Security che limitano la
          visibilità dei dati sensibili al solo interessato e all&apos;allenatore.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">6. Soggetti terzi</h2>
        <p>I seguenti fornitori trattano i dati per conto del titolare, secondo le proprie policy privacy:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Supabase Inc.</b> — database, autenticazione, archiviazione immagini.</li>
          <li><b>Vercel Inc.</b> — hosting dell&apos;applicazione web.</li>
          <li><b>Google LLC</b> — accesso tramite &ldquo;Accedi con Google&rdquo;, solo se l&apos;utente sceglie questa modalità.</li>
          <li><b>Resend</b> — invio di email transazionali (es. recupero password).</li>
        </ul>
        <p>
          Alcuni di questi fornitori possono elaborare dati su server situati anche al di fuori
          dell&apos;Unione Europea (ad es. negli Stati Uniti); il trasferimento avviene sulla base delle
          Clausole Contrattuali Standard approvate dalla Commissione Europea o di altre garanzie adeguate
          previste dal GDPR.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">7. Periodo di conservazione</h2>
        <p>
          I dati sono conservati per tutto il periodo in cui l&apos;utente fa parte del gruppo sportivo e
          vengono cancellati su richiesta dell&apos;interessato o del titolare, salvo obblighi di
          conservazione previsti dalla legge.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">8. Diritti dell&apos;interessato</h2>
        <p>
          Ai sensi degli artt. 15-22 GDPR, l&apos;interessato ha diritto di accesso, rettifica,
          cancellazione, limitazione e portabilità dei propri dati, nonché di opposizione al
          trattamento. Può inoltre revocare in qualsiasi momento il consenso prestato per il trattamento
          dei dati sanitari, senza pregiudicare la liceità del trattamento svolto prima della revoca.
        </p>
        <p>
          Questi diritti si possono esercitare direttamente dalla pagina &ldquo;Il mio profilo&rdquo;
          dell&apos;app, oppure scrivendo a <a href="mailto:marcoperissinotto00@gmail.com" className="text-blue-600 hover:underline">marcoperissinotto00@gmail.com</a>.
          È inoltre possibile proporre reclamo al Garante per la Protezione dei Dati Personali
          (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.garanteprivacy.it</a>).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">9. Minori</h2>
        <p>
          L&apos;applicazione è destinata a utenti maggiorenni e non è progettata per raccogliere
          consapevolmente dati di minori di 18 anni.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">10. Modifiche alla presente informativa</h2>
        <p>
          Il titolare si riserva il diritto di modificare questa informativa; eventuali modifiche
          saranno pubblicate su questa stessa pagina con indicazione della data di aggiornamento.
        </p>
      </section>
    </div>
  );
}
