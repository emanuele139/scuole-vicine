# Controllo prima di GitHub

Controllo locale del **17 novembre 2026**, dopo la revisione delle attribuzioni e dei collegamenti autore/progetto. Nessuna pubblicazione, creazione di repository remoto, operazione di push o deploy eseguita.

## File e dati controllati

La selezione per GitHub è stata ricostruita applicando le regole della checkout con `scripts/prepare-github.py`, senza inizializzare Git nel progetto. Questa directory non contiene una cronologia Git: non vi sono commit locali da ripulire. Un futuro caricamento da un repository diverso richiederà un controllo della sua cronologia.

Guide al design e alla scrittura, relative dipendenze esclusive, `research/`, `legacy/`, `README-CODEX.md`, Regia, `.wrangler/`, database, credenziali ed esportazioni locali risultano esclusi. Entrambe le guide sono ancora presenti sul disco. I componenti grafici del sito in `src/components/design/` sono inclusi perché servono alle pagine pubbliche e non costituiscono la guida locale. La build della copia pubblica non contiene `/design/`.

La scansione dei file selezionati e il controllo dei valori sospetti non hanno rilevato credenziali reali, chiavi private, token GitHub/API, link completi di spazi famiglia, percorsi della cartella personale o contenuti privati di famiglie. Le ricorrenze tecniche di token, cifratura e credenziali appartengono a codice, schemi o test; non sono segreti operativi. Le chiavi legacy di migrazione non contengono selezioni o appunti reali.

Due recapiti nominativi sono stati omessi dal campo email di altrettante scuole. La minimizzazione viene riapplicata sia dalla riconciliazione sia dall’unione delle ricerche, con un test di regressione. I valori omessi non sono riprodotti in questo documento. Restano nome e sito dell’autore, contatti pubblici generici delle scuole e attribuzioni agli autori delle librerie: sono informazioni destinate alla distribuzione pubblica. Gli indirizzi operativi dei servizi, inclusi i nidi famiglia, restano quelli del catalogo pubblico; non sono stati confrontati con residenze private. Per i nidi famiglia non sono distribuiti email, telefono o gestore nominativo.

`.env.example` contiene soltanto dominio pubblico e impostazioni SEO. `wrangler.jsonc` usa un ID D1 segnaposto e non contiene credenziali cloud. Le migrazioni sono schemi, non copie di segnalazioni ricevute. Gli esempi delle segnalazioni nei test usano indirizzi sintetici.

La card social PNG è stata ispezionata: contiene solo identità e dominio del progetto. Non contiene chunk testuali o EXIF. Il suo hash corrisponde a quello ammesso dalla procedura di preparazione. Gli altri asset sono sorgenti SVG/CSS/JS o avvisi di licenza.

## Documentazione e attribuzioni

MIT resta riferita al software e ai materiali originali, con eccezioni esplicite per terzi. `LICENSES.md`, rapporto fonti, README e istruzioni di rilascio distinguono licenze confermate e aspetti non accertati; non presentano una verifica incompleta come divieto di riuso. L’inventario delle fonti conserva hash coerenti con i cataloghi dopo la minimizzazione dei recapiti.

Le attribuzioni e i collegamenti alle fonti restano nei dati e nei riquadri “Fonti”. Nome e link per conoscere l’autore rimandano a `https://cardinali.studio/`. I rimandi al codice usano `https://github.com/emanuele139/scuole-vicine`, configurato come non ancora pubblicato. Copyright e licenze dei componenti terzi sono conservati.

Le istruzioni documentano sia il funzionamento locale sia i limiti: gli input grezzi della ricerca non vengono distribuiti e la ricostruzione integrale non è promessa dal solo clone. Le segnalazioni ricevute e i dati degli spazi famiglia devono restare nei rispettivi ambienti privati, non nel repository.

## Verifiche eseguite sulla copia senza materiali locali

- `npm run check`: nessun errore, warning o hint.
- `npm run shared:check`: superato.
- `npm test`: **56 test TypeScript superati**.
- `npm run test:research`: **7 test Python superati**.
- `npm run test:nurseries`: **7 test Python superati**.
- `npm run build`: completato; guida al design assente dall’output pubblico.
- `npm run seo:audit`: nessun errore; controllate **735 schede** e **39.113 collegamenti interni** nella modalità anteprima.
- Verificate anche le 24 versioni Markdown delle pagine editoriali: nessuna guida locale, pagina famiglia o scheda privata viene generata da questi percorsi.
- Controlli mirati sull’HTML: recapiti omessi assenti, URL autore/repository corretti e stato del repository dichiarato.

Le dipendenze già installate sono state riutilizzate tramite un collegamento nella sola copia di collaudo. Non è stata eseguita una nuova installazione `npm ci` da rete. La copia finale per GitHub viene preparata separatamente, senza quel collegamento o gli output di test. La CI è predisposta per installare le dipendenze dal lockfile quando sarà usata su GitHub.

## Limiti del controllo

Il risultato è “nessun segreto o contenuto privato individuato nei file destinati al repository”, non una garanzia assoluta su ogni possibile informazione personale. Non certifica la base giuridica di ogni dato professionale pubblico né le licenze di tutte le fonti; queste distinzioni rimangono documentate nel rapporto. Non riguarda database remoti, backup esterni, profili browser o file locali esclusi.

Gli esiti sono riferiti alla copia di sorgenti verificata in questa sessione, con un manifesto dei file creato nella destinazione finale (`RELEASE-MANIFEST.json`). Le modifiche contemporanee o successive alla checkout richiedono un nuovo confronto con quella copia; non sono implicitamente coperte dal controllo.
