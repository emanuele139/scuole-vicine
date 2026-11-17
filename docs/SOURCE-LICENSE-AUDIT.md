# Verifica delle licenze delle fonti

Verifica del **17 novembre 2026** per Scuole Vicine. La verifica è stata svolta prima della pubblicazione del repository e non ha comportato deploy del sito. L’audit riguarda le condizioni di riuso; non aggiorna né certifica i dati delle scuole.

## Esito operativo

Il software originale è MIT. Per i dati sono confermate IODL 2.0 per il portale MIM e CC BY 4.0 per DS3014, DS47 e Geoschool. Per altre fonti la verifica delle condizioni è incompleta: questo esito **non equivale a un divieto di riuso**.

Per le pubblicazioni delle amministrazioni conta anche l’[articolo 52, comma 2, del CAD](https://docs.italia.it/italia/piano-triennale-ict/codice-amministrazione-digitale-docs/it/v2021-07-30/_rst/capo_V-sezione_I-articolo_52.html): in assenza di licenza espressa opera il principio di apertura predefinita, con l’eccezione dei dati personali. Le [linee guida AgID](https://www.agid.gov.it/sites/agid/files/2024-05/lg-open-data_v.1.0_1.pdf) trattano questo principio e l’attribuzione. Occorre distinguere il dato istituzionale dalla riproduzione di un’opera o da materiali di terzi e valutare se le riserve generali del sito siano applicabili al caso concreto. Questo audit non accerta la validità o l’efficacia di quelle riserve per i singoli dati inclusi.

I dati vengono mantenuti insieme alla provenienza. Le attribuzioni del sito sono raccolte in una sezione “Fonti” discreta. Non viene dedotto un obbligo generale di chiedere autorizzazioni, sostituire i dati o sospenderne l’uso dal solo fatto di non aver trovato una licenza specifica. Non viene neppure assegnata una licenza presunta ai materiali di terzi.

## Perimetro e metodo

Sono stati censiti **247 domini e 1.157 URL distinti** nei JSON di `src/data/` e `public/dati/`, incluse le fonti delle guide. L’[inventario](licenses/source-inventory.json) registra file, hash, conteggi e stato per dominio. Le note legali non sono state lette individualmente per tutti i 247 domini: quelli non verificati sono marcati come tali, senza dedurre licenze dal suffisso `.edu.it` o dalla natura pubblica dell’ente.

Per le fonti principali sono stati consultati metadati, policy dell’editore e riferimenti upstream. Alcune pagine non sono accessibili al lettore web; i metadati pubblici sono stati recuperati direttamente, senza autenticazione. Gli [estratti con URL e hash](licenses/metadata-evidence.json) documentano le risposte CKAN, ArcGIS e la provenienza Click That ’Hood. Gli hash identificano le risposte acquisite oggi, non quelle originarie del novembre 2026 conservate nella ricerca, né garantiscono che l’endpoint rimanga invariato.

## Dati principali: cosa possiamo redistribuire

| Materiale incluso o usato | Esito | Condizioni e decisione |
| --- | --- | --- |
| Comune di Milano, DS3014, scuole 2025/26 | **CC BY 4.0 confermata** | I metadati delle tre risorse indicano `A21_CCBY40`. Attribuire il Comune, collegare dataset e licenza, indicare filtro, normalizzazione e riconciliazione. |
| Comune di Milano, DS47, dati storici nidi | **CC BY 4.0 confermata** | Stessa indicazione nelle risorse CKAN. Conservare l’anno storico effettivo e descrivere l’uso come riserva per coordinate e geografia. |
| MIM, anagrafi statali e paritarie 2026/27 | **IODL 2.0 confermata dalla policy del portale** | Citare MIM e fonte, collegare la licenza ove possibile e dichiarare selezione Milano/F205 e trasformazioni. La policy non licenzia automaticamente ogni documento del Ministero su altri siti. |
| Geoschool, `geoschool_data_web/MapServer`, layer 0 | **CC BY 4.0 confermata sul servizio padre** | Il servizio dichiara la licenza nella descrizione; il layer ha invece copyright vuoto. Attribuire Comune/Direzione Educazione e documentare query e deduplicazione. |
| Pagine e allegati del sito `www.comune.milano.it` | **Riuso con attribuzione, salvo eccezioni** | Le note legali consentono distribuzione e riuso citando fonte e URL. La pagina letta non precisa la versione CC: non assegnare CC BY 4.0 a tutti gli allegati per analogia con CKAN. Verificare avvisi e diritti di terzi sul singolo documento. |
| Registri regionali Nidi, Micronidi, CPI e Nidi famiglia | **Nessuna licenza aperta specifica confermata** | Considerare l’art. 52 CAD e le condizioni applicabili ai singoli dati. L’efficacia delle riserve generali non è accertata qui: non ne ricaviamo un divieto automatico. Dati e attribuzioni mantenuti. |
| Geometrie `src/data/milan-boundary.json` | **Catena di licenza da completare** | Upstream MIT, ma il suo metadata rinvia a un vecchio dataset comunale non più verificabile in questa consultazione. Non attribuire alla copia storica la licenza di un dataset NIL moderno. |
| Testi, tariffari e materiali dei gestori | **Condizioni individuali non verificate** | Distinguere fatti, rielaborazioni originali e materiali di terzi. La verifica incompleta non esclude gli usi consentiti dalla legge; MIT del progetto non assegna diritti sui materiali altrui. |

Fonti primarie: [DS3014, API CKAN](https://dati.comune.milano.it/api/3/action/package_show?id=ds3014-infogeo-scuole-infanzia-localizzazione-2025-2026), [DS47, API CKAN](https://dati.comune.milano.it/api/3/action/package_show?id=ds47-istruzione-asili-nido-localizzazione-delle-strutture), [Geoschool, servizio ArcGIS](https://gisportal.comune.milano.it/federated/rest/services/D_Educazione/geoschool_data_web/MapServer?f=pjson), [MIM, politiche di riuso](https://dati.istruzione.it/opendata/progetto/), [Comune, note legali](https://www.comune.milano.it/policy/note-legali), [Regione, note legali](https://www.regione.lombardia.it/attivita-istituzionali/comunicazione-istituzionale/policy/note-legali).

## Condizioni confermate e aspetti ancora da precisare

### Registri regionali

Le note generali del portale contengono riserve sul riuso. Non è stata verificata una licenza specifica dei quattro PDF usati, né stabilito se e in quale misura quelle riserve possano limitare il riuso dei dati istituzionali ai sensi del CAD. La policy di un altro portale non viene estesa automaticamente a questi file.

Dei 431 record 0–3, 381 citano queste fonti. Manteniamo dati e provenienza senza presentarli come vietati o imporre una richiesta preventiva di autorizzazione non accertata. L’attribuzione è consultabile nella sezione “Fonti”. Eventuali approfondimenti dovranno riguardare la base normativa o le condizioni del singolo materiale, distinguendo dati istituzionali, dati personali e contenuti di terzi.

### Geometrie e metropolitana

Il [metadata upstream di Milano](https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/milan.metadata.json) indica come origine `http://dati.comune.milano.it/component/rd/item/61-61-nil-nuclei-didentita-locale.html`. Il vecchio indirizzo ha restituito 403. Il repository upstream ha [licenza MIT](https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/LICENSE), conservata anche localmente; non basta per ricostruire i diritti originari dei dati importati. Per chiudere il punto si può recuperare l’avviso della risorsa storica oppure sostituire le geometrie con una risorsa ufficiale dalla licenza verificata, registrando le differenze.

Lo schema metro in `src/lib/milan-map.ts` è descritto dal codice come semplificazione con riferimento al PDF ATM. Il PDF non è incluso e non è stata accertata una licenza aperta specifica dello schema: mantenere il riferimento non autorizza a redistribuire il PDF o ricalcarne la grafica. Prima di dichiarare riutilizzabili anche gli ancoraggi dello schema, documentarne la costruzione autonoma o usare coordinate da una fonte licenziata. Non trasferiamo al sito ATM principale le condizioni del suo distinto archivio storico.

### Scuole, gestori e fonti delle guide

L’inventario comprende anche INPS, USR, ATS, Milano Ristorazione, Uppa, enti e università. Per le pagine non verificate non viene concessa una licenza presunta. I riferimenti nelle guide sostengono spiegazioni originali; non autorizzano a includere articoli integrali, fotografie, loghi o PDF. La guida stilistica e quella al design restano escluse da Git come richiesto.

Un orario, una data o un prezzo possono essere fatti non protetti come singoli elementi; questo non elimina eventuali diritti sulla forma espressiva o sulla banca dati estratta. Cambiare alcune parole non sana un’estrazione sostanziale. Le [linee guida AgID](https://www.agid.gov.it/sites/agid/files/2024-05/lg-open-data_v.1.0_1.pdf) distinguono tutela della banca dati e dei suoi contenuti e trattano il principio di apertura per i dati pubblici. Non applichiamo tale principio automaticamente a dati personali, a materiale di terzi o in presenza di condizioni specifiche controverse.

## Servizi esterni e font

| Componente | Condizioni accertate | Impatto sul progetto |
| --- | --- | --- |
| OpenStreetMap | [ODbL e attribuzione](https://www.openstreetmap.org/copyright) | Conservare l’attribuzione. Se si distribuisce una banca dati derivata da OSM, valutarne gli obblighi ODbL; la sola visualizzazione di punti indipendenti sopra una mappa non trasferisce automaticamente ODbL a tutto il codice o al catalogo. |
| Server raster OSM | [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | Attribuzione visibile, Referer valido, cache conforme; niente scaricamenti massivi o prefetch offline. Il server non ha disponibilità garantita. |
| Photon | [Repository e condizioni del demo](https://github.com/komoot/photon#demo-server) | Software Apache-2.0; risultati basati su OSM distinti dal software. Il demo consente richieste ragionevoli e può limitare o bloccare l’uso; non è un servizio illimitato garantito. |
| OpenFreeMap | [Guida ufficiale](https://openfreemap.org/quick_start/) | Mostrare OpenFreeMap, OpenMapTiles e OpenStreetMap come previsto. Hosting, stile e dati hanno condizioni distinte. |
| Google Maps | [Termini aggiuntivi](https://www.google.com/intl/en_US/help/terms_maps/) | Collegamenti e incorporamenti restano soggetti ai termini Google; non presentare mappe o dati Google come contenuti MIT né estrarli in massa. |
| Bricolage Grotesque e DM Sans | **SIL OFL 1.1** nei due repository Google Fonts | Uso nei siti, incorporamento e redistribuzione consentiti rispettando OFL. I file sono ospitati localmente in `public/fonts/`, con copyright e testi OFL. Rispettare eventuali nomi riservati e non vendere i font da soli. |

Licenze font: [Bricolage Grotesque](https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt), [DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt). La verifica delle condizioni d’uso non è una verifica completa della privacy o della configurazione di rete in produzione.

## Attribuzione da accompagnare ai dati aperti verificati

Per DS3014, DS47 e Geoschool usare: “Fonte: Comune di Milano — Direzione Educazione / Unità Analytics e Open Data, [dataset e anno], CC BY 4.0. Dati selezionati, normalizzati e riconciliati da Scuole Vicine; modifiche e limiti descritti nelle schede e nei rapporti.” Aggiungere URL della risorsa e [licenza](https://creativecommons.org/licenses/by/4.0/).

Per MIM usare: “Fonte: Ministero dell’Istruzione e del Merito — Portale unico dei dati della scuola, anagrafi statali/paritarie 2026/27, IODL 2.0. Selezione Milano/F205, infanzia; normalizzazione e riconciliazione a cura di Scuole Vicine.” Aggiungere fonte e [licenza](https://www.dati.gov.it/iodl/2.0/).

Conservare attribuzioni, link, avvisi ed eventuali indicazioni di modifica anche nelle distribuzioni dei dati. MIT del software può convivere con queste condizioni; non sostituisce le licenze delle fonti. Non è stata applicata una licenza unica al catalogo misto.

## Indicazioni per il rilascio

1. Codice e documentazione originali: distribuibili sotto MIT, conservando le eccezioni per terzi.
2. Porzioni provenienti dalle fonti aperte verificate: riutilizzabili, anche commercialmente, con gli obblighi sopra descritti e la minimizzazione dei dati personali.
3. Catalogo mantenuto con attribuzioni e provenienza. Per gli aspetti non accertati documentare il risultato e la possibile base normativa di riuso; non trasformare la mancanza di una verifica in un divieto. MIT non viene estesa ai materiali di terzi e non è stata assegnata una licenza unica al catalogo misto.
4. Nessuna modifica ai dati del catalogo, richiesta di autorizzazione, invio di messaggi o pubblicazione è stata eseguita. La presentazione delle attribuzioni nel sito è stata resa più discreta. La preparazione di una copia con `prepare-github.py` controlla esclusioni e alcuni indicatori di segreti; non certifica le licenze.
