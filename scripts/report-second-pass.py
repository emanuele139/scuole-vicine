#!/usr/bin/env python3
"""Compare the second official-source review with the saved first-pass catalogue."""
from collections import Counter
from pathlib import Path
import re
from urllib.parse import urlsplit, parse_qs
from school_research import ROOT, RESEARCH, read_json, write_json, valid_url, normalized_time, apply_research

folder = RESEARCH / 'second-pass'
targets = read_json(folder / 'targets.json')
before = {s['id']: s for s in read_json(folder / 'catalog-before.json')}
# Preflight the proposed catalogue in memory, before publishing its contents.
proposed, _ = apply_research(read_json(RESEARCH / 'catalog-before.json'))
after = {s['id']: s for s in proposed}
assert set(before) == set(after), 'Il secondo passaggio non deve cambiare le identità del catalogo'

def public_url(url):
    if not valid_url(url): return False
    parsed = urlsplit(url)
    if re.search(r'area.?riservata|/private(?:/|$)|sharepoint|/login|/intern[oi](?:/|$)', parsed.hostname + parsed.path, re.I): return False
    return not any(re.search(r'nonce|token|auth|password|secret', key, re.I) for key in parse_qs(parsed.query))

for ident, school in after.items():
    assert school['slug'] == before[ident]['slug'], f'URL della scheda cambiato: {ident}'
    existing = {source['url'] for source in before[ident]['sources']}
    for source in school['sources']:
        if source['url'] not in existing:
            assert public_url(source['url']), f'Nuova fonte riservata o da verificare: {ident}'
checks, coverage = {}, {}
for group, schools in targets.items():
    expected = {s['id'] for s in schools}
    rows = read_json(folder / group / 'audit.json')
    seen = set()
    for row in rows:
        ident = row['id']
        assert ident in expected and ident not in seen and ident not in checks, f'Audit duplicato o non assegnato: {ident}'
        assert row.get('attempts'), f'Mancano le consultazioni: {ident}'
        assert row.get('checkedAt') == '2026-11-16', f'Data del controllo assente: {ident}'
        assert all(public_url(attempt.get('url')) for attempt in row['attempts']), f'URL non pubblico o da verificare nelle consultazioni: {ident}'
        assert row.get('outcome'), f'Esito assente: {ident}'
        seen.add(ident)
        checks[ident] = (group, row)
    assert seen == expected, f'Audit incompleto {group}: {sorted(expected-seen)}'
    coverage[group] = {'assigned': len(expected), 'reviewed': len(seen)}

fields = ('cost', 'openDay', 'hours', 'services', 'description', 'officialPage', 'url')
def event_map(schools):
    return {(s['id'], e['date'], normalized_time(e['time'])): {**e, 'schoolId': s['id'], 'schoolName': s['name']}
            for s in schools.values() for e in s['events']}
