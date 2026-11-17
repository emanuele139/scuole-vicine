# Segnalazioni sulle scuole

Ogni scheda e ogni card del catalogo offre **Segnala**. Un dialog condiviso raccoglie motivo (chiusura, orari, indirizzo, altro), dettagli (obbligatori per altro) ed email obbligatoria. I dati non vengono salvati nel browser o nello spazio famiglia. La conferma compare solo dopo la risposta positiva del database; gli errori conservano i campi per riprovare.

## Avvio locale

La sola anteprima Astro non esegue le API. Per provare l’invio completo usare il Worker già previsto dal progetto:

```sh
npm run shared:db
npm run shared:dev
```

Aprire `http://127.0.0.1:4320/`. Le migrazioni includono `0002_school_reports.sql`; è necessario applicarle anche al database remoto effettivo prima di pubblicare. Il progetto attuale usa ancora un ID D1 segnaposto. Questa modifica non effettua deploy.

## Raccolta e consultazione

`POST /api/reports` salva in D1 `school_reports`: UUID, ID canonico della scuola, categoria, email, dettagli e date di creazione/scadenza. Sono validati ID di entrambe le fasce del catalogo, email, categorie, lunghezza e origine. Si applica il limite esistente di 5 POST al minuto per IP; nessun IP viene memorizzato nella tabella. Nessuna API pubblica permette di leggere le segnalazioni. Non sono inviate notifiche email automatiche.

Il gestore consulta i dati dalla console D1 o da Wrangler, con le credenziali del database. Per esempio, in locale:

```sh
npx wrangler d1 execute scuole-milano-shared --local --command "SELECT id, school_id, category, email, details, datetime(created_at, 'unixepoch') AS received_at FROM school_reports WHERE expires_at > unixepoch() ORDER BY created_at DESC LIMIT 100"
```

Per il database di produzione usare `--remote` dopo la configurazione effettiva. Gli ID si trovano nel catalogo per individuare la scheda. Le segnalazioni vanno verificate prima di correggere i dati: non modificano automaticamente il catalogo. Non pubblicare gli indirizzi email o i testi ricevuti.

Il cron giornaliero già configurato elimina anche le segnalazioni dopo 365 giorni. Nella prova locale il cron non parte da solo: usare il trigger scheduled di Wrangler se occorre verificare la pulizia. La conservazione è spiegata nel modulo.
