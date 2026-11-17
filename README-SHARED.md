# Spazio famiglia condiviso

La configurazione locale in `wrangler.jsonc` usa un database separato con ID segnaposto. La configurazione di produzione, con D1 europeo, Pages e Worker interno, è descritta in [Pubblicazione su Cloudflare](docs/DEPLOYMENT.md).

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
- “Crea il tuo link” crea un documento cifrato a partire dalla selezione locale; la copia locale originaria rimane separata.
- L’header illustrato sopra la selezione presenta il link come strumento di conservazione senza account, anche dopo la cancellazione dei dati del browser. La condivisione è facoltativa; il link va conservato fuori dal browser.
- Un link completo dello stesso sito può essere incollato per aprire l’anteprima, senza navigare al suo URL né salvarlo nella cronologia.
- L’header compatto mostra titolo, conteggio, luogo e stato del salvataggio. Per gli spazi attivi, il pass Iris offre QR vettoriale, “Copia link” e “Scarica il pass PDF”. “Come funziona e tutti gli strumenti” espande spiegazione, link completo, privacy e gestione. Il QR è ingrandibile con un tocco, ha margine libero di quattro moduli e angoli arrotondati senza coprire dati. Un invito richiede anteprima e accettazione; non importa automaticamente i dati locali.
- Il pass PDF A4 è generato nel browser, con caratteri locali incorporati, logo, breve presentazione, link completo e QR vettoriale cliccabili. Non contiene gli appunti ed è una chiave di accesso, non un backup. Il modulo si carica soltanto al clic; errori riprovabili e controllo dello spazio ancora attivo prima del download. Nessun servizio PDF/QR esterno, nessun link segreto nelle richieste, nei metadati o nel nome del file.
- QR e PDF condividono la geometria vettoriale: moduli adiacenti uniti, soli angoli esposti arrotondati, tre riferimenti con cornici morbide. Il fondo coincide con il box (Iris chiaro nell’header e nell’ingrandimento, Prato nel PDF). Nel pass e nel PDF asterisco Sole e nastro Mandarino restano fuori dal quadrato protetto del QR; quattro moduli liberi per lato, correzione M e contenuto del link sono invariati.
- Nello spazio condiviso selezione, stati, note, domande e punti di vista A/B si sincronizzano. La selezione del confronto resta sul dispositivo.
- I possessori del link hanno pari permessi, eliminazione compresa. Nessun account/email/autore verificato, nessun recupero amministrativo delle chiavi.
- Le modifiche vengono conservate come bozze cifrate in IndexedDB. La sincronizzazione avviene dopo 800 ms, ogni 15 secondi a pagina visibile, al ritorno online e all’uscita dai campi. Durante la scrittura in una textarea degli appunti la sincronizzazione è sospesa fino al cambio di campo, per impedire che un aggiornamento remoto alteri il testo sotto il cursore. Non è presente un service worker: la bozza offline funziona su una pagina già aperta; non si promette l’avvio del sito senza rete.
- “Gestisci spazio” permette di importare la copia locale con anteprima, recuperare le bozze delle altre sessioni, tornare alla copia locale o eliminare lo spazio per tutti.
- Le bozze di sessioni diverse non si sovrascrivono; il recupero di una bozza non la cancella. Non c’è ancora un comando per eliminare singole bozze locali.
- Lo spazio scade 365 giorni dopo l’ultima modifica accettata; il polling non rinnova la durata. Pulizia automatica ogni 15 minuti in produzione e controllo di scadenza su ogni accesso.

## Sicurezza e formato

I nuovi spazi usano `/s/#2.SEED`: 32 byte casuali (256 bit) generati con `crypto.getRandomValues` e codificati in 43 caratteri base64url senza padding. Lunghezza completa su `https://scuolevicine.it`: **72 caratteri**. Il browser usa esclusivamente Web Crypto HKDF-SHA-256 con salt UTF-8 fisso `scuole-vicine/shared-space/v2` e tre etichette `info` distinte: `id` → 128 bit, `access` → 256 bit, `encryption` → 256 bit. Nessuna derivazione da password, libreria crittografica aggiuntiva o archivio di abbreviazione. Il segreto radice e la chiave AES non sono inviati all’API. Le chiavi derivate hanno usi separati; il materiale segreto iniziale ha 256 bit di entropia complessiva.

Le credenziali ricordate includono il segreto radice solo nel browser. A ogni ripristino i tre valori vengono ricalcolati e confrontati con quelli salvati; metadati incoerenti sono rifiutati. La generazione del link breve accetta soltanto credenziali v2 verificate e non mutate. Le creazioni rimaste in sospeso vengono ripristinate conservando credenziali ed envelope per i tentativi idempotenti.

Gli spazi esistenti mantengono le proprie credenziali. `/s/#1.PAYLOAD` conserva i precedenti 80 byte indipendenti (ID 16, accesso 32, chiave 32), codificati in 107 caratteri; anche `/famiglia/#spazio=ID&accesso=TOKEN&chiave=KEY` resta valido. Nessuna migrazione automatica, rotazione, riscrittura dei contenuti o modifica al database. La rigenerazione di un link v1 conserva il formato v1: non è possibile ricostruire un segreto radice per chiavi indipendenti già esistenti.

L’alias `/s/` serve la stessa pagina di `/famiglia/`, escluso da statistiche, sitemap e indicizzazione. Il frammento viene acquisito e rimosso con `history.replaceState` **prima del primo await crittografico**, anche per inviti aperti nella stessa pagina. Un invito successivo invalida i risultati ancora in corso per quello precedente.

Con correzione degli errori M, il QR sul dominio canonico passa da 53 × 53 moduli (166 caratteri originali), a 49 × 49 (136 caratteri v1), a **37 × 37** (72 caratteri v2). Margine libero di quattro moduli e correzione degli errori invariati. QR nell’header, finestra di ingrandimento e pass PDF usano lo stesso link dello spazio attivo. Riferimenti: [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869.html), [Web Crypto HKDF](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/#hkdf-operations).

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

Il ritorno alla copia locale non elimina lo spazio remoto né le bozze. L’eliminazione cancella la riga nel database attivo e le bozze di quello spazio sul dispositivo corrente. Non elimina esportazioni o copie su altri dispositivi. D1 Time Travel mantiene copie di ripristino fino a 30 giorni sul piano attuale; un ripristino infrastrutturale deve rispettare eliminazioni e scadenze avvenute successivamente. Nessuna cronologia remota degli appunti è implementata.

Per escludere chi possiede il vecchio link occorre creare un nuovo spazio con nuove credenziali e chiave, poi eliminare quello precedente. La prima versione non implementa revoca individuale né rotazione automatica.

## Produzione

Configurazione e comandi in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). La produzione usa un nuovo D1, separato dai dati locali; non migrare appunti o segnalazioni di prova personali. Il Worker pianificato pulisce i record scaduti e ritenta le notifiche email. Le chiavi degli spazi restano nel browser e non devono entrare nelle variabili del Worker.
