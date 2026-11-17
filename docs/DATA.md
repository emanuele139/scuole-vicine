# Dati, fonti e ricostruzione

Il catalogo distingue servizi 0–3 e scuole dell’infanzia 3–6. Una scheda identifica un servizio, non sempre un edificio unico. Le informazioni conservano il periodo della fonte e gli esiti delle ricerche: un campo controllato può restare non pubblicato o da confermare.

## Fonti principali

| Fonte | Uso e periodo | Licenza e attribuzione |
| --- | --- | --- |
| [Comune di Milano, DS3014](https://dati.comune.milano.it/dataset/ds3014-infogeo-scuole-infanzia-localizzazione-2025-2026) | Identità e posizioni delle scuole 3–6, 2025/26 | Comune di Milano, **CC BY 4.0**, confermata nei metadati delle risorse |
| [MIM, anagrafe statali](https://dati.istruzione.it/opendata/opendata/catalog/SCUANAGRAFESTAT) e [paritarie](https://dati.istruzione.it/opendata/opendata/catalog/SCUANAGRAFEPAR) | Identità delle scuole, 1 settembre 2026; filtro Milano/F205 e infanzia | Ministero dell’Istruzione e del Merito, **IODL 2.0**, confermata dalla policy del portale |
| [Regione Lombardia, strutture sociali](https://www.regione.lombardia.it/politiche-sociali-e-abitative/strutture-sociali-per-minori,-disabili-e-anziani) | Registri 0–3 al 31 ottobre 2026 | Licenza specifica non confermata; valutare il riuso anche ai sensi dell’art. 52 CAD. Nessun divieto sul singolo dato accertato |
| [Comune, iscrizioni 0–3](https://www.comune.milano.it/servizi/scuola/nidi-d-infanzia-e-sezioni-primavera) | Allegati dell’offerta comunale 2026/27 | Permesso generale comunale con fonte e URL, salvo avvisi specifici e diritti di terzi; versione CC non precisata |
| [Geoschool](https://www.comune.milano.it/servizi/scuola/geoschool-trova-nidi-e-scuole-dell-infanzia) | Posizioni 2026/27 per i servizi 0–3 | Comune di Milano, **CC BY 4.0**, dichiarata sul servizio ArcGIS padre |
| [Comune, DS47](https://dati.comune.milano.it/dataset/ds47-istruzione-asili-nido-localizzazione-delle-strutture) | Coordinate e geografia storiche, 2018/19, con civico e indirizzo esatti | Comune di Milano, **CC BY 4.0**, confermata nuovamente nei metadati delle risorse |
| [Comune di Milano, DS634](https://dati.comune.milano.it/dataset/ds634-numeri-civici-coordinate) | Ricerca locale dei civici, snapshot 1° ottobre 2026 | Comune di Milano, **CC BY 4.0**, dichiarata sulla risorsa; elaborazione Scuole Vicine |
| Siti ufficiali delle scuole e dei gestori | Orari, costi, servizi, appuntamenti con anno per campo | Diritti delle singole fonti; nessuna licenza generale presunta |

Verifica delle licenze: **17 novembre 2026**. Il [rapporto completo](SOURCE-LICENSE-AUDIT.md) distingue licenze esplicite, principio di apertura dei dati pubblici e aspetti non accertati. Una verifica incompleta non costituisce un divieto di riuso. I dati vengono mantenuti con fonte, periodo e trasformazioni; le attribuzioni del sito sono raccolte nei riquadri “Fonti”, consultabili senza appesantire la lettura. Non viene applicata MIT indistintamente a tutte le fonti.

Le schede in `src/data/schools.json` e `src/data/nurseries.json` conservano fonti, anni, avvertenze ed esiti. I rapporti in `public/dati/` documentano copertura, conflitti e corrispondenze. Il sito li presenta nella pagina `/metodo/`.

## Criteri di raccolta

Usare solo pagine e documenti intenzionalmente pubblici. Un documento raggiungibile per errore, un’area riservata o un link personale non è una fonte ammessa. Non aggirare controlli d’accesso e non cercare varianti di URL privati.

Separare gestione, riconoscimento, proposta educativa e modalità d’accesso. Non dedurre posti liberi dalla capienza, chiusure dall’assenza in un registro o probabilità di ammissione dalla distanza. I conflitti di indirizzo richiedono una verifica e possono sospendere le coordinate.

I contatti pubblici delle scuole sono distinti dai dati delle famiglie. Nel controllo prima di GitHub sono stati omessi due indirizzi email nominativi; gli importatori mantengono questa esclusione anche ricostruendo gli input locali. Restano i recapiti generici delle scuole e i collegamenti alle loro pagine ufficiali. Nei cataloghi 0–3 le email sono omesse; per i nidi famiglia sono omessi telefono e gestore. Gli indirizzi operativi rimangono quelli pubblicati per identificare il servizio. Gli archivi grezzi possono contenere ulteriori dati e sono esclusi da Git.

## Che cosa si può riprodurre dal repository

Con i file inclusi si possono eseguire l’applicazione, tutti i test e la build, ispezionare gli algoritmi e controllare le informazioni confrontandole con i collegamenti alle fonti. Le fonti remote possono cambiare o non essere più disponibili.

La ricostruzione integrale del catalogo richiede gli snapshot e le ricerche strutturate in `research/`, esclusi dal repository. Non viene promessa la riproduzione completa dal solo clone. Questa scelta evita di distribuire in blocco dati grezzi e copie di documenti senza una verifica individuale dei diritti. Per una futura distribuzione aperta anche degli input serviranno un insieme minimizzato, una licenza per fonte e un manifesto degli hash.

| Comando | Input locali necessari |
| --- | --- |
| `npm run catalog:reconcile` | `research/snapshots/municipal-schools-2025-2026.json`, `curated-schools-2026-11-15.json`, CSV MIM statali e paritarie 2026/27; ricerche di dettaglio se presenti |
| `npm run catalog:research` | `research/deepening/catalog-before.json`, `assignment-manifest.json` e un JSON per ciascun gruppo del manifesto |
| `npm run catalog:second-pass-report` | Base e gruppi di `research/deepening/`; `second-pass/targets.json`, `catalog-before.json`, `municipal-network-audit.json` e audit per gruppo |
| `npm run catalog:nurseries` | `research/nurseries/`: `pdf-urls.json`, `regional-milano-rows.json`, `municipal-2026-2027-rows.json`, `ds47-nidi-2016-2019.json`, `coordinates-geoschool-2026-27.json` e ricerche di dettaglio |
| `npm run catalog:nurseries-research` | `research/nurseries/deepening/catalog-before.json`, manifesto e JSON dei gruppi |

Questi comandi scrivono gli output del catalogo: eseguirli soltanto con gli input completi e una copia di lavoro salvata. I due script di importazione non scoprono automaticamente nuove annualità. `reconcile-catalog.py --download --as-of YYYY-MM-DD` riscarica i CSV MIM esplicitamente configurati, non ricrea tutti gli altri input mancanti.

## Ricerca locale dei civici

`public/dati/civici-milano.json` contiene 52.156 civici applicati su 3.965 vie, ricavati dal CSV comunale con `python3 scripts/import-civic-addresses.py`. Il comando scarica lo snapshot configurato; `--input ZIP` consente la ricostruzione da una copia locale. Metadati, URL, licenza e hash dello ZIP sono nel JSON. Sono esclusi civici non applicati, numeri non validi e accessi speciali indicati da BARRA2. Non sono inclusi residenti, contatti, dati immobiliari o associazioni fra indirizzi e utenti. Dettagli e limiti in [Ricerca dei civici](CIVIC-ADDRESS-SEARCH.md).
