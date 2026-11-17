# Scuole Vicine

Un progetto indipendente e gratuito per cercare nidi e scuole dell’infanzia a Milano, confrontare le informazioni e preparare le visite. Ideato e sviluppato da [Emanuele Cardinali](https://cardinali.studio/).

Il dominio previsto è **scuolevicine.it**. Il codice, il catalogo e la documentazione sono disponibili nel repository pubblico [emanuele139/scuole-vicine](https://github.com/emanuele139/scuole-vicine). Il sito non è ancora pubblicato online.

## Che cosa puoi fare

- Cercare servizi 0–3 e scuole dell’infanzia 3–6, con elenco, filtri e mappa.
- Confrontare fino a tre scuole e consultare fonti, periodo e informazioni mancanti.
- Trovare gli open day con date documentate ed esportarli nel calendario.
- Salvare scuole e appunti nel browser, con esportazione e importazione.
- Provare uno spazio condiviso opzionale, cifrato nel browser, con un Worker Cloudflare e un database D1 locali.

Il catalogo non certifica la qualità delle scuole, i posti disponibili o le condizioni per anni successivi. Per una decisione, conferma con la scuola i dati dell’anno che ti interessa.

## Avvio locale

Servono Node.js **22.23.4 o successivo**, npm e, per i test della ricerca, Python **3.10 o successivo**. Per la CI viene usato Node.js 24.

```sh
npm ci
npm run dev
```

Apri l’indirizzo stampato da Astro. L’anteprima Astro offre le funzioni locali, ma non l’API dello spazio condiviso.

```sh
npm run check
npm run shared:check
npm test
npm run test:research
npm run test:nurseries
npm run build
npm run seo:audit
npm run preview
```

Build e test non richiedono gli archivi personali o le guide locali escluse da Git. `private: true` in `package.json` impedisce pubblicazioni npm accidentali; non limita i diritti concessi dalla licenza MIT.

### Spazio famiglia condiviso, facoltativo

```sh
npm run shared:db
npm run shared:dev
```

Apri `http://127.0.0.1:4320/famiglia/`. L’ID D1 in `wrangler.jsonc` è un segnaposto per lo sviluppo locale. Nessun servizio cloud viene creato da questi comandi. Formato, cifratura e limiti sono descritti in [README-SHARED.md](README-SHARED.md).

## Struttura

| Percorso | Contenuto |
| --- | --- |
| `src/pages/` | Ricerca, schede, confronto, guide, agenda, metodo e pagina Il progetto |
| `src/data/` | Catalogo, rapporti e configurazione dei collegamenti pubblici |
| `src/lib/`, `src/scripts/` | Ricerca, calendario, stato famiglia e sincronizzazione |
| `src/components/`, `src/styles/` | Componenti e identità visiva |
| `public/dati/` | Rapporti scaricabili con fonti e limiti |
| `worker/`, `migrations/` | API dello spazio condiviso e schema D1 |
| `scripts/` | Elaborazione del catalogo e preparazione della copia per GitHub |
| `tests/` | Test TypeScript e Python |

## Dati, licenze e verificabilità

La [licenza MIT](LICENSE) copre il codice e la documentazione originali del progetto, salvo le eccezioni indicate in [LICENSES.md](LICENSES.md). Il catalogo unisce informazioni di fonti diverse: MIT **non riassegna i diritti sui dati e sui materiali di terzi**. Consulta [fonti e metodo](docs/DATA.md) e [attribuzioni](THIRD_PARTY_NOTICES.md) prima di redistribuire i dati.

Le schede e i rapporti inclusi permettono di controllare fonti, anni, corrispondenze e limiti. Gli archivi grezzi di ricerca non sono inclusi: la ricostruzione completa da tutte le fonti non è disponibile con il solo clone pubblico. Gli script rimangono consultabili e i requisiti degli input sono documentati in [docs/DATA.md](docs/DATA.md).

Le guide al design e alla scrittura, le schermate, il vecchio sito familiare, i database e le esportazioni private restano sul disco del manutentore e sono esclusi da Git. Non sono necessari per compilare il sito pubblico.

## Esito della verifica delle licenze

Il [rapporto del 17 novembre 2026](docs/SOURCE-LICENSE-AUDIT.md) conferma CC BY 4.0 per DS3014, DS47 e Geoschool e IODL 2.0 per i dataset MIM. Per altre fonti le condizioni restano da precisare, considerando anche il principio di apertura dei dati pubblici: la mancata verifica di una licenza non equivale a un divieto. I dati vengono mantenuti con la provenienza e le attribuzioni nella sezione “Fonti”. La MIT riguarda il software originale; preparare una copia locale non certifica i diritti su tutti i dati inclusi.

## Un credito al progetto

Il codice originale è rilasciato sotto licenza MIT, con `Copyright (c) 2026 Emanuele Cardinali`.

Se riutilizzi il progetto, è gradito un credito visibile a [Emanuele Cardinali](https://cardinali.studio/), con un collegamento al [repository originale](https://github.com/emanuele139/scuole-vicine). Puoi inserirlo nel footer o nella pagina dedicata al tuo progetto.

Il credito visibile è una richiesta facoltativa, non una condizione aggiuntiva alla MIT. Restano gli obblighi di conservazione dell’avviso di copyright e della licenza previsti dal suo testo.

## Contribuire

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per proporre correzioni e modifiche al codice. Non inserire dati di famiglie o link segreti nelle segnalazioni. Per vulnerabilità, segui [SECURITY.md](SECURITY.md).

## Preparazione del rilascio

Il [rapporto di pubblicazione](docs/GITHUB-RELEASE.md) riassume il contenuto incluso e le verifiche effettuate. La pubblicazione del repository non equivale al lancio del sito.

[docs/RELEASING.md](docs/RELEASING.md) descrive i controlli e la preparazione locale. Nessun comando di preparazione pubblica il progetto o esegue un deploy. I collegamenti dell’autore e del futuro repository si configurano in `src/data/project.ts`.

## SEO e GEO

Canonical, anteprime social, breadcrumb, identità e dati strutturati derivano da `src/lib/seo.ts` e dai cataloghi. Le raccolte per fascia d’età e Municipio permettono di consultare le schede anche senza JavaScript. Sono disponibili 25 versioni Markdown delle pagine informative, generate dallo stesso HTML e scaricabili dal fondo della pagina. Per esempio: `/index.md`, `/metodo.md`, `/progetto.md`, `/guide/costi-e-isee.md`. Le singole schede scuola restano in HTML. Le raccolte sono nella home sotto “Esplora per età e Municipio”, prima dei risultati, e nel footer.

`seo.config.mjs` imposta `https://scuolevicine.it` come origine canonica. Le build normali restano escluse dai motori; la futura build di produzione richiede `SEO_INDEXABLE=true`. Sitemap, robots, indice `llms.txt` e intestazioni HTTP seguono la stessa impostazione. Non distribuire una build di produzione su un’anteprima pubblica.

```sh
# Collaudo locale della variante di produzione, senza pubblicare
SEO_INDEXABLE=true npm run build -- --outDir /tmp/scuole-vicine-seo-production
python3 scripts/audit-seo.py --mode production --directory /tmp/scuole-vicine-seo-production
```

Strategia, scelte editoriali, verifiche, limiti e piano di lancio sono in [docs/SEO-GEO.md](docs/SEO-GEO.md). La CI collauda entrambe le modalità senza effettuare deploy.
