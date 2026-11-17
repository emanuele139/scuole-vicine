"""Validate and merge public, field-level evidence for services aged 0–3.

The anagraphic importer and the standalone research command share this module.
It deliberately never writes the preschool catalog or its research reports.
"""
from __future__ import annotations
import copy
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit
from school_research import ROOT, FIELDS, FACTUAL, apply_research, read_json, write_json, valid_url, validate_record

RESEARCH = ROOT / 'research/nurseries/deepening'
CLIENT_FIELDS = ('id','name','slug','address','zone','municipality','management','recognition','lat','lng','legacyId','code','aliases','enriched','events','educationStage','serviceType','ageRange','accessMode','operator')
PRIVATE_QUERY_KEYS = {'token','access_token','auth','authorization','signature','sig','secret','password','key','x-amz-signature','x-amz-credential'}


def public_url(url):
    if not valid_url(url):
        return False
    return not any(key.lower() in PRIVATE_QUERY_KEYS for key, _ in parse_qsl(urlsplit(url).query))


def source_proof(source, ident):
    proof = source.get('publicPublicationEvidence', {})
    if not public_url(source.get('url')) or not public_url(proof.get('pageUrl')):
        raise ValueError(f'{ident}: fonte o pagina di provenienza non pubblica/valida')
    if not all(isinstance(proof.get(key), str) and proof[key].strip() for key in ('linkText', 'rationale')):
        raise ValueError(f'{ident}: manca la prova di pubblicazione intenzionale')


def validate_public_record(row):
    ident = row['id']
    sources = row['sources']
    by_url = {source.get('url'): source for source in sources}
    for source in sources:
        source_proof(source, ident)
    if len(by_url) != len(sources):
        raise ValueError(f'{ident}: fonte duplicata')
    for field in FIELDS:
        value = row.get(field)
        if field == 'services':
            if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
                raise ValueError(f'{ident}: elenco servizi non valido')
        elif value is not None and not isinstance(value, str):
            raise ValueError(f'{ident}/{field}: atteso testo o null')
        evidence = row['fieldEvidence'][field]
        for url in evidence['sourceUrls']:
            if url not in by_url:
                raise ValueError(f'{ident}/{field}: fonte non inclusa nella provenienza pubblica')
        if evidence['status'] in FACTUAL and not value:
            raise ValueError(f'{ident}/{field}: dato positivo vuoto')
        if field == 'cost' and value and re.search(r'\d', value) and not evidence['sourceUrls']:
            raise ValueError(f'{ident}: importo senza provenienza')
    for event in row.get('events', []):
        if event['source'] not in by_url:
            raise ValueError(f'{ident}: evento senza provenienza pubblica')
    if row.get('locationConflict'):
        if not row.get('warnings') or not row.get('locationEvidenceUrls'):
            raise ValueError(f'{ident}: conflitto geografico senza avvertenza e fonte')
        if any(url not in by_url for url in row['locationEvidenceUrls']):
            raise ValueError(f'{ident}: conflitto geografico senza fonte pubblica')
    for key in ('officialUrl', 'officialPage'):
        if row.get(key) and not public_url(row[key]):
            raise ValueError(f'{ident}: collegamento ufficiale non valido')


