"""Apply evidence-backed research without changing stable catalogue identities.

Research coverage and actual availability of information are deliberately separate.
This module is shared by the original reconciler and the standalone research step.
"""
from __future__ import annotations
import copy, json, re
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / 'research/deepening'
FIELDS = ('hours', 'cost', 'services', 'openDay')
STATUSES = {'verified', 'operator-rule', 'not-published', 'not-found', 'blocked', 'needs-confirmation', 'prior-research'}
FACTUAL = {'verified', 'operator-rule'}

# Reviewed source records whose email identified an individual rather than an office.
# Re-enable only after reviewing a generic institutional replacement.
NOMINATIVE_EMAIL_RECORDS = frozenset({'mi-1253', 'extra-dragonfly'})

def minimize_public_contacts(schools):
    for school in schools:
        if school['id'] in NOMINATIVE_EMAIL_RECORDS:
            school['email'] = None
    return schools

def read_json(path):
    return json.loads(path.read_text())

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def valid_url(value):
    if not isinstance(value, str) or re.search(r'\s', value): return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme in {'http', 'https'} and bool(parsed.hostname) and '.' in parsed.hostname and '@' not in parsed.netloc and not parsed.username
    except ValueError:
        return False

def normalized_time(value):
    parts = re.split(r'\s*[–-]\s*', value)
    normalized = []
    for part in parts:
        if not re.fullmatch(r'\d{1,2}:\d{2}', part): raise ValueError(f'Orario non interpretabile: {value}')
        hour, minute = map(int, part.split(':'))
        if hour > 23 or minute > 59: raise ValueError(f'Orario non valido: {value}')
        normalized.append(f'{hour:02d}:{minute:02d}')
    if len(normalized) > 2: raise ValueError(f'Orario non interpretabile: {value}')
    return '–'.join(normalized)

def validate_record(record, group, assigned, catalog_ids):
    ident = record.get('id')
    if ident not in assigned: raise ValueError(f'{group}: ID non assegnato {ident}')
    if ident not in catalog_ids: raise ValueError(f'{group}: ID fuori catalogo {ident}')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(record.get('checkedAt', ''))): raise ValueError(f'{ident}: data assente')
    date.fromisoformat(record['checkedAt'])
    if not isinstance(record.get('attempts'), list) or not record['attempts']: raise ValueError(f'{ident}: manca la traccia delle consultazioni')
    if not isinstance(record.get('sources'), list): raise ValueError(f'{ident}: fonti assenti')
    if not isinstance(record.get('services'), list): raise ValueError(f'{ident}: servizi non strutturati')
    for field in FIELDS:
        evidence = record.get('fieldEvidence', {}).get(field, {})
        if evidence.get('status') not in STATUSES: raise ValueError(f'{ident}/{field}: stato non valido {evidence.get("status")}')
        if not isinstance(evidence.get('sourceUrls'), list): raise ValueError(f'{ident}/{field}: provenienza mancante')
        if any(not valid_url(url) for url in evidence['sourceUrls']): raise ValueError(f'{ident}/{field}: URL fonte non valido')
        if evidence['status'] in FACTUAL and not evidence['sourceUrls']: raise ValueError(f'{ident}/{field}: un fatto richiede una fonte')
        value = record.get(field)
        if evidence['status'] in FACTUAL and not value: raise ValueError(f'{ident}/{field}: fonte positiva senza valore')
    for event in record.get('events', []):
        date.fromisoformat(event['date'])
        normalized_time(event.get('time', ''))
        if not valid_url(event.get('source')): raise ValueError(f'{ident}: evento senza fonte')
    return ident

