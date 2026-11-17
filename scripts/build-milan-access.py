#!/usr/bin/env python3
"""Build an ID-complete access overlay; never rewrite the source catalogues.

Network rules are applied only when a municipal admission route is documented.
An individual search attempt does not constitute verification of an admission rule.
"""
import collections
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DAY = '2026-11-17'
YEAR = '2026/27'
BANDO = 'https://www.comune.milano.it/de/documents/20118/5597879/Comunicato%2Biscrizioni%2Bn.4%2B2026-2027.pdf/5d374792-79b1-471c-a79e-afebe074e721?download=true&t=1769522189637&version=1.0'
QUOTE = 'https://www.comune.milano.it/documents/20118/1101454/Informazioni%2B2026-2027_quote_contributive_nidi%2Be%2Bsezioni_primavera.pdf/b75fd0d6-61ed-5667-bf9c-678b022eaa27?download=true&t=1783677068768&version=1.6'
MENSA = 'https://www.comune.milano.it/servizi/scuola/refezione-scolastica'
MENSA_PDF = 'https://www.milanoristorazione.it/files/Famiglie/Rette/Un_posto_a_tavola.pdf'
MIM = 'https://www.istruzioneer.gov.it/wp-content/uploads/2025/12/m_pi.AOODGOSV.REGISTRO-UFFICIALEU.0100847.17-12-2025.pdf'
PROROGA = 'https://anci.lombardia.it/documenti/22974-Istruzione%20-%20Proroga%20termini%20domande%20di%20iscrizione_Nota%20n.%2033781%20del%2012%20febbraio%202026.pdf'
INPS = 'https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.03.bonus-asilo-nido-2026-attivo-il-servizio-per-la-domanda.html'
REGIONE = 'https://www.bandi.regione.lombardia.it/servizi/servizio/catalogo/dettaglio/politiche-sociali/famiglia/nidi-gratis-plus-2026-27-adesione-famiglie-RLD12026053903'
MIM_GRATIS = 'https://istruzione.umbria.it/sistema-integrato-0-6/'

def source(label, url, year=YEAR, **extra):
    return dict(label=label, url=url, year=year, checkedAt=DAY, **extra)

def ev(status='not-found', scope='unknown', urls=(), year=None):
    return dict(status=status, scope=scope, sourceUrls=list(urls), year=year)