def merge_nursery_research(base_schools, *, research_dir=None, strict=True):
    folder = Path(research_dir or RESEARCH)
    manifest = read_json(folder / 'assignment-manifest.json')
    base_ids = {school['id'] for school in base_schools}
    assigned = [ident for group in manifest['groups'].values() for ident in group]
    if len(assigned) != len(set(assigned)) or set(assigned) != base_ids:
        raise ValueError('Assegnazioni 0–3 mancanti, duplicate o fuori catalogo')
    rows = {}
    for group, group_ids in manifest['groups'].items():
        path = folder / f'{group}.json'
        records = read_json(path) if path.exists() else []
        if not isinstance(records, list):
            raise ValueError(f'{group}: atteso elenco di record')
        for row in records:
            ident = validate_record(row, group, group_ids, base_ids)
            validate_public_record(row)
            if ident in rows:
                raise ValueError(f'{ident}: ricerca duplicata')
            rows[ident] = row
    # All validation happens in memory, before the first catalog write.
    schools, report = apply_research(base_schools, research_dir=folder, strict=strict)
    conflicts = []
    for school in schools:
        row = rows.get(school['id'])
        if not row:
            continue
        source_map = {source['url']: source for source in school['sources']}
        for source in row['sources']:
            source_map[source['url']] = copy.deepcopy(source)
        school['sources'] = list(source_map.values())
        # A documented field is site-specific even when its existing description
        # did not need rewriting; network rules alone never qualify.
        specific = any(school['research']['fieldEvidence'][field]['status'] == 'verified' and school.get(field) for field in FIELDS)
        school['research']['schoolSpecific'] = bool(specific)
        school['enriched'] = bool(specific)
        if row.get('locationConflict'):
            school['lat'] = school['lng'] = None
            school['locationYear'] = None
            school['dataStatus']['location'] = 'Fonti attuali discordanti dalla sede anagrafica: coordinate escluse'
            if school['status'] != 'historical':
                school['status'] = 'needs-review'
            conflicts.append({'id': school['id'], 'sourceUrls': row['locationEvidenceUrls'], 'warnings': row['warnings']})
        if school['serviceType'] == 'Nido famiglia':
            school['operator'] = school['phone'] = school['email'] = None
    report['educationStage'] = 'nursery'
    # Keep original reconciliation ambiguities separate from new research
    # conflicts, identically for standalone and full anagraphic replay.
    report['anagraphicReviews'] = [
        {'id': s['id'], 'name': s['name'], 'warnings': [warning for warning in s['warnings'] if any(word in warning for word in ('provvisoria', 'Ingressi diversi', 'trasferimento', 'non associata', 'non risolta'))]}
        for s in base_schools if s['status'] == 'needs-review'
    ]
    report['locationConflicts'] = conflicts
    report['numericCostRecords'] = sum(bool(school.get('cost') and re.search(r'\d\s*(?:€|euro)|€\s*\d', school['cost'], re.I)) for school in schools)
    report['byServiceType'] = dict(Counter(school['serviceType'] for school in schools))
    report['publicSources'] = list({source['url']: copy.deepcopy(source) for row in rows.values() for source in row['sources']}.values())
    report['schoolSpecificDetails'] = sum(bool(school.get('research', {}).get('schoolSpecific')) for school in schools)
    for item in report['schools']:
        school = next(s for s in schools if s['id'] == item['id'])
        item['schoolSpecific'] = school['research']['schoolSpecific']
        item['status'] = school['status']
        item['mapMode'] = 'catalogue-coordinates' if school['lat'] is not None else 'address-search-unconfirmed'
    report['limits'] += [
        'La ricerca di ogni scheda è distinta dalla disponibilità di ciascun campo.',
        'Le quote comunali riguardano il canale comunale documentato; i posti privati possono avere tariffe e orari differenti.',
        'Le pagine prive di anno educativo restano senza attribuzione automatica al 2027/28.',
        'Date senza anno o orario certo restano testo e non diventano appuntamenti esportabili.',
        'Le nuove fonti devono documentare la destinazione pubblica; documenti personali o di diffusione ristretta sono esclusi.',
        'Il numero di eventi conta associazioni ai servizi; l’agenda unisce gli incontri condivisi con stessa data, orario, fonte e luogo.',
    ]
    for key in ('schools', 'anagraphicReviews', 'locationConflicts'):
        report[key].sort(key=lambda item: item['id'])
    report = json.loads(json.dumps(report, sort_keys=True))
    return schools, report


def publish_nursery_research(schools, report):
    write_json(ROOT / 'src/data/nurseries.json', schools)
    write_json(ROOT / 'src/data/nurseries-client.json', [{key: school[key] for key in CLIENT_FIELDS} for school in schools])
    for target in (ROOT / 'src/data/nursery-research-coverage.json', ROOT / 'public/dati/approfondimento-nidi.json', RESEARCH / 'coverage-report.json'):
        write_json(target, report)


def update_inventory_report(schools, research_report):
    path = ROOT / 'public/dati/copertura-nidi.json'
    report = read_json(path)
    report['geolocated'] = sum(s['lat'] is not None for s in schools)
    report['geolocatedCurrent'] = sum(s.get('locationYear') == '2026/27' and s['lat'] is not None for s in schools)
    report['geolocatedHistorical'] = sum(s.get('locationYear') == '2018/19' and s['lat'] is not None for s in schools)
    report['researchCoverage'] = {key: research_report[key] for key in ('checkedAt','reviewed','schoolSpecificDetails','officialLinks','events','numericCostRecords')}
    report['researchLocationConflicts'] = research_report['locationConflicts']
    report['unresolvedAddressRecords'] = research_report['anagraphicReviews']
    write_json(path, json.loads(json.dumps(report, sort_keys=True)))
    reconciliation_path = RESEARCH.parent / 'reconciliation.json'
    if reconciliation_path.exists():
        reconciliation = read_json(reconciliation_path)
        reconciliation['summary']['geolocated'] = report['geolocated']
        write_json(reconciliation_path, json.loads(json.dumps(reconciliation, sort_keys=True)))
