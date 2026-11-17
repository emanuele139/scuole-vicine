# Privacy e analytics · 17 novembre 2026

## Analisi del codice

Il sito è statico Astro con Worker Cloudflare per API e D1. GitHub ospita il codice; non è un destinatario delle segnalazioni. Il database non contiene soltanto preferenze anonime: registra segnalazioni con email, dettagli e scuola; spazi condivisi cifrati, hash del token, identificatori e date. Le API usano IP per rate limiting ma non lo inseriscono nei record. I contenuti degli spazi sono cifrati AES-GCM nel browser; credenziali e link segreti restano comunque dati da proteggere, non dati anonimi.

Inventario completo delle memorie nell’informativa `/privacy/`: famiglia e migrazioni legacy, cache indirizzi (24 ore/50 ricerche), ripristino ricerca (sessione/1 ora), credenziali condivise e confronto, sessione creazione, IndexedDB delle bozze cifrate. D1 conserva segnalazioni per 365 giorni e spazi per 365 giorni dall’ultima scrittura. Il cron elimina i record scaduti giornalmente; per gli spazi anche le letture API escludono record scaduti. Nessuna promessa di cancellazione immediata dai backup del provider.

## Implementazione

- `/privacy/` con titolare Emanuele Cardinali e contatto emanuele@cardinali.studio, basi giuridiche, finalità, destinatari, conservazione, diritti, minori, trasferimenti, fonti e inventario.
- Banner non modale, pulsanti equivalenti, X = rifiuto; dialog con categorie statistiche/mappe inizialmente disattivate. Footer per riapertura e revoca. La X/Esc del dialog non modifica la scelta precedente. Nessun consenso da scroll o navigazione.
- `scuole-vicine-consent-v1`: categorie, versione, date, scadenza di sei mesi UTC; nessun ID personale o registrazione D1. Ripresentazione alla scadenza, su perdita della memoria o versione sostanzialmente nuova. Limite probatorio: record sul dispositivo, non registro centrale immutabile; non dichiararlo una certificazione CMP.
- Font originali serviti localmente, licenze SIL OFL incluse. Rimossi Google Fonts e preconnessioni a Photon.
- Mappe OSM/OpenFreeMap solo con consenso; schema locale in ricerca quando manca. Incorporamenti OSM creati dopo scelta e rimossi alla revoca. Nessun iframe Google Maps; restano link scelti dall’utente. Photon parte con l’uso del campo indirizzo, con informazione contestuale; è distinto dal consenso ai tracciamenti.
- Umami Cloud: script e website ID forniti dal titolare, EU/Hobby confermati (sei mesi). Solo domini `scuolevicine.it` e `www.scuolevicine.it`; niente statistiche in anteprima o localhost.
- Script Umami creato solo dopo opt-in; auto tracking disabilitato, un pageview manuale, filtro prima dell’invio con allowlist. Eliminati query, hash, referrer e titolo dinamico; escluse famiglia, confronto, privacy, design, API e percorsi sconosciuti. Non attivi replay, identify, heatmap, eventi click, errori e performance. DNT e GPC bloccano anche il caricamento. Filtro rivalutato prima degli invii; revoca e scadenza valgono anche nella pagina già aperta e tra schede.
- CSP Worker aggiornata per script `cloud.umami.is`, invii `gateway.umami.is` e frame OSM. Non allargata con wildcard. Referrer-Policy no-referrer anche negli header statici. Condivisione e moduli non dipendono dal consenso analytics.

## Configurazione e lancio

Le variabili documentate in `.env.example` sono lette durante la build. I valori Umami confermati hanno default nel progetto. `PRIVACY_REVIEWED=false` disabilita completamente l’integrazione: nessuno script remoto è emesso nell’HTML. Per cambiare provider o finalità, aggiornare informativa, CSP, filtri e versione del consenso insieme.

Prima del lancio pubblico verificare nell’account Cloudflare:

1. Giurisdizione/posizione effettiva di D1, DPA e subresponsabili; i suggerimenti geografici non equivalgono da soli a una garanzia di residenza UE.
2. Log dell’infrastruttura, accessi amministrativi, conservazione e backup effettivi. Compilare `PUBLIC_HOSTING_REGION` e `PUBLIC_HOSTING_LOG_RETENTION`; l’informativa mostra attualmente questi punti come non confermati.
3. Accordi applicabili a Cloudflare e Umami, garanzie dei trasferimenti e richieste di copia delle garanzie. Regione EU di Umami riguarda lo storage statistico, non tutto il trattamento.
4. Binding D1 effettivo, migrazioni e cron di pulizia (la checkout contiene ancora un database ID segnaposto). Non attivare raccolte che non possono rispettare conservazione e diritti dichiarati.
5. Se il fornitore introduce challenge/cookie tecnici, aggiornare l’inventario da evidenze della configurazione reale, senza inventare cookie non rilevati nel codice.

L’informativa e il banner non attestano da soli piena conformità dell’organizzazione o degli account esterni. Nessun deploy effettuato con questo intervento.

## Verifiche

Test automatici di validità/scadenza del consenso, esclusione delle pagine private, assenza di richieste prima dell’opt-in, rifiuto, minimizzazione payload, revoca durante caricamenti pendenti, DNT/GPC, localhost, storage bloccato e revoca tra schede. Test runtime eseguiti sul bundle effettivo del controller, con ambiente simulato e senza inviare visite al servizio reale.

Browser locale: rifiuto conservato dopo reload; checkbox separate; zero iframe OSM prima della scelta, uno dopo consenso mappe, zero dopo revoca; nessuno script Umami su localhost. Mappa schematica locale disponibile. Informativa senza overflow orizzontale a 320 px, dialog scorrevole; controllo visivo mobile e desktop. Screenshot in `research/preview/privacy-preferenze-{desktop,mobile}.jpg` (materiale di QA escluso dalla pubblicazione). Non verificata ricezione di visite reali in dashboard Umami o header del dominio pubblico.

## Fonti ufficiali consultate

- GDPR: https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016R0679
- Garante, Linee guida 10 giugno 2021: https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9677876
- Garante, FAQ cookie: https://www.garanteprivacy.it/faq/cookie
- Umami tracker: https://docs.umami.is/docs/tracker-configuration
- Umami regioni e conservazione: https://docs.umami.is/docs/cloud/faq
- Umami privacy: https://umami.is/privacy
- Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
- OpenFreeMap privacy: https://openfreemap.org/privacy/