def build():
    originals = []
    for filename, stage in [('schools.json', 'preschool'), ('nurseries.json', 'nursery')]:
        for item in json.loads((ROOT / 'src/data' / filename).read_text()):
            item = copy.deepcopy(item)
            item['educationStage'] = stage
            originals.append(item)
    assert len({s['id'] for s in originals}) == len(originals)
    overrides = json.loads((ROOT / 'research/milan-access/school-rules.json').read_text())
    targets = json.loads((ROOT / 'research/milan-access/search-targets.json').read_text())
    attempts = {t['id']: {'query': t['q'], 'evidenceFile': f"research/milan-access/search-{(i // 4) * 4:03d}.json"} for i, t in enumerate(targets)}
    records = []
    for s in originals:
        stage = s['educationStage']
        municipal = (stage == 'preschool' and s['management'] == 'Comunale') or (stage == 'nursery' and 'graduatoria comunale' in s.get('accessMode', '').lower())
        statale = stage == 'preschool' and s['management'] == 'Statale'
        r = dict(id=s['id'], municipalityName='Milano', stage=stage, management=s['management'], year=YEAR if municipal or statale else 'Anni indicati per campo',
                 verifiedAt=DAY, status='needs-confirmation', evidenceScope='unknown',
                 eligibility='Requisiti di residenza per questa sede non documentati nella ricerca. Chiedi alla segreteria se accetta domande dal tuo Comune.',
                 priority='Criteri di ammissione e lista d’attesa della sede da chiedere alla segreteria.',
                 costs=s.get('cost') or 'Preventivo e condizioni economiche della sede da richiedere: iscrizione, frequenza, pasti ed eventuale prolungamento.',
                 benefits='Agevolazioni della sede da verificare con la segreteria.',
                 application='Chiedi alla segreteria come presentare domanda e quando viene confermato il posto.',
                 nonResidentAccess='unknown',
                 questions=['Accettate domande da famiglie residenti nel mio Comune?', 'Quali criteri applicate quando le domande superano i posti?', 'Il preventivo cambia per residenza e comprende pasti, iscrizione e prolungamento?'],
                 sources=[], fieldEvidence={k: ev() for k in ['eligibility', 'priority', 'costs', 'benefits', 'application']})
        old_cost = (s.get('research') or {}).get('fieldEvidence', {}).get('cost', {})
        if s.get('cost') and old_cost.get('sourceUrls'):
            r['fieldEvidence']['costs'] = ev('prior-research', 'school', old_cost['sourceUrls'], old_cost.get('year'))
            r['status'] = 'partial'
            urls = set(old_cost['sourceUrls'])
            r['sources'].extend(x for x in s.get('sources', []) if x['url'] in urls)
        if stage == 'nursery':
            r['benefits'] = 'Il Bonus INPS richiede un servizio abilitato e spese ammissibili documentate; non dipende dal solo Comune della sede. Nidi Gratis Plus richiede uno specifico posto ammesso alla misura: una normale iscrizione privata non ne garantisce l’accesso.'
            r['fieldEvidence']['benefits'] = ev('network-rule', 'network', [INPS, REGIONE], YEAR)
            r['sources'].extend([source('INPS · Bonus servizi per l’infanzia 2026', INPS, '2026'), source('Regione · Nidi Gratis Plus 2026/27', REGIONE)])
        if municipal:
            r.update(status='verified', evidenceScope='network', nonResidentAccess='not-eligible-ordinarily',
                     eligibility='Il bando comunale 2026/27 si rivolge ai bambini residenti a Milano che vivono con almeno un genitore o esercente la responsabilità genitoriale residente, con i requisiti di età e regolarità vaccinale previsti. Non accoglie nuove domande ordinarie di nuclei residenti in altri Comuni italiani. Sono previste procedure specifiche per trasferimenti a Milano, famiglie prive di iscrizione anagrafica in Italia e minori ospitati in comunità a Milano.',
                     priority='Si applica la graduatoria comunale: riserve di posto e punteggi per condizioni familiari e lavorative e sedi previste dal bando. La vicinanza sul sito non attribuisce un diritto al posto.',
                     application='Domanda attraverso il Comune di Milano, con SPID o CIE e secondo il bando e le eventuali riaperture. Tempi e condizioni 2027/28 da riconfermare.',
                     questions=['Quali condizioni del prossimo bando si applicano alla mia famiglia?', 'La quota cambia se trasferiamo la residenza durante la frequenza?'])
            for field in ['eligibility', 'priority', 'application']:
                r['fieldEvidence'][field] = ev('network-rule', 'network', [BANDO], YEAR)
            r['sources'].append(source('Comune · bando di accesso servizi all’infanzia 2026/27', BANDO))
            if stage == 'nursery':
                spring = s.get('serviceType') == 'Sezione primavera'
                r['costs'] = ('Posto comunale 2026/27: iscrizione annuale 56,20 €. Per i residenti, quota mensile ' + ('0–251,10 €' if spring else '0–502,20 €') + ' secondo ISEE. Nei casi di frequenza ammessa da non residenti: ' + ('334,68' if spring else '669,35') + ' €/mese, senza agevolazione ISEE. Luglio ed eventuali extra seguono condizioni proprie.')
                if 'convenzione' in s.get('accessMode', ''):
                    r['costs'] += ' La tariffa comunale riguarda il posto assegnato dal Comune; per un eventuale posto privato serve il preventivo del gestore.'
                    r['eligibility'] += ' Questa regola riguarda i posti assegnati dal Comune; per gli eventuali posti privati occorre una verifica separata con il gestore.'
                r['benefits'] = 'ISEE per residenti; riduzioni per bassa frequenza e dicembre. Per fratelli residenti, il secondo minore paga il 30% della quota; condizioni specifiche per i successivi. Bonus INPS e Nidi Gratis Plus richiedono verifiche e domande distinte; non si ottengono con la sola iscrizione.'
                r['fieldEvidence']['costs'] = ev('network-rule', 'network', [QUOTE], YEAR)
                r['fieldEvidence']['benefits'] = ev('network-rule', 'network', [QUOTE, INPS, REGIONE], YEAR)
                r['sources'].append(source('Comune · quote e condizioni di pagamento nidi e primavera 2026/27', QUOTE))
            else:
                r['costs'] = 'Infanzia comunale 2026/27: iscrizione annuale 56,20 €; mensa a tempo pieno fino a 734,40 €/anno per i residenti prima delle riduzioni ISEE. Per i non residenti il documento corrente di Milano Ristorazione indica 1.149,27 €/anno; importo da confermare per il caso concreto, poiché vecchi allegati comunali riportano una quota differente. Extra esclusi.'
                r['benefits'] = 'Le riduzioni ISEE della mensa sono riservate ai residenti. Il documento 2026/27 di Milano Ristorazione esclude per i non residenti anche la riduzione per più figli. La presenza di una quota non residenti non consente nuove iscrizioni fuori dai requisiti del bando.'
                r['fieldEvidence']['costs'] = ev('needs-confirmation', 'network', [MENSA, MENSA_PDF], YEAR)
                r['fieldEvidence']['benefits'] = ev('network-rule', 'network', [MENSA, MENSA_PDF], YEAR)
                r['sources'].extend([source('Comune · refezione scolastica', MENSA), source('Milano Ristorazione · Un posto a tavola 2026/27', MENSA_PDF, YEAR, accessStatus='indexed-text; direct-open-502')])
                r['status'] = 'partial'
        elif statale:
            r.update(status='partial', evidenceScope='network', nonResidentAccess='conditional',
                     eligibility='Puoi chiedere l’iscrizione anche se risiedi in un altro Comune. L’accoglimento dipende dai posti e dai criteri del Consiglio d’istituto; essere residenti a Milano non garantisce il posto nel plesso scelto.',
                     priority='In caso di domande eccedenti si applicano i criteri dell’istituto. La griglia attuale della sede non è stata verificata: chiedi come pesano bacino, residenza, fratelli e lavoro dei genitori.',
                     costs='La frequenza statale è gratuita. Mensa e servizi aggiuntivi hanno costi propri: quota piena residenti 734,40 €/anno; il documento Milano Ristorazione 2026/27 indica 1.149,27 €/anno per non residenti, da confermare per il caso concreto rispetto a vecchi allegati differenti.',
                     benefits='La gratuità della frequenza statale vale anche fuori comune. Le riduzioni ISEE della mensa milanese sono riservate ai residenti; per i non residenti il documento del servizio esclude anche lo sconto per più figli.',
                     application='La domanda di infanzia si presenta all’istituto nelle modalità indicate dalla segreteria, anche quando usa un proprio modulo online. Non è l’iscrizione nazionale online della primaria. Modalità e date 2027/28 da riconfermare.')
            r['fieldEvidence']['eligibility'] = ev('network-rule', 'network', [MIM], YEAR)
            r['fieldEvidence']['costs'] = ev('needs-confirmation', 'network', [MIM_GRATIS, MENSA, MENSA_PDF], YEAR)
            r['fieldEvidence']['benefits'] = ev('network-rule', 'network', [MIM_GRATIS, MENSA, MENSA_PDF], YEAR)
            r['fieldEvidence']['application'] = ev('network-rule', 'network', [MIM, PROROGA], YEAR)
            r['sources'].extend([source('MIM · iscrizioni 2026/27', MIM), source('MIM · proroga termini 2026/27', PROROGA), source('USR · gratuità della frequenza statale', MIM_GRATIS, None), source('Comune · refezione scolastica', MENSA), source('Milano Ristorazione · Un posto a tavola 2026/27', MENSA_PDF, YEAR, accessStatus='indexed-text; direct-open-502')])
        if s['id'] in overrides and not municipal:
            o = overrides[s['id']]
            for field in ['eligibility', 'priority', 'costs', 'benefits', 'application']:
                if field in o:
                    r[field] = o[field]
                    meta = o.get('fieldEvidence', {}).get(field, {})
                    r['fieldEvidence'][field] = ev(meta.get('status', 'verified'), meta.get('scope', 'school'), meta.get('sourceUrls', [x['url'] for x in o['sources']]), meta.get('year', o.get('year')))
            r['sources'].extend(o.get('sources', []))
            for key in ['questions', 'year', 'nonResidentAccess']:
                if key in o:
                    r[key] = o[key]
            r['evidenceScope'] = o.get('evidenceScope', 'school')
            r['status'] = 'partial'  # an application process does not prove residence eligibility
        if s['id'] == 'mi-1036':
            r['websiteWarning'] = 'Il sito precedentemente associato alla sede rimanda a contenuti di un’altra scuola. Il collegamento è sospeso: chiedi alla segreteria il sito ufficiale attuale.'
            r['suspendedWebsiteHosts'] = ['scuolasvizzera.it']
            r['eligibility'] = 'La fonte web precedentemente associata alla Scuola Svizzera reindirizza a contenuti di una scuola al Cairo. Identità del sito e condizioni di accesso da verificare con la segreteria prima di usarle per una domanda.'
            r['fieldEvidence']['eligibility'] = ev('needs-confirmation')
            r['questions'].insert(0, 'Qual è il sito ufficiale attuale della sede milanese?')
        # Do not turn unrelated query results or generic home pages into admission evidence.
        unique = {}
        for x in r['sources']:
            unique[x['url']] = x
        r['sources'] = list(unique.values())
        r['recordContext'] = 'Regola di rete applicabile al posto comunale documentato' if municipal else ('Regole nazionali e comunali con verifica locale dove indicata' if statale else 'Verifica della sede: i campi mancanti rimangono espliciti')
        r['reviewedAt'] = DAY
        r['verifiedAt'] = DAY if municipal or statale or s['id'] in overrides else None
        records.append(r)
    assert {r['id'] for r in records} == {s['id'] for s in originals}
    summary = dict(total=len(records), byStage=dict(collections.Counter(r['stage'] for r in records)),
                   byStatus=dict(collections.Counter(r['status'] for r in records)),
                   byEvidenceScope=dict(collections.Counter(r['evidenceScope'] for r in records)),
                   municipalRouteDocumented=sum((r['recordContext'].startswith('Regola di rete')) for r in records),
                   individualSearchTargets=len(targets), schoolOrOperatorRuleOverrides=len(overrides),
                   fields={k: dict(collections.Counter(r['fieldEvidence'][k]['status'] for r in records)) for k in ['eligibility', 'priority', 'costs', 'benefits', 'application']})
    data = dict(checkedAt=DAY, year=YEAR, summary=summary,
                limitations=['735 profili valutati non equivalgono a 735 regolamenti individuali verificati.', 'I posti assegnati dal Comune e i posti privati della stessa sede possono avere condizioni diverse.', 'Nessuna disponibilità attuale di posti verificata.', '2027/28 resta da verificare salvo singola fonte esplicita.', 'Mensa non residenti: fonte corrente indicizzata 2026/27, apertura diretta non disponibile; differenza rispetto a documenti precedenti conservata come verifica necessaria.'], records=records)
    (ROOT / 'src/data/milan-access.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    audit = dict(checkedAt=DAY, summary=summary, ids=[r['id'] for r in records], missingIds=[], duplicateIds=[], attempts=attempts,
                 unverifiedEligibilityIds=[r['id'] for r in records if r['fieldEvidence']['eligibility']['status'] in ['not-found', 'needs-confirmation']],
                 unverifiedPriorityIds=[r['id'] for r in records if r['fieldEvidence']['priority']['status'] in ['not-found', 'needs-confirmation']])
    (ROOT / 'research/milan-access/coverage.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    names = {s['id']: s['name'] for s in originals}
    lines = ['# Matrice di copertura — Milano', '',
             'Stati delle prove, non disponibilità di posti. Testi e fonti in `src/data/milan-access.json`.', '',
             '| ID | Sede | Fascia | Accesso | Priorità | Costi | Agevolazioni | Procedura | Ambito |',
             '|---|---|---|---|---|---|---|---|---|']
    for r in records:
        values = [r['id'], names[r['id']], r['stage']] + [r['fieldEvidence'][k]['status'] for k in ['eligibility', 'priority', 'costs', 'benefits', 'application']] + [r['evidenceScope']]
        lines.append('| ' + ' | '.join(str(v).replace('|', '/') for v in values) + ' |')
    (ROOT / 'research/milan-access/coverage-table.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    build()