def apply_research(base_schools, *, strict=True, research_dir=None):
    folder = research_dir or RESEARCH
    manifest = read_json(folder / 'assignment-manifest.json')
    catalog_ids = {school['id'] for school in base_schools}
    assigned_ids = [ident for ids in manifest['groups'].values() for ident in ids]
    if len(set(assigned_ids)) != len(assigned_ids): raise ValueError('Assegnazioni duplicate')
    if set(assigned_ids) != catalog_ids: raise ValueError('Il manifesto non corrisponde al catalogo: riconciliare le nuove assegnazioni')
    records, group_stats, pending = {}, {}, []
    for group, assigned in manifest['groups'].items():
        path = folder / f'{group}.json'
        rows = read_json(path) if path.exists() else []
        if not isinstance(rows, list): raise ValueError(f'{path}: atteso array di schede')
        group_ids = set()
        for row in rows:
            ident = validate_record(row, group, assigned, catalog_ids)
            if ident in records: raise ValueError(f'Approfondimento duplicato {ident}')
            records[ident] = (group, row)
            group_ids.add(ident)
            if row.get('researchComplete') is False: pending.append(ident)
        missing = sorted(set(assigned) - group_ids)
        group_stats[group] = {'assigned': len(assigned), 'reviewed': len(rows), 'missingIds': missing}
    missing = sorted(catalog_ids - set(records))
    if strict and (missing or pending): raise ValueError(f'Ricerca incompleta: {len(missing)} schede assenti, {len(pending)} ancora in lavorazione. Nessuna omissione viene ignorata.')
    result = copy.deepcopy(base_schools)
    counts = {field: Counter() for field in FIELDS}
    audit_rows = []
    for school in result:
        ident = school['id']
        if ident not in records: continue
        group, record = records[ident]
        source_map = {item['url']: item for item in school.get('sources', []) if valid_url(item.get('url'))}
        for source in record['sources']:
            if valid_url(source.get('url')):
                source_map[source['url']] = {key: source[key] for key in ('label', 'url', 'year', 'checkedAt') if key in source}
        effective = {}
        for field in FIELDS:
            evidence = copy.deepcopy(record['fieldEvidence'][field])
            evidence.setdefault('year', None)
            incoming = record.get(field)
            previous = school.get(field)
            if field == 'services':
                incoming = list(dict.fromkeys(str(value).strip() for value in incoming if str(value).strip()))
            if incoming and (evidence['status'] in FACTUAL or not previous):
                school[field] = incoming
            elif previous:
                evidence = {'status': 'prior-research', 'sourceUrls': [s['url'] for s in school['sources'] if s.get('checkedAt') == '2026-11-15'], 'year': school.get('detailYear')}
            else:
                school.setdefault(field, [] if field == 'services' else None)
            effective[field] = evidence
            counts[field][evidence['status']] += 1
            for url in evidence['sourceUrls']:
                if url not in source_map: source_map[url] = {'label': 'Fonte dell’approfondimento', 'url': url, 'checkedAt': record['checkedAt']}
        school['officialPage'] = record['officialPage'] if valid_url(record.get('officialPage')) else None
        official = record.get('officialUrl')
        # The old MIM website field is a discovery lead, not a verified school link.
        # An explicit unsuccessful research result must not revive a wrong domain.
        if valid_url(official): school['url'] = official
        elif valid_url(record.get('officialPage')): school['url'] = record['officialPage']
        else: school['url'] = None
        if not school.get('officialPage') and school.get('url'): school['officialPage'] = school['url']
        if record.get('description'):
            school['description'] = record['description'].strip()
        for contact in ('phone', 'email'):
            if isinstance(record.get(contact), str) and record[contact].strip(): school[contact] = record[contact].strip()
        events = {(event['date'], normalized_time(event['time'])): {**event, 'time': normalized_time(event['time'])} for event in school.get('events', [])}
        for event in record.get('events', []):
            time = normalized_time(event['time'])
            key = (event['date'], time)
            event = {**event, 'time': time, 'id': ident + '-' + event['date'] + '-' + re.sub(r'\W', '', time)}
            events[key] = event
            if event['source'] not in source_map: source_map[event['source']] = {'label': 'Open day · fonte ufficiale', 'url': event['source'], 'checkedAt': record['checkedAt']}
        school['events'] = sorted(events.values(), key=lambda event: event['date'] + event['time'])
        school['sources'] = list(source_map.values())
        school['services'] = school.get('services') or []
        school['warnings'] = list(dict.fromkeys(school['warnings'] + record.get('warnings', [])))
        if record.get('statusUpdate') == 'historical':
            if not valid_url(record.get('statusSource')): raise ValueError(f'{ident}: stato storico senza prova')
            school['status'] = 'historical'
            school['warnings'] = [warning for warning in school['warnings'] if 'Questo non dimostra una chiusura.' not in warning]
            school['lat'] = school['lng'] = None
            school['locationYear'] = None
            school['dataStatus']['location'] = 'historical-site-unconfirmed'
            if record.get('statusReason'): school['warnings'].insert(0, record['statusReason'])
        school_specific = bool(record.get('description') and (record.get('officialPage') or record.get('officialUrl')) and (effective['services']['status'] == 'verified' or effective['hours']['status'] == 'verified'))
        school['enriched'] = school.get('enriched', False) or school_specific
        school['research'] = {'checkedAt': record['checkedAt'], 'group': group, 'fieldEvidence': effective, 'attemptCount': len(record['attempts']), 'schoolSpecific': school_specific}
        school['dataStatus']['details'] = 'research-' + record['checkedAt']
        school['detailYear'] = 'Anni indicati accanto ai singoli dati'
        audit_rows.append({'id': ident, 'name': school['name'], 'municipality': school['municipality'], 'management': school['management'], 'researchComplete': record.get('researchComplete') is not False, 'checkedAt': record['checkedAt'], 'schoolSpecific': school_specific, 'officialLink': school.get('officialPage') or school.get('url'), 'status': school['status'], 'mapMode': 'historical-address' if school['status'] == 'historical' else 'catalogue-coordinates' if school['lat'] is not None else 'address-search-unconfirmed', 'fieldEvidence': copy.deepcopy(effective), 'fields': {field: evidence['status'] for field, evidence in effective.items()}, 'sources': len(source_map), 'attempts': len(record['attempts'])})
    latest = max((record['checkedAt'] for _, record in records.values()), default=manifest['checkedAt'])
    report = {'schemaVersion': 1, 'checkedAt': latest, 'catalogTotal': len(result), 'reviewed': len(records), 'missingIds': missing, 'pendingIds': pending, 'groups': group_stats, 'fieldAvailability': {field: dict(value) for field, value in counts.items()}, 'schoolSpecificDetails': sum(row['schoolSpecific'] for row in audit_rows), 'officialLinks': sum(bool(row['officialLink']) for row in audit_rows), 'events': sum(len(s['events']) for s in result), 'limits': ['Un campo controllato non è necessariamente pubblicato.', 'Le regole di rete sono distinte dai servizi documentati per la sede.', 'Prezzi e date conservano l’anno delle fonti.', 'Le mappe senza coordinate rappresentano una ricerca per indirizzo, non un ingresso verificato.'], 'schools': audit_rows}
    return minimize_public_contacts(result), report

def publish_research_report(report):
    write_json(ROOT / 'src/data/research-coverage.json', report)
    write_json(ROOT / 'public/dati/copertura-approfondimenti.json', report)
    write_json(RESEARCH / 'coverage-report.json', report)

def publish_client_catalog(schools):
    keys = ('id','name','slug','address','zone','municipality','management','recognition','lat','lng','legacyId','code','aliases','enriched','events')
    write_json(ROOT / 'src/data/catalog-client.json', [{key: school[key] for key in keys} for school in schools])
