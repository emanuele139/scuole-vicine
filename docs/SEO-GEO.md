# SEO e GEO di Scuole Vicine

Preparazione del 17 novembre 2026. Dominio confermato dal proprietario: **https://scuolevicine.it**. Implementazione e collaudo locali; questo lavoro non costituisce un deploy né dimostra indicizzazione o citazioni nelle risposte AI.

## Obiettivo e contesto

Scuole Vicine è un progetto indipendente e gratuito di Emanuele Cardinali per le famiglie che cercano nidi, servizi 0–3 e scuole dell’infanzia 3–6 nel Comune di Milano. Il risultato utile è trovare servizi pertinenti, leggere le evidenze, confrontare le condizioni, preparare una visita e consultare la fonte ufficiale. Non è un servizio degli enti citati, un sistema di iscrizione o una classifica di qualità.

La preparazione applica il metodo della guida SEO-GEO del proprietario: intenti, architettura, contenuti verificabili, implementazione, collaudo e misurazione. La priorità è rendere utili e comprensibili i dati esistenti, evitando pagine territoriali prive di contenuti, disponibilità inventate o promesse di ranking.

Le schede rappresentano servizi: più schede possono condividere lo stesso edificio. La presenza nei cataloghi non certifica operatività attuale, posti liberi, riconoscimento, qualità o probabilità di ammissione. Le schede storiche con chiusura documentata restano consultabili con uno stato esplicito.

## Domanda e destinazioni

La mappa deriva dai bisogni già coperti dalle guide e dalle funzioni del sito. Non sono disponibili dati proprietari di Search Console, volumi di ricerca o conversioni: le priorità non sono stime quantitative.

| Bisogno / query rappresentativa | Destinazione | Azione utile |
| --- | --- | --- |
| Nidi e scuole dell’infanzia Milano, scuole vicino a un indirizzo | `/` | Ricerca per indirizzo, filtri e mappa |
| Nidi Milano, micronidi, nidi famiglia, sezioni primavera | `/nidi/` | Elenco HTML dei servizi 0–3, tipologie e modalità d’accesso |
| Scuole dell’infanzia Milano, comunali, statali e private | `/scuole-infanzia/` | Elenco HTML 3–6 e collegamenti alle procedure |
| Nidi e scuole nel Municipio di interesse | `/municipi/1/` … `/municipi/9/` | Raccolta locale effettiva, composizione, indirizzi e schede |
| Nome della scuola + indirizzo / orari / costi | `/scuole/{slug}/` | Scheda della singola identità con fonti, anno e condizioni |
| Differenze, costi, ISEE, ambientamento, domande per la visita | `/guide/` e le sette guide | Risposte documentate e fonti vicine al testo |
| Iscrizioni nidi / infanzia Milano | `/iscrizioni/` | Distinguere procedure e anni prima di rivolgersi all’ente o alla scuola |
| Open day nidi e infanzia Milano | `/agenda/` | Appuntamenti documentati, fonte e prenotazione |
| Provenienza dei dati e affidabilità del servizio | `/metodo/`, `/progetto/` | Verificare metodo, autore, copertura e limiti |
| Selezione personale e confronto | `/famiglia/`, `/confronto/` | Uso dello strumento, escluso dall’indice |

