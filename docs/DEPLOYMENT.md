# Pubblicazione su Cloudflare

Account: emanuele139 (`85f18a9dd2f084a555e2ede5472c1e47`). Dominio: `scuolevicine.it`.

## Servizi

- Cloudflare Pages `scuole-vicine` distribuisce la build Astro e inoltra `/api/*` al binding interno `BACKEND`.
- Worker `scuole-vicine-api`: API, protezioni sulle richieste, notifiche email e attività pianificata ogni 15 minuti. Nessun URL pubblico workers.dev o preview; accesso tramite service binding Pages.
- D1 `scuole-vicine`: giurisdizione `eu`, regione iniziale EEUR, senza repliche di lettura. Configurazione in `wrangler.production.jsonc`; tre migrazioni SQL.
- Cloudflare Email Service: mittente `scuole-vicine@notifiche.cardinali.studio`, sul sottodominio già verificato nello stesso account, unico destinatario consentito `emanuele@cardinali.studio`, già verificato nell’account. L’email del visitatore è solo Reply-To, mai mittente.
- R2 non necessario: non ci sono caricamenti di file. Il catalogo pubblico è incluso nella build, mentre D1 conserva soltanto spazi cifrati e segnalazioni private.

I nomi e gli ID delle risorse non sono credenziali. I token Cloudflare non devono entrare nel repository.

## Build e deploy

Pubblicare sempre da una copia senza guide o dati locali:

```sh
python3 scripts/prepare-github.py --output /tmp/scuole-vicine-release
cd /tmp/scuole-vicine-release
npm ci
npm run check
npm run shared:check
npm test
SEO_INDEXABLE=true npm run build:pages
python3 scripts/audit-seo.py --mode production
npx wrangler d1 migrations apply DB --remote --config wrangler.production.jsonc
npx wrangler deploy --config wrangler.production.jsonc
cp wrangler.pages.jsonc wrangler.jsonc
CLOUDFLARE_ACCOUNT_ID=85f18a9dd2f084a555e2ede5472c1e47 npx wrangler pages deploy dist --project-name scuole-vicine --branch main
```

Pages richiede il nome standard `wrangler.jsonc`: sostituirlo soltanto nella copia temporanea destinata alla pubblicazione. L’account Cloudflare viene selezionato esplicitamente; autenticazione tramite Wrangler. `scripts/build-pages.mjs` rifiuta la checkout che contiene la guida locale. La build non distribuisce il sito da sola. Il repository GitHub non attiva deploy automatici.

## Notifiche e conservazione

La segnalazione viene salvata prima di tentare l’email. Se Cloudflare non accetta l’invio, il record rimane disponibile per il tentativo successivo: attività pianificata ogni 15 minuti, massimo dieci tentativi, fino a 25 notifiche per esecuzione. La presa in carico usa un intervallo di dieci minuti per evitare invii concorrenti ordinari. Un arresto fra invio e conferma nel database può comunque causare un duplicato: l’ID della segnalazione permette di riconoscerlo. `email_sent_at` indica accettazione dal servizio, non prova di lettura o consegna in casella.

Spazi e segnalazioni scaduti sono eliminati ogni 15 minuti. I record applicativi non contengono l’IP; Workers Logs, Logpush e logging del contenuto delle richieste non sono attivati. Il fornitore può trattare propri metadati di infrastruttura secondo la sua informativa.

D1 Time Travel permette ripristini fino a 30 giorni sul piano Workers Paid già presente nell’account (7 sul piano Free). Non vengono creati export o backup in R2. La versione attuale non mantiene un registro separato delle cancellazioni manuali: non ripristinare in produzione gli spazi o le segnalazioni da Time Travel. In caso di perdita usare un nuovo database vuoto. Un futuro ripristino selettivo richiederà prima un registro esterno delle cancellazioni. Procedura da predisporre: sospendere l’API, conservare fuori dal database da ripristinare l’elenco degli ID eliminati, ripristinare, eliminare nuovamente quegli ID e tutti i record scaduti, poi verificare prima di riaprire. Le cancellazioni per scadenza restano riconoscibili dalla data nel record ripristinato. Non ripristinare automaticamente senza queste verifiche.

Le copie email non seguono la pulizia D1: il titolare deve rimuoverle dalla propria casella appena non più necessarie, comunque entro 365 giorni. Non pubblicare segnalazioni, email, appunti, dump o chiavi degli spazi nel repository.

Riferimenti: [Pages e service binding](https://developers.cloudflare.com/pages/functions/bindings/), [Email Service](https://developers.cloudflare.com/email-service/configuration/send-bindings/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

## Collaudo del 17 novembre 2026

La copia pubblica ha superato Astro/TypeScript senza errori, 68 test TypeScript e 14 test Python, build Pages e audit SEO di produzione: 763 pagine generate, 735 schede, 760 URL nella sitemap e 42.748 collegamenti interni verificati.

Su Pages sono stati provati creazione, lettura, modifica, autenticazione, conflitto di revisione ed eliminazione di uno spazio cifrato sintetico. Verificati anche creazione dal browser, consenso alle mappe, cartografia online, pagine principali, Markdown e 404 della guida locale. La segnalazione sintetica dal modulo è stata salvata in D1 e la notifica è stata ricevuta nella casella del titolare, con un solo tentativo.

Netsons ha confermato il salvataggio dei nameserver `jillian.ns.cloudflare.com` e `kayden.ns.cloudflare.com`. I record preesistenti sono stati importati su Cloudflare, inclusi sei record omessi dalla scansione automatica; dominio principale e www puntano al progetto Pages. Il redirect www → dominio principale e HTTP → HTTPS è gestito dalla funzione Pages. Al momento del primo collaudo, la delega presso il registro .it e i certificati Pages dei domini personalizzati sono ancora in attesa di attivazione. Il dominio tecnico Pages risponde in HTTPS e ha intestazione noindex.
