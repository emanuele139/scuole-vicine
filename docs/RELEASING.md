# Preparare una versione pubblica

La preparazione è locale. Non crea repository remoti, non fa push e non distribuisce il sito. L’esito dello script non certifica le licenze: il [rapporto](SOURCE-LICENSE-AUDIT.md) distingue le condizioni accertate dagli aspetti da precisare, considerando anche il principio di apertura dei dati pubblici.

Il [controllo prima di GitHub](PRE-GITHUB-CHECK.md) documenta la verifica della copia destinata al repository.

## File inclusi ed esclusi

`.gitignore` esclude `legacy/`, `research/` (compresa la guida stilistica), `README-CODEX.md`, Regia, database, credenziali, esportazioni e la pagina `/design/` con le sue dipendenze esclusive. Questi file restano nel progetto locale. I componenti grafici usati dalle pagine del sito rimangono inclusi.

La guida al design continua a essere accessibile localmente su `/design/`. È esclusa da Git, non dalla build eseguita nella checkout personale: per controllare o distribuire la versione pubblica usare la copia preparata qui sotto. Il footer pubblico collega Il progetto al posto della guida.

`.gitignore` non rimuove file già tracciati e non cancella la cronologia. Alla preparazione iniziale questa directory non aveva un repository Git. Se in futuro si usa una cronologia esistente, controllare separatamente file tracciati, commit, tag e allegati prima di renderli pubblici.

## Preparare una copia locale

Dalla radice:

```sh
python3 scripts/prepare-github.py --output /tmp/scuole-milano-github
```

La destinazione deve essere nuova e fuori dalla checkout. Lo script applica le regole di esclusione con Git usando metadati temporanei; non inizializza Git nel progetto, non copia link simbolici e non copia la propria destinazione. Controlla i file selezionati per indicatori di segreti e riferimenti familiari noti prima di scrivere. La scansione è un controllo automatico limitato, non una garanzia su ogni possibile dato personale.

Nella copia preparata eseguire `npm ci`, i controlli del README e la build. Verificare che `dist/design/` non esista e che i collegamenti di `/progetto/` siano corretti. I materiali locali ignorati non devono essere necessari per questi controlli.

## Collegamenti e nome

Il nome pubblico approvato è **Scuole Vicine** e il dominio previsto è **scuolevicine.it**. In `src/data/project.ts`, `authorUrl` punta a `https://cardinali.studio/` e `repositoryUrl` all’indirizzo previsto `https://github.com/emanuele139/scuole-vicine`. `repositoryPublished` è `true`: il codice è pubblico e il canale issue del repository è disponibile. Questa impostazione non pubblica il sito online. I link per conoscere l’autore e quelli per consultare il codice hanno destinazioni distinte.

La preparazione normale mantiene `noindex` perché è un’anteprima. Canonical e metadati sono già configurati per `https://scuolevicine.it`; sitemap, robots, indice `llms.txt` e intestazioni HTTP sono generati dalla build. La variante indicizzabile richiede `SEO_INDEXABLE=true`: collaudarla con `python3 scripts/audit-seo.py --mode production` dopo la build. Il comando non pubblica nulla. Prima del lancio leggere [SEO e GEO](SEO-GEO.md), verificare host HTTPS e redirect da www, proprietà Search Console/Bing e informativa sui servizi esterni e sullo spazio condiviso.

L’immagine social originale `public/social/scuole-vicine.png` è ammessa nella copia pubblica tramite un hash SHA-256 esplicito nello script di preparazione. Se viene modificata, verificare il nuovo asset e aggiornare l’hash: gli altri file binari continuano a essere segnalati per la revisione.

## Prima della pubblicazione del repository

- Controllare la copia e il risultato della scansione; evitare `git add -f` sui materiali esclusi.
- Rileggere il [rapporto licenze](SOURCE-LICENSE-AUDIT.md) e conservare attribuzioni, periodi e trasformazioni. Per i dati pubblici considerare l’art. 52 CAD; una licenza non verificata non equivale a un divieto e non determina automaticamente rimozioni o richieste di autorizzazione. Distinguere questi casi dai vincoli espliciti accertati e dai materiali di terzi. Le attribuzioni del sito restano consultabili nei riquadri “Fonti”.
- Attivare e verificare le segnalazioni private di vulnerabilità su GitHub; aggiornare `SECURITY.md`.
- Controllare l’indirizzo del repository, il profilo autore e gli esiti della CI.

Un eventuale deploy del servizio è un passaggio distinto. Per lo spazio condiviso occorre definire ritenzione e ripristino dei backup, dominio HTTPS, database reale, migrazioni, limiter e cron: vedi `README-SHARED.md`.
