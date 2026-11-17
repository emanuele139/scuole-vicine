# Attribuzioni e componenti di terzi

La licenza MIT del progetto non sostituisce le licenze dei componenti o dei dati utilizzati.

## Librerie

| Componente diretto | Licenza dichiarata nel lockfile |
| --- | --- |
| Astro | MIT |
| Leaflet | BSD-2-Clause |
| MapLibre GL JS | BSD-3-Clause |
| MapLibre GL Leaflet | ISC |
| qrcode | MIT |
| pdf-lib | MIT |
| @pdf-lib/fontkit | MIT |

Le dipendenze e le versioni sono fissate in `package-lock.json`. [public/third-party-licenses.txt](public/third-party-licenses.txt) raccoglie i testi LICENSE/NOTICE presenti nei pacchetti di produzione installati e i riferimenti upstream. Alcuni pacchetti includono solo una dichiarazione di licenza: l’elenco lo segnala esplicitamente. Include strumenti di build non inviati al browser e dipendenze native della piattaforma su cui è stato generato; non è un inventario dei soli moduli effettivamente presenti nel bundle.

Per aggiornarlo dopo una modifica alle dipendenze:

```sh
npm ci
node scripts/dependency-notices.mjs
```

Le copie di Leaflet 1.9.4 in `public/vendor/leaflet/` mantengono gli avvisi originali e il testo BSD-2-Clause in [LICENSE](public/vendor/leaflet/LICENSE). Non rimuovere le intestazioni di copyright dai file vendorizzati.

## Cartografia e servizi esterni

- Dati OpenStreetMap: © [contributori OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL. Conservare le attribuzioni sulle mappe; il servizio di tile ha condizioni d’uso proprie.
- [OpenFreeMap](https://openfreemap.org/) e [OpenMapTiles](https://www.openmaptiles.org/): servizi e stili cartografici con attribuzioni nell’interfaccia. Le rispettive condizioni non sono sostituite da MIT.
- [Comune di Milano · DS634](https://dati.comune.milano.it/dataset/ds634-numeri-civici-coordinate): copia dei civici applicati del 1° ottobre 2026 in `public/dati/civici-milano.json`, **CC BY 4.0**. Elaborazione Scuole Vicine: esclusione dei record in attesa e degli accessi speciali; mantenuti nomi e alias delle vie, civici e coordinate. Fonte, licenza e hash dello ZIP sono inclusi nel JSON.
- [Photon](https://photon.komoot.io/): ricerca di indirizzi basata su OpenStreetMap. Riceve il testo per i suggerimenti senza civico e quando il civico non viene trovato nei dati comunali locali.
- Google Maps: solo collegamenti esterni per indirizzi e percorsi; nessun incorporamento automatico. Non sono dati rilasciati dal progetto sotto MIT.
- Google Fonts: Bricolage Grotesque e DM Sans sono entrambi **SIL OFL 1.1**, come verificato nei file [Bricolage](https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt) e [DM Sans](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt). I file font sono ospitati localmente in `public/fonts/`, insieme ai testi integrali di copyright e OFL (`bricolage-grotesque-OFL.txt` e `dm-sans-OFL.txt`). Nessuna richiesta a Google Fonts dal browser. La licenza dei font non è MIT.

## Geometria locale e schema della metropolitana

`src/data/milan-boundary.json` deriva dalle geometrie dei quartieri del progetto [Click That ’Hood](https://github.com/codeforgermany/click_that_hood/blob/main/public/data/milan.geojson). Il [metadata upstream](https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/milan.metadata.json) rinvia a una vecchia risorsa comunale non verificabile in questa consultazione. La MIT upstream, copyright © 2013–2021 Code for America, è conservata in [docs/CLICK_THAT_HOOD_LICENSE.txt](docs/CLICK_THAT_HOOD_LICENSE.txt); la licenza della geometria originaria resta da documentare. Non la attribuiamo per analogia al dataset NIL moderno.

Lo schema metro in `src/lib/milan-map.ts` riporta il [PDF ATM](https://www.atm.it/it/AltriServizi/Trasporto/Documents/schema_rete_metro.pdf) come riferimento. Il PDF non è incluso e non è stata confermata una sua licenza aperta. La costruzione autonoma dei punti semplificati deve essere documentata prima di dichiararli riutilizzabili senza riserve. Il [rapporto](docs/SOURCE-LICENSE-AUDIT.md) descrive le azioni per chiudere questi punti.

## Dati sulle scuole

Il catalogo dei comuni confinanti usa anagrafi MIM 2026/27, registri regionali delle unità di offerta sociali al 31 ottobre 2026 e fonti geografiche riferite nelle singole schede. Le coordinate possono provenire da Scuola in Chiaro, Comuni, istituti, gestori o directory e mappe territoriali, tra cui CommonGround/NordMilanoEducA, Assonidi, DaPiccoli, Cylex e Waze. Questi editori restano distinti: una directory non viene presentata come fonte ufficiale del Comune. Le fonti, i periodi conosciuti, le correzioni degli indirizzi e i limiti sono conservati nei dati e mostrati nel sito. Non è stata accertata una licenza aperta per tutte queste fonti; la licenza MIT del software non viene estesa ai relativi materiali o banche dati.

La verifica del 17 novembre 2026 conferma CC BY 4.0 per DS3014, DS47 e Geoschool e IODL 2.0 per i dataset MIM. Per altre fonti si distinguono licenze esplicite, basi normative di riuso e aspetti non verificati: questi ultimi non costituiscono un divieto accertato. [docs/SOURCE-LICENSE-AUDIT.md](docs/SOURCE-LICENSE-AUDIT.md) riporta condizioni, evidenze e formule di attribuzione; [docs/DATA.md](docs/DATA.md) descrive gli anni e il metodo. L’attribuzione non implica patrocinio né sostituisce una licenza mancante.

Per i servizi esterni, conservare le attribuzioni e rispettare le condizioni del provider: [tile OSM](https://operations.osmfoundation.org/policies/tiles/), [Photon demo](https://github.com/komoot/photon#demo-server), [OpenFreeMap](https://openfreemap.org/quick_start/), [Google Maps](https://www.google.com/intl/en_US/help/terms_maps/). Una licenza sui dati non garantisce accesso illimitato ai server.
