# Controllo del sito online · 17 novembre 2026

Sul dominio [scuolevicine.it](https://scuolevicine.it/) non sono emersi altri blocchi della Content Security Policy (CSP) nelle funzioni provate. La correzione delle glosse è presente online. Il controllo non ha richiesto modifiche alla protezione o un nuovo deploy.

Versione verificata: commit `2b5d65a`. Browser: Brave su desktop, con area di pagina rilevata di 1751 × 959 pixel, e prova responsive a 390 × 844 pixel. La prova mobile usa il browser desktop con dimensioni ridotte: non sostituisce una verifica su Safari iOS o Chrome Android reali.

## Controlli automatici sul dominio pubblico

- 762 pagine: tutti i 760 indirizzi della sitemap, più famiglia e confronto. Nessun errore HTTP, nessuno script eseguibile incorporato e nessun attributo evento inline rilevato nell’HTML.
- Una sola CSP sulle pagine controllate, con `script-src 'self' https://cloud.umami.is`, senza `unsafe-eval`. Le protezioni sono rimaste attive durante le prove.
- Tutte le 19 risorse distinte richiamate direttamente dagli elementi HTML controllati rispondono correttamente. Controllati anche moduli JavaScript caricati indirettamente, otto font locali e il worker MapLibre: disponibili sul dominio del sito.
- Redirect HTTP → HTTPS e www → dominio principale verificati. Pagine principali, sitemap, robots.txt e Markdown disponibili; guida locale `/design/` e indirizzo inesistente rispondono 404.
- API: creazione, lettura, modifica e decifratura di uno spazio sintetico; credenziale errata respinta; conflitto di revisione riconosciuto; eliminazione verificata con successiva risposta 404.

La scansione delle dipendenze ha trovato anche tre immagini standard citate dal CSS Leaflet ma assenti (`marker-icon.png`, `layers.png`, `layers-2x.png`). Il sito usa marcatori personalizzati e non usa il controllo dei livelli che richiede quelle immagini: nelle prove non hanno impedito la visualizzazione o la selezione dei punti. Si tratta di riferimenti inutilizzati della libreria, non di un blocco CSP. Se in futuro si aggiungono marcatori standard o il selettore dei livelli, occorre distribuire anche queste immagini.

## Prove nell’interfaccia

| Funzione | Verifica ed esito |
| --- | --- |
| Ricerca per nome | Risultato noto, nessun risultato e ripristino dei filtri provati su desktop; ricerca e schede espandibili provate anche a 390 pixel. |
| Ricerca per indirizzo | Photon restituisce suggerimenti per Via Savona su entrambe le dimensioni. Su desktop, scelta del suggerimento, distanze e ordinamento verificati. Un civico non trovato produce il messaggio previsto. |
| Filtri | Municipio, gestione, azzeramento e pannello mobile funzionanti; risultato verificato dopo la chiusura del pannello. |
| Mappa nella ricerca | Caricamento della cartografia OpenStreetMap, passaggio elenco/mappa e selezione di un punto verificati. Rifiutando le mappe esterne resta la rappresentazione locale. |
| Scheda scuola | Informazioni, collegamenti alle fonti e apertura della sezione Fonti funzionanti. Mappa OpenStreetMap incorporata creata dopo il consenso e rimossa dopo la revoca, verificata anche nel layout mobile. |
| Salvataggi e confronto | Aggiunta di due scuole, filtro delle differenze, copia del collegamento e rimozione dal confronto verificati; confronto utilizzabile anche a 390 pixel. |
| Spazio famiglia locale | Scrittura e persistenza di un appunto sintetico dopo ricarica verificate, anche nel layout mobile. Esportazione JSON scaricata e letta; importazione di una copia sintetica confermata dall’interfaccia. |
| Spazio condiviso | Creazione dal browser, link segreto e QR, sincronizzazione, persistenza di un appunto dopo ricarica e ritorno alla copia locale verificati. Le prove API controllano separatamente cifratura, credenziali e revisioni. |
| Open day | Filtri per mese, Municipio, scuole salvate ed eventi passati funzionanti; stato vuoto coerente. File ICS scaricato e letto: quattro appuntamenti corrispondenti ai filtri scelti. Filtri provati anche nel layout mobile. |
| Guide e glosse | Filtro per argomento e collegamento alla risposta funzionanti. In tutte e sette le guide, apertura della fonte verificata sia a 390 pixel sia su desktop; su desktop il pannello laterale rimane nella posizione prevista. Chiusura e ripristino del focus verificati. |
| Segnalazioni | Campi obbligatori verificati. Segnalazione sintetica inviata dal modulo: conferma visibile, record in D1, notifica ricevuta nella casella del titolare e un solo tentativo di invio registrato. Apertura e annullamento del dialogo provati anche nel layout mobile. |
| Preferenze privacy | Apertura, accettazione, rifiuto e revoca del consenso alle mappe funzionanti. |

Nelle pagine mobile esaminate — ricerca, confronto, scheda, agenda e guide — non è stato rilevato scorrimento orizzontale involontario a 390 pixel. La console acquisita dal browser non ha riportato errori o avvisi; questo riscontro affianca le prove funzionali e non viene usato da solo per escludere violazioni CSP.

## Limiti del controllo

- **Umami, verifica completata successivamente:** il titolare ha aperto `/metodo/` dal telefono e confermato l’accettazione delle statistiche; la pagina è comparsa nella dashboard Umami. La versione successiva `2867200`, pubblicata il 17 novembre, rende visibile nelle Preferenze privacy il blocco causato da Do Not Track o Global Privacy Control. Il messaggio è apparso nella sessione Brave usata per il collaudo, confermando la presenza di almeno uno dei segnali. Corretti inoltre il riavvio della misurazione dopo revoca e nuovo consenso nella stessa pagina e la possibilità di ritentare il caricamento dello script dopo un errore. Test automatici verificano anche l’assenza di richieste prima del consenso, dopo rifiuto, sulle pagine personali e in presenza di DNT/GPC, oltre al blocco degli invii dopo revoca tra schede. Non sono state disattivate le protezioni del browser per forzare la prova.
- **OpenFreeMap:** stile remoto e worker locale disponibili, origini delle risorse dello stile compatibili con la policy. Non è stato forzato un guasto di OpenStreetMap per provare l’intero passaggio automatico alla cartografia vettoriale.
- **Dispositivi e funzioni di sistema:** non provati smartphone reali, stampa fisica, apertura nell’app calendario o lettura del QR con una fotocamera. Sono stati verificati la generazione del QR e i file scaricati.
- La scansione HTTP riguarda le pagine pubblicate e le dipendenze individuate; non costituisce un test di penetrazione o una garanzia per ogni browser ed estensione.

## Dati usati nel collaudo

Sono stati usati solo identificativi pubblici di scuole, appunti dichiaratamente sintetici e un indirizzo email di esempio non recapitabile. Gli spazi remoti e la segnalazione creati dal controllo sono stati eliminati da D1 dopo le verifiche. La selezione e il confronto del browser sono stati riportati a zero, con i testi di prova svuotati. Nella casella del titolare rimane l’email di collaudo ricevuta.

Nessuna credenziale, chiave, link segreto o contenuto personale è incluso in questo resoconto.