old_events, new_events = event_map(before), event_map(after)
added = [new_events[key] for key in sorted(new_events.keys() - old_events.keys())]
removed = [old_events[key] for key in sorted(old_events.keys() - new_events.keys())]
rows = []
for ident, (group, audit) in checks.items():
    old, new = before[ident], after[ident]
    changed = [field for field in fields if old.get(field) != new.get(field)]
    evidence_changes = [field for field in ('cost','openDay','hours','services')
                        if old['research']['fieldEvidence'][field] != new['research']['fieldEvidence'][field]]
    event_changes = [e for e in added if e['schoolId'] == ident]
    positive_changes = [field for field in ('cost','openDay','hours','services')
                        if (field in changed or field in evidence_changes) and new['research']['fieldEvidence'][field]['status'] in {'verified','operator-rule'}]
    publication = audit.get('publicPublicationEvidence', [])
    cost_promoted = old['research']['fieldEvidence']['cost']['status'] != 'verified' and new['research']['fieldEvidence']['cost']['status'] == 'verified'
    cost_delta = 'cost' in changed or cost_promoted or bool(new.get('cost') and 'cost' in evidence_changes and new['research']['fieldEvidence']['cost']['status'] == 'verified')
    cost_kind = audit.get('costUpdateKind')
    if cost_delta:
        assert cost_kind in {'tuition-schedule','partial-fee','confirmed-existing','availability-note'}, f'Manca classificazione del delta costi: {ident}'
    if positive_changes or event_changes:
        assert isinstance(publication, list) and publication, f'Manca prova di pubblicazione intenzionale: {ident}'
    for evidence in publication:
        assert public_url(evidence.get('sourceUrl')), f'Fonte non chiaramente pubblica: {ident}'
        assert public_url(evidence.get('publicationPageUrl')), f'Manca pagina pubblica di provenienza: {ident}'
        assert evidence.get('notes') and evidence.get('linkText'), f'Provenienza pubblica non documentata: {ident}'
    if positive_changes or event_changes:
        documented = {url for evidence in publication for url in (evidence['sourceUrl'], evidence['publicationPageUrl'])}
        required = {e['source'] for e in event_changes}
        for field in positive_changes:
            required.update(new['research']['fieldEvidence'][field]['sourceUrls'])
        # Prior official sources may remain alongside the newly read document.
        required -= {s['url'] for s in old['sources']}
        assert required <= documented, f'Nuove fonti senza prova pubblica {ident}: {sorted(required-documented)}'
    rows.append({'id': ident, 'name': new['name'], 'href': '/scuole/' + new['slug'] + '/', 'municipality': new['municipality'], 'management': new['management'],
                 'changedFields': changed, 'evidenceChanges': evidence_changes, 'addedEvents': len(event_changes),
                 'costAfter': new.get('cost'), 'openDayAfter': new.get('openDay'),
                 'costUpdateKind': cost_kind if cost_delta else None,
                 'costEvidenceBefore': old['research']['fieldEvidence']['cost'], 'costEvidenceAfter': new['research']['fieldEvidence']['cost'],
                 'openDayEvidenceAfter': new['research']['fieldEvidence']['openDay'],
                 'attempts': audit['attempts'], 'publicPublicationEvidence': publication, 'outcome': audit['outcome'], 'notes': audit.get('notes', '')})

promoted_costs = [r for r in rows if r['management'] == 'Privata' and r['costEvidenceBefore']['status'] != 'verified' and r['costEvidenceAfter']['status'] == 'verified']
updated_costs = [r for r in rows if 'cost' in r['changedFields']]
updated = [r for r in rows if r['changedFields'] or r['evidenceChanges'] or r['addedEvents']]
cost_kinds = Counter(r['costUpdateKind'] for r in rows if r.get('costUpdateKind'))
report = {'schemaVersion': 1, 'checkedAt': '2026-11-16', 'catalogTotal': len(after), 'targetedSchools': len(checks),
          'groups': coverage, 'targetManagement': dict(Counter(r['management'] for r in rows)), 'updatedSchools': len(updated), 'costTextsUpdated': len(updated_costs),
          'newlyVerifiedPrivateCostFields': len(promoted_costs), 'newEvents': len(added), 'removedEvents': len(removed),
          'costUpdateKinds': dict(cost_kinds),
          'eventsBefore': len(old_events), 'eventsAfter': len(new_events), 'newEventsDetails': added, 'removedEventsDetails': removed,
          'changedFields': dict(Counter(field for r in rows for field in r['changedFields'])),
          'municipalNetworkCheck': read_json(folder / 'municipal-network-audit.json'),
          'publicationPolicy': 'Solo contenuti intenzionalmente pubblicati su pagine ufficiali aperte o da esse collegati; esclusi documenti personali, interni o di destinazione dubbia.',
          'limits': ['I campi sui costi possono comprendere quote parziali: leggere anno, mensa, iscrizione ed extra nella scheda.',
                     'Un dato ricontrollato può restare non pubblicato, non trovato o da confermare.',
                     'Il controllo delle regole comunali è di rete, non una nuova verifica di ogni singola sede.'],
          'schools': rows}
write_json(folder / 'report.json', report)
write_json(ROOT / 'src/data/second-pass-report.json', report)
write_json(ROOT / 'public/dati/secondo-passaggio.json', report)
print({key: report[key] for key in ('targetedSchools','updatedSchools','costTextsUpdated','newlyVerifiedPrivateCostFields','newEvents','eventsAfter')})
