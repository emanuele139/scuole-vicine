# Contribuire a Scuole Milano

Puoi aiutare a correggere un dato, chiarire una spiegazione o migliorare il codice. Il progetto è curato da [Emanuele Cardinali](https://cardinali.studio/).

## Segnalare un dato da correggere

Quando sarà disponibile il repository, apri una issue indicando la scuola o il servizio, il dato da correggere, la pagina ufficiale pubblica e l’anno di riferimento. Una retta del 2026/27 non conferma quella del 2027/28. Non trovare un’informazione non dimostra che il servizio non sia offerto.

Usa soltanto pubblicazioni intenzionalmente aperte al pubblico. Non allegare dati dei bambini, documenti familiari, esportazioni di appunti, schermate del browser con informazioni personali o link degli spazi condivisi. Per le vulnerabilità segui [SECURITY.md](SECURITY.md).

## Modificare il codice

1. Installa le dipendenze con `npm ci` e avvia `npm run dev`.
2. Mantieni il cambiamento circoscritto e spiega il problema che risolve.
3. Esegui `npm run check`, `npm run shared:check`, `npm test`, `npm run test:research`, `npm run test:nurseries` e `npm run build`.
4. Per modifiche all’interfaccia controlla anche tastiera e larghezze mobile. Aggiungi un test quando protegge un comportamento significativo.

Non occorrono credenziali cloud o gli archivi locali per build e test. Gli importatori completi richiedono input esclusi dalla distribuzione: leggi [docs/DATA.md](docs/DATA.md) prima di eseguirli.

## Scrivere i testi

Parti dalla domanda della famiglia e dai il primo orientamento subito. Usa parole concrete, il tu nelle istruzioni e rispetto per le diverse condizioni di vita. Spiega i termini necessari; distingui fatti, dichiarazioni dei gestori e suggerimenti. Indica anno, fonte e condizioni dei dati e rendi esplicito ciò che manca. Evita promesse di ammissione, classifiche di qualità non documentate e formule promozionali. Non inventare esperienze o testimonianze.

## Licenze dei contributi

I contributi originali al codice e alla documentazione sono proposti sotto MIT. Indica provenienza e licenza di ogni materiale di terzi; non caricare materiale su cui non hai i diritti necessari. Le modifiche ai dati devono conservare le attribuzioni e le condizioni delle fonti.