Campione esplorativo di ricerca del 17 novembre 2026, query in italiano: “nidi Milano costi iscrizioni”, “scuola infanzia Milano scegliere comunale statale paritaria”, “nidi scuole infanzia Milano municipio 7”. I risultati comprendono servizi ufficiali, documenti annuali e cataloghi. L’organizzazione per età, indirizzo e Municipio risponde anche alla struttura di [Geoschool](https://www.comune.milano.it/servizi/scuola/geoschool-trova-nidi-e-scuole-dell-infanzia). Le informazioni su funzionamento e iscrizioni sono raccolte nella [brochure comunale 2026/27](https://www.comune.milano.it/documents/20118/5594857/BrochureEducazione_2026.pdf/29922f5f-fde5-cb8d-5466-fc07e8adfe35?download=true&t=1769507992973&version=1.0). Questo campione orienta l’architettura; non misura posizioni universali, volumi o aggiornamento integrale dei fatti già presenti nel sito.

## Architettura e accessibilità alla scansione

- Conservate tutte le URL e gli identificativi delle 735 schede: nessuna migrazione delle identità del catalogo.
- Aggiunte due raccolte per fascia d’età e nove per Municipio, con elenchi HTML completi e statistiche derivate dagli stessi dati delle schede. Nessuna attribuzione territoriale ricavata artificialmente da un nome o da coordinate incerte.
- Le raccolte municipali comprendono soltanto le schede con quel Municipio nel catalogo; quelle senza Municipio verificato restano nelle raccolte per età e nella ricerca cittadina. Le avvertenze sulle indicazioni storiche restano nelle schede e nel metodo.
- Home → raccolte → schede → guide e fonti; schede → raccolta per età e Municipio; guide → catalogo e ricerca. Footer e breadcrumb forniscono ulteriori percorsi HTML.
- I filtri interattivi non generano nuove landing indicizzabili. Le varianti con parametri hanno il canonical della pagina senza parametri; confronto e spazio famiglia sono sempre `noindex`.
- Le raccolte e il catalogo completo in `/metodo/#catalogo` funzionano senza JavaScript; non si affida la scoperta delle schede alle sole card nascoste o ai template dell’esploratore.
- La pagina errore ha un vero stato 404 e collegamenti per proseguire. Il Worker usa `force-trailing-slash` e `404-page` per allineare il comportamento HTTP alle URL di Astro.

Le raccolte locali aggiungono un servizio concreto: una selezione effettiva di strutture e una composizione differente per territorio. Non vengono create combinazioni di ogni quartiere, anno, filtro e keyword.

## Fonte unica e metadati

`seo.config.mjs` definisce origine canonica e modalità di pubblicazione. `src/lib/seo.ts` contiene l’inventario delle pagine pubbliche e deriva schede, raccolte, descrizioni e relazioni dai cataloghi e dalle guide. `SeoHead.astro` genera title, description, canonical, robots, Open Graph, Twitter Card e JSON-LD. I contenuti delle schede restano nei cataloghi esistenti.

Ogni pagina editoriale ha titolo e descrizione autonomi. Per le sedi omonime, il titolo include l’indirizzo; i due registri Maison Bloom allo stesso indirizzo sono distinti tramite CUDES. La distinzione non è una riconciliazione: non si presume che siano due sedi fisiche diverse né si fondono i record. Il codice CUDES è consultabile tra le fonti della scheda.

L’immagine social comune originale è `public/social/scuole-vicine.png`, 1200 × 630 pixel, con sorgente SVG modificabile nella stessa cartella. Non rappresenta fotografie o caratteristiche delle scuole. Ogni pagina ha URL social, titolo, descrizione e testo alternativo; non vengono inventati account social.

Non si usano meta keywords, hreflang per lingue inesistenti o date di aggiornamento ricavate dalla build. La sitemap non emette `lastmod` finché manca una data editoriale sostanziale affidabile per ogni tipo di pagina.

## Dati strutturati e GEO

Il grafo JSON-LD ha identificatori assoluti stabili, serializzazione protetta contro la chiusura del tag script e relazioni coerenti con le pagine:

| Entità | Uso e limiti |
| --- | --- |
| `Person` | Emanuele Cardinali, con collegamento alla pagina autore e al profilo pubblico già presente |
| `WebSite` | Identità di Scuole Vicine e relazione con il responsabile; nessuna scuola è presentata come sede del progetto |
| `WebPage`, `CollectionPage`, `AboutPage` | Tipo e ruolo delle pagine |
| `BreadcrumbList` | Stesso percorso visibile nell’HTML |
| `Article` | Guide con autore visibile, lingua, argomento e documenti citati; nessuna data editoriale inventata |
| `Preschool` | Scuole dell’infanzia 3–6 descritte dalle schede |
| `EducationalOrganization` | Servizi 0–3 senza attribuire indiscriminatamente a tutti il tipo scuola dell’infanzia |
| `ItemList` | Membri effettivi delle raccolte e delle guide, URL e conteggi coerenti con l’HTML |

Le schede di strutture chiuse hanno una descrizione storica esplicita e non dichiarano un indirizzo come sede attiva. Per le schede da rivedere non si aggiunge un indirizzo strutturato. Non vengono inseriti prezzi, orari normalizzati, capienze come posti liberi, recensioni, rating o offerte. Non si promuovono gli appuntamenti a `Event` senza un lavoro specifico su luogo, organizzatore, pagina dell’evento e gestione temporale. Non si confonde una pagina del catalogo con il sito ufficiale della scuola.

Le fonti sono collegate nell’HTML e nelle citazioni strutturate. Le guide distinguono verifica, periodo di validità e aspetti da riconfermare. Il controllo dell’identità non aggiorna implicitamente tutti i dettagli. Le sintesi e gli elenchi sono contenuto consultabile, non testo aggiunto soltanto per i crawler.

`/llms.txt` è un indice sintetico curato delle pagine principali e delle raccolte, generato dallo stesso inventario. Spiega indipendenza, periodi dei dati, limiti e percorso verso le fonti. Le pagine pubbliche lo dichiarano con `rel="describedby"`. Le singole scuole restano in HTML completo: **non vengono creati file Markdown per scuola**. Su richiesta del proprietario sono invece disponibili **25 versioni Markdown delle pagine informative**: home, indice e sette guide, iscrizioni, agenda, dati e fonti, progetto, privacy e undici raccolte.

I Markdown sono derivati dall’HTML della stessa build con `integrations/markdown.mjs`, senza mantenere una seconda copia editoriale. Conservano testi, tabelle, fonti espandibili e limiti; dalla home sono esclusi i controlli interattivi e le card del catalogo. La convenzione è `/` → `/index.md`, `/metodo/` → `/metodo.md`, `/guide/{slug}/` → `/guide/{slug}.md`. Sono presenti `rel="alternate"`, un collegamento di download in fondo alla pagina e link HTML/Markdown nell’indice GEO. Le risposte hanno MIME `text/markdown`, `nosniff`, canonical HTTP verso l’HTML e `noindex, follow`. Il formato viene servito anche dal middleware della preview Astro, non soltanto dalla build statica.

Le raccolte sono ora evidenziate nella home **subito prima dei risultati**, sotto il titolo “Esplora per età e Municipio”, e nel footer. Il collegamento “Esplora per Municipio” nel footer porta alla sezione della home; i link per età aprono direttamente le raccolte. L’indice non duplica l’intero catalogo e non è necessario al funzionamento della ricerca.

Le [indicazioni Google per le funzioni AI](https://developers.google.com/search/docs/appearance/ai-features) richiedono di curare accessibilità, contenuti utili e coerenza dei dati strutturati. `llms.txt` e schema non costituiscono una garanzia di indicizzazione o citazione. I tipi sono scelti dal [vocabolario Schema.org](https://schema.org/Preschool); il parsing locale non equivale alla validazione esterna di ogni funzione arricchita.

## Pubblicazione, crawler e ambienti

| Modalità | Meta robots | Sitemap e indice AI | Header |
| --- | --- | --- | --- |
| Build normale / anteprima | `noindex` | Sitemap vuota; robots esclude la scansione; indice AI di anteprima | `_headers` esclude tutte le risorse dall’indicizzazione |
| Build con `SEO_INDEXABLE=true` | Pagine dell’inventario `index, follow, max-image-preview:large` | Sitemap delle sole pagine editoriali; robots aperto con URL sitemap; indice AI curato | Nessun noindex globale |
| Famiglia, confronto, design, errore e API | Esclusione permanente pertinente al formato | Assenti dalla sitemap e dall’indice AI | `X-Robots-Tag` sui percorsi esclusi; API e 404 gestite anche dal Worker |

Le pagine sconosciute all’inventario restano `noindex` per impostazione predefinita. Aggiungere una nuova pagina editoriale all’inventario per abilitarla e includerla nella sitemap. I rapporti JSON e `llms.txt` hanno un header `noindex, follow`; le risorse HTML principali restano complete e recuperabili. Alcuni consumatori possono ignorare risorse `noindex`: l’indice AI è soltanto un ausilio facoltativo.

La modalità di produzione lascia aperto il gruppo `User-agent: *`, salvo `/api/`. Non aggiunge restrizioni selettive di training né elenchi di bot non verificati. Una futura preferenza del titolare sul training va tradotta nelle regole documentate dai rispettivi operatori e controllata anche in CDN. Il file robots non autentica utenti, non protegge appunti e non garantisce accesso effettivo attraverso eventuali challenge.

I canonical rimandano al dominio definitivo anche nell’anteprima, ma non annullano il suo `noindex`. Non distribuire la build indicizzabile su un host QA. I dati personali della famiglia non entrano in schema, sitemap o indice AI. Le protezioni dello spazio condiviso restano quelle del protocollo e del Worker.

### Comandi

```sh
npm run check
npm run shared:check
npm test
npm run build
npm run seo:audit

# Collaudo della variante pubblica in una cartella separata, senza deploy
SEO_INDEXABLE=true npm run build -- --outDir /tmp/scuole-vicine-seo-production
python3 scripts/audit-seo.py --mode production --directory /tmp/scuole-vicine-seo-production

# Facoltativo: aggiungere GET e HEAD contro il Worker locale già avviato
python3 scripts/audit-seo.py --mode production --directory /tmp/scuole-vicine-seo-production --base-url http://127.0.0.1:4330
```

Le variabili sono impostazioni del processo di build; non occorre modificare sorgenti o sostituire stringhe nel risultato. L’eventuale `SITE_URL` alternativo deve essere un’origine HTTPS pubblica valida. `.env.example` documenta i valori; negli ambienti CI/hosting impostarli come variabili della build. Le verifiche della CI coprono entrambe le modalità e non pubblicano.

## Esiti e limiti del collaudo

Nel collaudo completo: 760 pagine editoriali pubblicabili, di cui 735 schede, sette guide e undici nuove raccolte. Il totale HTML locale comprende anche errore, confronto, famiglia e la guida al design locale, esclusa dalla distribuzione pubblica. Il numero di pagine non è una promessa di indicizzazione.

L’audit controlla tutte le pagine HTML operative: un H1, lingua, metadati, canonical, social, unicità di title e description, parsing e identificatori JSON-LD, destinazioni delle raccolte e dei breadcrumb, link interni e ancore, coerenza della sitemap, robots, indice AI, intestazioni generate e dimensioni effettive della PNG. Ignora la guida al design locale, che ha una shell autonoma. Le pagine non editoriali non devono entrare nella sitemap.

Entrambe le modalità hanno superato l’audit senza errori. Test applicativi dopo l’aggiunta dei Markdown: 56 passati. Astro: zero errori e warning nell’ultimo passaggio; un hint riguarda un’importazione non utilizzata nel modulo privacy, aggiunto parallelamente. Anche TypeScript Worker ha superato il controllo senza errori.

Rapporti riproducibili: [audit anteprima](seo-audit-preview.json) e [audit produzione con HTTP](seo-audit-production.json). La copia pubblica filtrata ha inoltre superato build e audit senza dipendere dalla guida locale al design.

Nel Worker locale, GET e HEAD hanno verificato contenuti HTML 200, immagine social 200, sitemap XML, robots e indice AI, `noindex` sulle pagine personali e API, e una vera risposta 404 con pagina di errore. Il test HTTP ha individuato e corretto la precedente risposta 404 vuota: è stata attivata la pagina di errore di Cloudflare Assets.

Browser sulla preview Regia: home desktop; raccolta Municipio 7 a 390 px; raccolta nidi a 390 e 320 px; scheda Maison Bloom a 320 px. Nessun overflow orizzontale nei controlli eseguiti; verificati titoli, canonical e numero dei link nelle raccolte. Le dimensioni sono emulazioni del browser, non dispositivi fisici. Non è un nuovo collaudo di tutti i flussi personali.

La home conserva un HTML ampio per il catalogo e le funzioni interattive: circa 4 MB non compressi nel campione, circa 205 kB con gzip locale. Le raccolte offrono accessi HTML più leggeri (circa 170 kB per l’intera raccolta 0–3). Questi valori sono una fotografia, non Core Web Vitals: compressione, TTFB, LCP, INP e CLS vanno misurati sull’hosting definitivo e con dati reali. I template delle card non sostituiscono i percorsi HTML di scoperta.

Al momento di questo primo collaudo non erano stati verificati sul dominio definitivo DNS/TLS, host alternativi, redirect www/HTTPS, CDN/WAF, crawler autenticati, indicizzazione, Rich Results Test pubblico, PageSpeed sul dominio, proprietà Search Console/Bing e citazioni AI. L’intervento SEO iniziale non aveva inviato sitemap a servizi esterni né attivato tracciamenti.

Aggiornamento del 17 novembre 2026: dominio HTTPS e redirect funzionanti, [controllo del sito online](ONLINE-QA.md) completato e [Search Console configurata](SEARCH-CONSOLE.md). Proprietà Dominio verificata via DNS, sitemap letta con successo (760 URL), test in tempo reale superati per home, raccolta nidi e una scheda scuola, richiesta di indicizzazione della home accettata. L’indicizzazione effettiva resta da attendere e controllare. Bing, PageSpeed pubblico e citazioni AI non sono stati configurati o verificati da questo aggiornamento; privacy e Umami sono documentati separatamente.

## Passaggio al dominio e misurazione

| Momento | Azione | Responsabilità / evidenza |
| --- | --- | --- |
| Prima del deploy | Preparare la copia pubblica, verificare l’esclusione di `/design/`, materiali personali e credenziali | Manutentore, procedura in `RELEASING.md` |
| Prima del deploy | Configurare HTTPS e redirect permanente diretto da www e HTTP a `https://scuolevicine.it`, senza catene | Gestore hosting, risposte GET/HEAD sul dominio |
| Build di produzione | Impostare `SEO_INDEXABLE=true`, collaudare output e assenza di blocchi globali | Manutentore, audit automatico; conservare il risultato come evidenza della release |
| Dopo il deploy | Ripetere il controllo HTTP sul dominio, inclusi asset, 404, canonical, sitemap e header | Manutentore, `--base-url https://scuolevicine.it` |
| Dopo il deploy | Controllare schema rappresentativo con Schema.org Validator e Rich Results Test | Manutentore, distinguere vocabolario valido e risultati supportati |
| Dopo il deploy | Verificare proprietà Search Console e Bing Webmaster Tools, inviare sitemap, ispezionare home, raccolte e schede rappresentative | Titolare degli account; l’invio non prova indicizzazione |
| Prime settimane con dati sufficienti | Baseline per brand/non brand, query, impression, clic, canonical selezionati e pagine escluse | Responsabile del progetto; nessun obiettivo numerico senza baseline |
| Quando emergono problemi reali | Correggere pagine non scoperte, intenti incompleti, fonti superate o prestazioni insufficienti | Manutentore e responsabile dei contenuti |

Per le azioni utili, misurare separatamente apertura della scheda, consultazione delle fonti, avvio del confronto, salvataggio, fonte/prenotazione open day e contatto esterno. Un clic non dimostra iscrizione o prenotazione completata. L’eventuale raccolta analytics deve evitare indirizzi ricercati, dati dei bambini, note, link segreti o altri dati personali negli eventi. Questo lavoro non attiva tracciamenti.

Per la GEO usare un campione stabile, registrando domanda esatta, lingua, piattaforma/modalità, data e URL effettivamente citati. Esempi:

- “Dove posso confrontare nidi e scuole dell’infanzia a Milano con le fonti?”
- “Come trovo nidi e scuole nel Municipio 7 di Milano?”
- “Che differenza c’è tra nido comunale, in appalto e posto accreditato?”
- “Come confronto il costo completo di una scuola dell’infanzia a Milano?”
- “Scuole Vicine è un servizio del Comune? Chi lo cura?”
- “Una scuola presente nel catalogo ha sicuramente posti disponibili?”

Distinguere risposta corretta, menzione del nome e citazione con collegamento. La visita di un bot non dimostra una citazione. Ripetere il campione quando ci sono modifiche sostanziali o una revisione periodica motivata dai dati; nessuna automazione è stata creata.

## Manutenzione e moduli selezionati

A ogni aggiornamento sostanziale dei dati: correggere fonte e anno alla radice, rigenerare, eseguire audit e controllare il campione pertinente. Prima del nuovo ciclo d’iscrizioni: ricontrollare bandi, rette, graduatorie e avvisi; non inferire il 2027/28 dal 2026/27. Prima delle visite: consultare l’avviso ufficiale per luogo, data e prenotazione. Dopo ogni release: verificare dominio e restrizioni d’ambiente.

Applicati: base tecnica/editoriale, catalogo, informazione territoriale, guide e fonti, gestione dei periodi e indice GEO curato. Non applicabili: ecommerce e offerte acquistabili, profilo Google Business del portale come scuola, sedi del progetto ricavate dalle strutture elencate, traduzioni non mantenute, feed Merchant Center, per-school Markdown. Rimandati al rilascio: misure sul campo, strumenti dei motori, CDN e osservazione delle citazioni. IndexNow non è introdotto per un catalogo statico senza una frequenza di aggiornamento che ne giustifichi la manutenzione.
