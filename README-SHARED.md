# Spazio famiglia condiviso — implementazione locale

Nessun deploy eseguito, nessun database cloud creato. L’ID D1 in `wrangler.jsonc` è un segnaposto valido soltanto per lo sviluppo locale.

## Avvio

```sh
npm install
npm run shared:db
npm run shared:dev
```

Aprire http://127.0.0.1:4320/famiglia/. Wrangler serve la build Astro e l’API sullo stesso dominio, con D1 locale in `.wrangler/` (ignorata). Dopo modifiche al frontend occorre ricostruire. `npm run dev` mantiene l’anteprima Astro/Regia attuale: il salvataggio locale funziona, ma non serve l’API D1. Non usare il link loopback/QR su un telefono: per quello servirà in seguito un dominio HTTPS raggiungibile.

Controlli: `npm run check`, `npm run shared:check`, `npm test`, `npm run build`.

## Esperienza

- Modalità locale invariata, comprese migrazione legacy, esportazione/importazione e link di sola selezione.
- “Condividi spazio” crea un documento cifrato a partire dalla rosa locale; la copia locale originaria rimane separata.
- Link segreto e QR generato localmente. Un invito richiede anteprima e accettazione; non importa automaticamente i dati locali.
- Nello spazio condiviso rosa, stati, note, domande e punti di vista A/B si sincronizzano. La selezione del confronto resta sul dispositivo.
- I possessori del link hanno pari permessi, eliminazione compresa. Nessun account/email/autore verificato, nessun recupero amministrativo delle chiavi.
- Le modifiche vengono conservate come bozze cifrate in IndexedDB. La sincronizzazione avviene dopo 800 ms, ogni 15 secondi a pagina visibile, al ritorno online e all’uscita dai campi. Durante la scrittura in una textarea degli appunti la sincronizzazione è sospesa fino al cambio di campo, per impedire che un aggiornamento remoto alteri il testo sotto il cursore. Non è presente un service worker: la bozza offline funziona su una pagina già aperta; non si promette l’avvio del sito senza rete.
- “Gestisci spazio” permette di importare la copia locale con anteprima, recuperare le bozze delle altre sessioni, tornare alla copia locale o eliminare lo spazio per tutti.
- Le bozze di sessioni diverse non si sovrascrivono; il recupero di una bozza non la cancella. Non c’è ancora un comando per eliminare singole bozze locali.
- Lo spazio scade 365 giorni dopo l’ultima modifica accettata; il polling non rinnova la durata. Cron giornaliero di pulizia e controllo di scadenza su ogni accesso.

## Sicurezza e formato

`/famiglia/#spazio=ID&accesso=TOKEN&chiave=KEY`: ID casuale da 128 bit, token e chiave indipendenti da 256 bit generati con `crypto.getRandomValues`. Il frammento viene acquisito e rimosso con `history.replaceState`, anche per inviti aperti nella stessa pagina. La condivisione rigenera il link completo.

- Il token viene inviato solo in `Authorization: Bearer`; D1 ne conserva l’hash SHA-256. La chiave AES non viene inviata all’API.
- Web Crypto AES-GCM, IV casuale nuovo da 96 bit a ogni cifratura. AAD: `scuole-milano:ID:FORMAT:REVISION`. Il tag di autenticazione è incluso nel ciphertext.
- Documento remoto: `{version:1, saved:[], entries:{}}`. Tutto il contenuto familiare, inclusi gli ID delle scuole, è cifrato. Il server conosce identificativo, dimensione, revisione e tempi, e tratta i normali metadati HTTP.
- Credenziali ricordate in localStorage; snapshot e bozze cifrati in IndexedDB. La chiave ricordata e il codice del sito fanno parte del perimetro di fiducia: la cifratura non protegge da XSS, codice distribuito malevolo o accesso al profilo browser.
- La copia locale precedente e le eventuali copie legacy **rimangono in chiaro sul dispositivo**, come prima. Anche le esportazioni JSON sono leggibili. L’attivazione non pretende di cancellare copie già esistenti.
- QR incluso nel bundle e font serviti localmente. CSP sul Worker, referrer disabilitato, risposte API `no-store`, nessun log applicativo di token/body/URL segreti. I servizi cartografici esterni e lo script statistico facoltativo seguono le scelte descritte nell’informativa `/privacy/`; Umami viene caricato solo dopo il consenso alle statistiche. Appunti e chiavi non sono inviati a questi servizi. I fornitori possono comunque trattare metadati tecnici.
- Controlli origine, dimensioni (documento UTF-8 massimo 900 kB), formato e rate limit Cloudflare: 5 creazioni/minuto, 180 altre richieste/minuto per IP. L’IP viene usato soltanto dal limiter, non scritto nel database. I limiter Cloudflare sono una protezione di base, non una quota globale stretta.

Tabella `shared_spaces`: `id`, `access_token_hash`, `revision`, `format_version`, `ciphertext`, `iv`, `last_operation_id`, `created_at`, `updated_at`, `expires_at`. Vedi `migrations/0001_shared_spaces.sql`.

API: `POST/GET/PUT/DELETE /api/spaces/:id`. POST parte da revisione 1; PUT invia l’envelope per revisione N+1. La scrittura verifica atomicamente revisione N e credenziale nella clausola WHERE. Nessuna replica D1 configurata. DELETE richiede `If-Match: N` per impedire di eliminare modifiche non ancora lette. Token errato, spazio assente o scaduto danno lo stesso 404.

## Conflitti e recupero

Merge a tre vie nel browser: base letta, bozza locale, ultima versione remota. Le differenze indipendenti si uniscono; divergenze sullo stesso campo richiedono scelta locale/remota o riscrittura. Nessun ordinamento per orologi dei dispositivi, nessuna concatenazione automatica di note in conflitto. Rimuovere dai preferiti conserva gli appunti.

I conflitti vengono persistiti nella bozza cifrata e rimangono dopo ricaricamento. Risolvendoli si riparte dalla versione remota confrontata: eventuali ulteriori aggiornamenti remoti vengono nuovamente confrontati.

Prima dell’invio si salva una bozza di recupero. Ogni operazione ha un ID casuale; se la risposta si perde dopo il commit, il client riconosce l’operazione rileggendo il server. Se nel frattempo un’altra operazione l’ha superata, esegue un nuovo merge conservativo. Le modifiche inserite durante una richiesta in corso restano nella bozza e vengono risalvate.

Il ritorno alla copia locale non elimina lo spazio remoto né le bozze. L’eliminazione cancella la riga nel database attivo e le bozze di quello spazio sul dispositivo corrente. Non elimina esportazioni o copie su altri dispositivi. I tempi di ritenzione dei backup Cloudflare devono essere verificati e documentati prima della pubblicazione; un ripristino infrastrutturale deve rispettare eliminazioni e scadenze avvenute successivamente. Nessuna cronologia remota degli appunti è implementata.

Per escludere chi possiede il vecchio link occorre creare un nuovo spazio con nuove credenziali e chiave, poi eliminare quello precedente. La prima versione non implementa revoca individuale né rotazione automatica.

## Prima di un futuro deploy

Richiede una richiesta separata dell’utente: creare/associare D1 reale, sostituire il segnaposto, applicare la migrazione remota, verificare dominio HTTPS, CSP, limiter e cron, e definire ritenzione/ripristino dei backup. Non inserire chiavi dei singoli spazi nelle variabili del Worker: devono restare nel browser.
