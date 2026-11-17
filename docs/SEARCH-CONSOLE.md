# Google Search Console

Configurazione completata il 17 novembre 2026 nell’account Google del titolare, Emanuele Cardinali (`emanuele139`).

## Proprietà e verifica

- Proprietà **Dominio**: `sc-domain:scuolevicine.it`, comprendente protocolli e sottodomini.
- [Apri la proprietà](https://search.google.com/search-console?resource_id=sc-domain%3Ascuolevicine.it).
- Proprietà verificata tramite record TXT `google-site-verification` alla radice del dominio, aggiunto nella zona Cloudflare dell’account emanuele139.
- Record già presente sui nameserver autorevoli e verifica confermata dall’interfaccia Google. Conservare il TXT: serve a mantenere la proprietà verificata. Il valore non è una credenziale applicativa; non viene duplicato in questa documentazione.
- Nessun accesso generale all’account DNS concesso a Google: è stata usata la verifica manuale. Nessun altro utente aggiunto alla proprietà.

## Sitemap

Inviata [https://scuolevicine.it/sitemap.xml](https://scuolevicine.it/sitemap.xml). Search Console mostra **Riuscita**, lettura del 17 novembre 2026 e **760 pagine rilevate**.

La sitemap comprende i contenuti pubblici. Le pagine famiglia, confronto e design restano escluse; le relative politiche `noindex` sono verificate dall’audit SEO. Non inviare i link segreti degli spazi condivisi o i parametri contenenti dati dei visitatori a servizi di indicizzazione.

## Controlli effettuati

- Home: test dell’URL pubblicato superato, accessibile a Google e indicizzabile. Richiesta di indicizzazione accettata: URL inserito nella coda di scansione prioritaria.
- Raccolta `/nidi/`: test in tempo reale superato con Google Inspection Tool smartphone; scansione consentita, recupero riuscito, indicizzazione consentita, canonical dichiarato `https://scuolevicine.it/nidi/` e un breadcrumb valido.
- Scheda `/scuole/andersen-school-mi-1386/`: test in tempo reale superato, pagina disponibile per Google, indicizzabile e un breadcrumb valido.
- Report Azioni manuali e Problemi di sicurezza: entrambi mostrano «Nessun problema rilevato» alla data del controllo.
- Audit SEO sulla build di produzione e controlli HTTP del dominio: nessun errore. Lo script di audit identifica le proprie richieste come `ScuoleVicine-QA/1.0`; il client Python generico riceveva un 403 dalla protezione. Non sono state modificate le regole Cloudflare per eseguire i controlli. I test ufficiali di Google confermano separatamente l’accesso del suo strumento di scansione.

Al momento della configurazione gli URL controllati non erano ancora nell’indice; i report della nuova proprietà sono in elaborazione. La sitemap letta correttamente e il test di disponibilità non dimostrano che tutte le pagine siano già indicizzate. Non serve ripetere la richiesta per la stessa home: il reinvio non ne aumenta la priorità.

## Manutenzione

Controllare nella proprietà i report Sitemap, Pagine, HTTPS/Core Web Vitals quando disponibili, Azioni manuali e Problemi di sicurezza. Le nuove pagine pubbliche vengono inserite nella sitemap dalla build; Google può rilevarne gli aggiornamenti dalla sitemap già registrata. Non rimuovere la verifica DNS durante modifiche al dominio.

Search Console non richiede Google Analytics o script Google nelle pagine: questa configurazione usa DNS e sitemap e non cambia le scelte di consenso dei visitatori. Le statistiche delle visite restano affidate a Umami, secondo [l’integrazione privacy](PRIVACY-ANALYTICS.md).

Riferimenti: [aggiungere una proprietà](https://support.google.com/webmasters/answer/34592?hl=it), [verificare la proprietà](https://support.google.com/webmasters/answer/9008080?hl=it), [controllo URL](https://support.google.com/webmasters/answer/9012289?hl=it).
