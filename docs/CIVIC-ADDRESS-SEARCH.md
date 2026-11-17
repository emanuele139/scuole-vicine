# Ricerca dei numeri civici

## Problema e correzione

Il 17 novembre 2026 è stata riprodotta una ricerca per la quale Photon non restituiva il civico richiesto: la ricerca strutturata proponeva lo stesso numero di altre vie, mentre quella testuale riconosceva soltanto la strada. Il controllo su via e numero scartava correttamente quelle risposte. Il catalogo ufficiale del Comune conteneva invece il civico con le sue coordinate.

La ricerca consulta ora prima i civici comunali sul dispositivo. Non sono previste eccezioni per singoli indirizzi degli utenti. Solo i civici assenti dalla copia locale e le ricerche senza numero vengono inviati a Photon, mantenendo il controllo su Comune, via e numero. Non vengono usate coordinate del centro della strada per rispondere a una richiesta di civico esatto.

## Fonte e licenza

- Fonte: **Comune di Milano, DS634 — Numeri civici con coordinate geografiche**.
- Snapshot: **1° ottobre 2026**, risorsa aggiornata sul portale il 4 ottobre 2026.
- [Dataset](https://dati.comune.milano.it/dataset/ds634-numeri-civici-coordinate), [risorsa CSV e licenza](https://dati.comune.milano.it/dataset/ds634-numeri-civici-coordinate/resource/533b4e63-3d78-4bb5-aeb4-6c5f648f7f21).
- Licenza esplicita della risorsa: **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. La MIT del software non sostituisce questa licenza.
- Attribuzione: **Comune di Milano · DS634 · elaborazione Scuole Vicine**. Presente nel JSON, nella pagina Fonti e nelle attribuzioni del repository.

La copia minimizzata `public/dati/civici-milano.json` contiene **52.156 civici** su **3.965 vie**, circa 1,6 MB prima della compressione HTTP. Dal totale di 65.160 record sono esclusi quelli non applicati, i numeri non validi e gli accessi speciali identificati da `BARRA2`. Sono conservati solo denominazioni e alias delle vie, numeri e coordinate EPSG:4326. Non vengono distribuiti residenti, contatti o associazioni fra indirizzi e utenti. Le denominazioni sono uniformate nella presentazione e le coordinate arrotondate a sei decimali; la distanza resta in linea d’aria.

## Ricostruzione e aggiornamento

```sh
python3 scripts/import-civic-addresses.py
# Oppure, da una copia dello ZIP ufficiale:
python3 scripts/import-civic-addresses.py --input /percorso/civici.zip
```

Lo script usa una risorsa e uno snapshot espliciti; non aggiorna automaticamente l’annualità. URL, periodo, licenza, conteggi e SHA-256 dello ZIP sono conservati nel JSON. Per aggiornare la fonte verificare prima risorsa, licenza, campi e significato degli stati, quindi aggiornare data e URL nello script e rigenerare. L’importazione rifiuta coordinate non valide e duplicati dello stesso civico nella stessa via.

## Comportamento e limiti

Il catalogo viene scaricato al primo uso di una ricerca con civico, una sola volta per pagina, con un URL fisso che non include il testo digitato. L’indice in memoria conserva la distinzione fra `12`, `12A`, `12/1` e `121`. Le abbreviazioni dei tipi di strada e le denominazioni ufficiali alternative sono considerate senza accettare vie di tipo diverso.

Annullare un suggerimento non annulla il download comune alla ricerca successiva. Se il file non è disponibile, dopo un timeout la ricerca passa a Photon; i tentativi di scaricare il catalogo fallito sono distanziati di almeno 30 secondi. Il limite del dataset resta quello dello snapshot: civici recenti, non ancora applicati o accessi speciali possono mancare. Non viene inventata una posizione per compensare un’assenza.

Test automatici coprono numeri esatti, suffissi, barre numeriche, alias, tipo di via, assenza di invii a Photon per un risultato locale, annullamento di una ricerca durante il download e indisponibilità del catalogo. Le fixture usano indirizzi sintetici; l’indirizzo segnalato dall’utente non è registrato come dato di test o come caso speciale.

Verifica locale del 17 novembre 2026: 77 test TypeScript e 17 test Python superati; controllo Astro senza errori o avvisi, build Pages e audit SEO di produzione superati. Campione di 208 civici distribuiti nel catalogo: tutte le coordinate restituite coincidono con quelle dello snapshot. Nell’interfaccia l’indirizzo segnalato viene trovato con distanze dal civico; verificata anche una ricerca in layout mobile a 390 pixel. La verifica di pubblicazione va eseguita sulla stessa copia usata per il rilascio.
