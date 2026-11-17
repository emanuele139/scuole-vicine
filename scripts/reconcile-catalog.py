#!/usr/bin/env python3
"""Build the local school catalogue from immutable input snapshots.

Offline by default. No geocoding, inferred school closures or invented detail.
Run: python3 scripts/reconcile-catalog.py
The MIM downloads are national original CSVs; the derived Milano subset is saved
alongside the report. --download refreshes explicit official URLs before building.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, re, unicodedata, urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAP = ROOT / 'research/snapshots'
OUT = ROOT / 'src/data'
RECON = ROOT / 'research/reconciliation'
CHECKED = '2026-11-16'
CURATED_CHECKED = '2026-11-15'
MUNICIPAL_URL = 'https://dati.comune.milano.it/dataset/ds3014-infogeo-scuole-infanzia-localizzazione-2025-2026'
MIM_URLS = {
    'statali': 'https://dati.istruzione.it/opendata/SCUANAGRAFESTAT20262720260901.csv',
    'paritarie': 'https://dati.istruzione.it/opendata/SCUANAGRAFEPAR20262720260901.csv',
}
STOP = {'VIA','VIALE','VLE','LE','CORSO','CSO','PIAZZA','PZZA','PIAZZALE','PZLE','LARGO','BASTIONI','ALZAIA','DI','DA','DE','DEI','DEGLI','DEL','DELLA','DELLE','DELL','D','N'}
# Explicit identity links reviewed against the two input records. These do NOT
# prove the current entrance. Conflicting addresses are retained in the report;
# coordinates are withheld for a changed/ambiguous site.
REVIEWED_LINKS = {
    'MIAA8C101X': (1294, 'Curated Borsi record explicitly identifies the previous Appennini site.', True),
    'MIAA8F001X': (1365, 'Same unique state school Gattamelata; civic differs 22 / 37.', True),
    'MI1A13100A': (1229, 'S. Abbondio 27 is the school designation in the municipal record, temporarily Palmieri 24.', True),
    'MI1A03600L': (1131, 'Same unique municipal Cesari school; civic differs 38 / 42.', True),
    'MI1A03500R': (1148, 'Same unique municipal Cesalpino school; civic differs 38 / 40.', True),
    'MI1A12900A': (1157, 'Unique municipal Russo school; MIM omits civic.', True),
    'MI1AZO500G': (1167, 'Same Montessori designation and piazza civic 6; street name differs Gerolamo / Girolamo Emiliani.', True),
    'MI1A0P5005': (1417, 'Leone XIII / Leone Tredicesimo are equivalent; civic 12.', False),
    'MI1A15700E': (1199, 'Same unique municipal Ucelli di Nemi school; civic differs 44 / 48.', True),
    'MI1A124007': (1171, 'Reni 1 is the school designation, municipal snapshot reports temporary Mezzofanti 23.', True),
    'MI1A11900Q': (1018, 'Unique municipal Bastioni Porta Venezia school; MIM omits civic.', True),
    'MI1A01900V': (1322, 'Same unique municipal Betti school; civic differs 56 / 71.', True),
    'MI1A091005': (1246, 'Both records identify municipal Memmi 10/1; address differs Memmi / Simone Martini.', True),
    'MI1A04300Q': (1070, 'Same unique municipal Colletta school; civic differs 53 / 49-51.', True),
    'MI1A08000P': (1239, 'Unique municipal Lope de Vega school; MIM omits civic.', True),
    'MI1A140005': (1102, 'Same unique municipal Sanzio school; civic differs 11 / 19.', True),
    'MI1A13400T': (1158, 'Same civic 4; municipal street Erlembaldo versus MIM Erlembardo.', True),
    'MI1A22000R': (1034, 'Same Montessori school, Milazzo; civic 9 falls in MIM range 7/9.', True),
    'MI1A10700D': (1020, 'Same municipal Palermo school; civic 9 falls in MIM range 7/9.', True),
}

def read_json(p):
    return json.loads(p.read_text())

def write_json(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def asc(value):
    return unicodedata.normalize('NFKD', str(value).upper()).encode('ascii', 'ignore').decode()

def normalize(value):
    value = asc(value).replace('P.ZZA', 'PIAZZA').replace('P.ZLE', 'PIAZZALE').replace('V.LE', 'VIALE').replace('C.SO', 'CORSO')
    value = re.sub(r'\bEX\s*\d+.*$', '', value)
    value = value.replace('VENTIDUE', 'XXII').replace('TREDICESIMO', 'XIII').replace('SANTISSIMA', 'SS')
    value = value.replace('MONTE VELINO', 'MONTEVELINO').replace('MONTE ROTONDO', 'MONTEROTONDO')
    value = value.replace('MODIGLIANI', 'MODIGNANI').replace('S. UGUZZONE', 'SANT UGUZZONE')
    return value

def tokens(value):
    return {t for t in re.findall(r'[A-Z]+', normalize(value)) if t not in STOP and len(t) > 1}

def civic(value):
    m = re.search(r'\d+', str(value))
    return m.group() if m else None

def norm_full(value):
    return re.sub(r'[^A-Z0-9]', '', normalize(value))

def slugify(value):
    return re.sub(r'[^a-z0-9]+', '-', asc(value).lower()).strip('-')

def clean(value):
    value = str(value or '').strip()
    return None if value.lower() in {'', 'non disponibile', 'nd', 'n.d.', 'null'} else value

def web_url(value):
    value = clean(value)
    if not value: return None
    value = value.replace('https//', 'https://').replace('http//', 'http://')
    if not re.match(r'^https?://', value): value = 'https://' + value
    return value

def display(value):
    # Retain source spelling, with modest casing for the all-uppercase catalog.
    value = str(value).strip()
    value = re.sub(r'(?<=[A-Za-z])(?=\d)', ' ', value).title()
    return value.replace(' Xiii', ' XIII').replace(' Xxii', ' XXII').replace(' Xxiii', ' XXIII')

def mim_source(kind):
    return {'label': f'Anagrafe MIM · {kind} 2026/27', 'url': MIM_URLS[kind], 'year': '2026/27', 'checkedAt': CHECKED}

def load_mim(kind):
    p = SNAP / f'mim-{kind}-2026-2027.csv'
    if not p.exists(): return [], {'available': False, 'reason': 'Snapshot missing', 'url': MIM_URLS[kind]}
    with p.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or 'CODICESCUOLA' not in reader.fieldnames:
            raise ValueError(f'{p} is not the official CSV schema (HTML downloads are rejected).')
        all_rows = list(reader)
    rows = [r for r in all_rows if r['CODICECOMUNESCUOLA'] == 'F205' and r['DESCRIZIONECOMUNE'] == 'MILANO' and 'INFANZIA' in r['DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA']]
    if any(r['ANNOSCOLASTICO'] != '202627' for r in rows): raise ValueError('Wrong school year')
    return rows, {'available': True, 'url': MIM_URLS[kind], 'snapshot': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'nationalRows': len(all_rows), 'milanoInfanziaRows': len(rows), 'dataAsOf': '2026-09-01', 'downloadedAt': CHECKED}

def management(raw):
    return {'Comunale':'Comunale','Statale':'Statale','Parentale':'Parentale'}.get(raw, 'Privata')

def base_school(raw):
    ident = 'mi-' + str(raw['CODICE'])
    recog = 'Paritaria' if raw['PARITARIA'].upper() == 'SI' else ('Non applicabile' if raw['TIPO']=='Statale' else 'Non paritaria nel catalogo 2025/26')
    return {
        'id': ident, 'name': display(raw['DENOMINAZIONE']), 'slug': slugify(raw['DENOMINAZIONE']) + '-' + ident,
        'address': display(raw['INDIRIZZO']), 'zone': display(raw.get('NIL') or 'Zona da verificare'), 'municipality': raw['MUNICIPIO'],
        'management': management(raw['TIPO']), 'recognition': recog,
        'lat': raw['LAT_Y_4326'], 'lng': raw['LONG_X_4326'], 'legacyId': str(raw['CODICE']), 'code': None,
        'url': None, 'phone': None, 'email': None, 'description': '', 'hours': None, 'cost': None, 'openDay': None,
        'events': [], 'sources': [{'label':'Catalogo geolocalizzato · Comune di Milano 2025/26','url':MUNICIPAL_URL,'year':'2025/26','checkedAt':CHECKED}],
        'catalogYear': '2025/26', 'detailYear': None, 'status': 'needs-review', 'verifiedAt': None, 'enriched': False, 'warnings': [],
        'sourceIds': {'municipal': str(raw['CODICE'])}, 'aliases': [], 'locationYear': '2025/26',
        'dataStatus': {'identity':'historical-catalog','details':'not-researched','location':'municipal-catalog'},
    }

def build():
    for p in (SNAP,OUT,RECON): p.mkdir(parents=True, exist_ok=True)
    base = read_json(SNAP / 'municipal-schools-2025-2026.json')
    curated = read_json(SNAP / 'curated-schools-2026-11-15.json')
    raw_by_id = {r['CODICE']: r for r in base}
    catalog = {r['CODICE']: base_school(r) for r in base}
    mappings, address_conflicts, candidates_report, added, unresolved_mim = [], [], [], [], []
    source_reports, mim_rows = {}, []
    for kind in MIM_URLS:
        rows, source_reports[kind] = load_mim(kind)
        mim_rows += [(kind,r) for r in rows]
    # Exact curated codes provide independently researched identity anchors.
    curated_codes = {c.get('code'):int(c['id']) for c in curated if c.get('code') and c['id'].isdigit()}
    used_base = set()
    matched_codes = set()
    for kind, r in sorted(mim_rows, key=lambda pair: pair[1]['CODICESCUOLA']):
        code = r['CODICESCUOLA']
        chosen, method, reason, suppress_location = None, None, None, False
        if code in REVIEWED_LINKS:
            chosen,reason,suppress_location = REVIEWED_LINKS[code]
            method = 'reviewed-identity-link'
        elif code in curated_codes:
            chosen = curated_codes[code]
            method = 'curated-mechanographic-code'
        else:
            compatible = [b for b in base if (b['TIPO']=='Statale') == (kind=='statali') and ('COMUNALE' not in r['DENOMINAZIONESCUOLA'] or b['TIPO']=='Comunale')]
            exact = [b for b in compatible if norm_full(b['INDIRIZZO']) == norm_full(r['INDIRIZZOSCUOLA'])]
            if len(exact) == 1:
                chosen, method = exact[0]['CODICE'], 'unique-normalized-address'
            else:
                rt, rn = tokens(r['INDIRIZZOSCUOLA']), civic(r['INDIRIZZOSCUOLA'])
                cand = [b for b in compatible if rn and rn == civic(b['INDIRIZZO']) and rt and (rt <= tokens(b['INDIRIZZO']) or tokens(b['INDIRIZZO']) <= rt)]
                if len(cand)==1:
                    chosen, method = cand[0]['CODICE'], 'unique-street-tokens-and-civic'
                elif cand:
                    candidates_report.append({'code':code,'candidates':[b['CODICE'] for b in cand],'reason':'Ambiguous address; no automatic link'})
        if chosen is not None and chosen in used_base:
            unresolved_mim.append({'code':code,'name':r['DENOMINAZIONESCUOLA'],'address':r['INDIRIZZOSCUOLA'],'reason':'Municipal record already linked; requires review','candidate':chosen})
            continue
        if chosen is None:
            # Official MIM identity plus explicit school-level address is sufficient
            # for an unlocated catalogue entry; coordinates/municipality stay null.
            ident = 'mim-' + code.lower()
            s = {'id':ident,'name':display(re.sub(r"^SCUOLA DELL.INFANZIA\s*(?:COMUNALE)?\s*", '', r['DENOMINAZIONESCUOLA'])),'slug':slugify(r['DENOMINAZIONESCUOLA'])+'-'+ident,'address':display(r['INDIRIZZOSCUOLA']),'zone':'Zona da verificare','municipality':None,'management':'Statale' if kind=='statali' else ('Comunale' if 'COMUNALE' in r['DENOMINAZIONESCUOLA'] else 'Privata'),'recognition':'Non applicabile' if kind=='statali' else 'Paritaria','lat':None,'lng':None,'legacyId':None,'code':code,'url':web_url(r.get('SITOWEBSCUOLA')),'phone':None,'email':clean(r.get('INDIRIZZOEMAILSCUOLA')),'description':'','hours':None,'cost':None,'openDay':None,'events':[],'sources':[mim_source(kind)],'catalogYear':'2026/27','detailYear':None,'status':'needs-review','verifiedAt':CHECKED,'enriched':False,'warnings':['Sede presente nell’anagrafe MIM 2026/27, non collegata al catalogo comunale 2025/26. Posizione e Municipio da verificare.'],'sourceIds':{'mim':code},'aliases':[],'locationYear':None,'dataStatus':{'identity':'mim-2026-27','details':'not-researched','location':'unknown'}}
            catalog[code] = s
            added.append({'id':ident,'code':code,'name':s['name'],'address':s['address'],'reason':'Official MIM identity not matched to municipal snapshot; unlocated, not asserted to be a newly opened school'})
            matched_codes.add(code)
            continue
        used_base.add(chosen)
        matched_codes.add(code)
        s = catalog[chosen]
        raw = raw_by_id[chosen]
        s['code'] = code
        s['sourceIds']['mim'] = code
        s['sources'].append(mim_source(kind))
        s['catalogYear'],s['verifiedAt'],s['status'] = '2026/27',CHECKED,'active'
        s['dataStatus']['identity'] = 'mim-2026-27'
        s['recognition'] = 'Non applicabile' if kind=='statali' else 'Paritaria'
        s['url'],s['email'] = web_url(r.get('SITOWEBSCUOLA')),clean(r.get('INDIRIZZOEMAILSCUOLA'))
        s['aliases'] += [r['DENOMINAZIONESCUOLA']]
        map_record = {'municipalId':chosen,'id':s['id'],'code':code,'method':method,'municipalName':raw['DENOMINAZIONE'],'mimName':r['DENOMINAZIONESCUOLA'],'municipalAddress':raw['INDIRIZZO'],'mimAddress':r['INDIRIZZOSCUOLA']}
        map_record['confidence'] = 'provisional-crosswalk' if suppress_location and code != 'MIAA8C101X' else 'identity-match'
        if reason: map_record['reason'] = reason
        mappings.append(map_record)
        if suppress_location:
            address_conflicts.append({**map_record,'resolution':'Identity linked; present entrance unresolved; historical coordinates withheld'})
            s['status'] = 'needs-review'
            if code != 'MIAA8C101X':
                s['dataStatus']['identity'] = 'provisional-mim-link'
                s['warnings'].append('Associazione provvisoria tra i due cataloghi: il collegamento dell’identità e l’ingresso attuale richiedono verifica.')
            s['lat'],s['lng'],s['locationYear'] = None,None,None
            s['address'] = display(r['INDIRIZZOSCUOLA'])
            s['dataStatus']['location'] = 'conflicting-sources'
            s['warnings'].append(f'Sede da confermare: il Comune 2025/26 riporta {display(raw["INDIRIZZO"])}; il MIM 2026/27 riporta {display(r["INDIRIZZOSCUOLA"])}. Coordinate precedenti escluse dalla mappa.')
    # Overlay preserved, human-curated detail. This is not a fresh field-level
    # verification: the date and cycle remain explicitly attached.
    curated_merges=[]
    for c in curated:
        key = int(c['id']) if str(c['id']).isdigit() else (1294 if c['id']=='borsi' else None)
        if key is None:
            ident = 'extra-' + c['id']
            s={'id':ident,'slug':slugify(c['name'])+'-'+ident,'name':c['name'],'address':c['address'],'zone':c['zone'],'municipality':None,'management':management(c['type']),'recognition':'Non applicabile' if c['type']=='Parentale' else ('Paritaria da ricontrollare' if c['type']=='Paritaria' else 'Da verificare'),'lat':c.get('lat'),'lng':c.get('lng'),'legacyId':c['id'],'code':c.get('code') or None,'url':None,'phone':None,'email':None,'description':'','hours':None,'cost':None,'openDay':None,'events':[],'sources':[],'catalogYear':'2026/27','detailYear':None,'status':'needs-review','verifiedAt':None,'enriched':True,'warnings':['Presente nella ricerca locale, assente dal catalogo comunale usato. Identità e operatività da ricontrollare.'],'sourceIds':{},'aliases':[],'locationYear':None,'dataStatus':{'identity':'curated-research','details':'prior-research','location':'unknown'}}
            catalog[ident]=s
        else:
            s=catalog[key]
            curated_merges.append({'legacyId':c['id'],'id':s['id'],'method':'municipal-id' if c['id'].isdigit() else 'explicit-former-site-reference'})
        s['aliases'].append(s['name'])
        s['name']=c['name']
        s['legacyId']=c['id']
        s['zone']=c['zone']
        # Do not overwrite unresolved MIM/location conflicts with old addresses.
        if s['dataStatus']['location']!='conflicting-sources':s['address']=c['address']
        for field in ['url','phone','email','description','hours','cost','openDay']:
            if c.get(field):s[field]=c[field]
        s['code']=s['code'] or c.get('code') or None
        s['detailYear']='2026/27; informazioni 2027/28 solo dove esplicitamente indicate'
        s['enriched']=True
        s['dataStatus']['details']='research-2026-11-15'
        s['warnings'].append('Approfondimento del 15 novembre 2026. Orari e costi 2026/27 non confermano le condizioni 2027/28.')
        for idx,event in enumerate(c.get('events',[])):
            s['events'].append({'id':s['id']+'-'+event['date']+'-'+str(idx+1),'date':event['date'],'time':event['time'],'source':event['source']})
        for source in c.get('sources',[]):
            if not any(v['url']==source['url'] for v in s['sources']):s['sources'].append({**source,'checkedAt':CURATED_CHECKED})
        if c['id']=='1270':
            s['status']='needs-review';s['lat']=None;s['lng']=None;s['locationYear']=None
            s['dataStatus']['location']='temporary-site-unconfirmed'
            s['warnings'].append('Lavori a Milesi: verificare sede e ingresso attuali prima della visita; coordinate storiche escluse.')
        if c['id']=='glicine':s['warnings'].append('Progetto parentale: non è una scuola paritaria. Valutare separatamente dalle scuole riconosciute.')
        if c['id']=='madonna-poveri':s['warnings'].append('Operatività attuale non verificata: non presentata come posto disponibile.')
    for s in catalog.values():
        if s['management'] != 'Parentale' and (not s.get('code') or 'mim' not in s['sourceIds']):
            s['warnings'].append('Presenza nel catalogo di origine; stato attuale non riconciliato con l’anagrafe MIM 2026/27. Questo non dimostra una chiusura.')
        s['aliases']=list(dict.fromkeys(a for a in s['aliases'] if a!=s['name']))
        s['warnings']=list(dict.fromkeys(s['warnings']))
    schools=sorted(catalog.values(),key=lambda s:(s['municipality'] or 99,asc(s['name']),s['id']))
    assert len({s['id'] for s in schools})==len(schools)
    assert len({s['slug'] for s in schools})==len(schools)
    assert all((s['lat'] is None)==(s['lng'] is None) for s in schools)
    for s in schools:
        if s['lat'] is not None:assert 45.35<s['lat']<45.6 and 9.0<s['lng']<9.35
    unmatched_base=[{'municipalId':r['CODICE'],'name':r['DENOMINAZIONE'],'address':r['INDIRIZZO'],'management':r['TIPO'],'recognition':r['PARITARIA'],'reason':'No link in the two MIM 2026/27 school-level datasets; not proof of closure'} for r in base if r['CODICE'] not in used_base]
    report={
        'schemaVersion':1,'generatedAt':CHECKED,'targetSchoolYear':'2027/28','catalogueYears':['2025/26','2026/27'],
        'summary':{'municipalInput':len(base),'curatedInput':len(curated),'mimMilanoInfanzia':len(mim_rows),'mimMatchedToMunicipal':len(mappings),'municipalWithoutMimMatch':len(unmatched_base),'addedFromMim':len(added),'additionalCurated':sum(1 for s in schools if s['id'].startswith('extra-')),'total':len(schools),'enriched':sum(s['enriched'] for s in schools),'geolocated':sum(s['lat'] is not None for s in schools),'needsReview':sum(s['status']=='needs-review' for s in schools),'addressConflicts':len(address_conflicts),'provisionalLinks':sum(m.get('confidence')=='provisional-crosswalk' for m in mappings),'unresolvedMim':len(unresolved_mim),'events':sum(len(s['events']) for s in schools)},
        'sources':source_reports,
        'municipalSource':{'url':MUNICIPAL_URL,'snapshot':'research/snapshots/municipal-schools-2025-2026.json','schoolYear':'2025/26','sha256':hashlib.sha256((SNAP/'municipal-schools-2025-2026.json').read_bytes()).hexdigest()},
        'curatedSource':{'snapshot':'research/snapshots/curated-schools-2026-11-15.json','researchedAt':CURATED_CHECKED,'sha256':hashlib.sha256((SNAP/'curated-schools-2026-11-15.json').read_bytes()).hexdigest()},
        'methodology':['Only Comune F205/MILANO and school degree containing INFANZIA from the official MIM CSVs.','Identity precedence: explicit reviewed crosswalk; existing curated mechanographic code; unique normalized address; unique street-token subset plus civic, with compatible management.','Reviewed crosswalks with conflicting addresses are provisional identity associations, except Borsi supported by the previous curated former-site reference; neither is a confirmed current entrance.','No school closure is inferred from an absent MIM match.','MIM-only records have no invented coordinates, neighborhood or municipality. They are not labelled as newly opened.','Address conflicts preserve both source values and withhold historical coordinates; source mismatch is not assumed to be a confirmed transfer.','Existing detailed research is preserved with its original check date; no 2027/28 prices, rules or public deadlines are asserted.'],
        'management':dict(Counter(s['management'] for s in schools)),
        'byMunicipality':{str(i):sum(s['municipality']==i for s in schools) for i in range(1,10)},
        'unknownMunicipality':sum(s['municipality'] is None for s in schools),
        'matches':mappings,'addressConflicts':address_conflicts,'unmatchedMunicipal':unmatched_base,'unmatchedMim':unresolved_mim,'mimOnly':added,'ambiguousCandidates':candidates_report,'curatedMerges':curated_merges,
        'limits':['Not a certified complete 2027/28 catalogue.','The MIM paritarie register does not cover parental projects or all foreign/international schools.','No current vacancies, admission probability or school quality scores.','Location and Municipality for linked historical records originate in 2025/26; location conflicts are withheld.','No automatic full-field research of all schools; enriched detail remains limited to the 35 previous curated entries.'],
    }
    # Preserve all completed, sourced detail research on every catalogue rebuild.
    research_manifest = ROOT / 'research/deepening/assignment-manifest.json'
    if research_manifest.exists() and all((research_manifest.parent / f'{group}.json').exists() for group in read_json(research_manifest)['groups']):
        from school_research import apply_research, publish_research_report
        schools, research_coverage = apply_research(schools)
        publish_research_report(research_coverage)
        report['researchCoverage'] = {key: research_coverage[key] for key in ('checkedAt','reviewed','schoolSpecificDetails','officialLinks','events')}
        report['summary']['enriched'] = sum(s['enriched'] for s in schools)
        report['summary']['events'] = sum(len(s['events']) for s in schools)
        report['summary']['geolocated'] = sum(s['lat'] is not None for s in schools)
        report['summary']['needsReview'] = sum(s['status']=='needs-review' for s in schools)
        report['limits'] = [limit for limit in report['limits'] if 'enriched detail remains limited' not in limit]
        report['limits'].append('Research coverage is tracked per school and field; a reviewed field may remain unpublished or unconfirmed.')
    from school_research import publish_client_catalog, minimize_public_contacts
    minimize_public_contacts(schools)
    publish_client_catalog(schools)
    write_json(OUT/'schools.json',schools)
    write_json(OUT/'reconciliation-report.json',report)
    write_json(RECON/'report.json',report)
    write_json(ROOT/'public/dati/rapporto-riconciliazione.json',report)
    write_json(RECON/'mim-milano-infanzia-2026-2027.json',[{'dataset':kind,**row} for kind,row in mim_rows])
    manifest={'snapshotDate':CHECKED,'sources':source_reports,'files':[{'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in sorted(SNAP.iterdir()) if p.is_file() and p.name!='manifest.json']}
    write_json(SNAP/'manifest.json',manifest)
    print(json.dumps(report['summary'],ensure_ascii=False,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download',action='store_true',help='Download official MIM snapshots before rebuilding; otherwise offline.')
    parser.add_argument('--as-of',help='Source check date YYYY-MM-DD; required with --download. Offline replay defaults to the saved 2026-11-16 snapshot date.')
    args=parser.parse_args()
    if args.download and not args.as_of:parser.error('--download requires --as-of YYYY-MM-DD to keep the provenance date explicit')
    if args.as_of:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',args.as_of):parser.error('Invalid --as-of date')
        CHECKED=args.as_of
    if args.download:
        SNAP.mkdir(parents=True,exist_ok=True)
        for kind,url in MIM_URLS.items():
            with urllib.request.urlopen(url,timeout=90) as response: body=response.read()
            if b'CODICESCUOLA' not in body[:2000] or body.lstrip().startswith(b'<!DOCTYPE'):raise ValueError('Download is not a MIM CSV')
            (SNAP/f'mim-{kind}-2026-2027.csv').write_bytes(body)
    build()
