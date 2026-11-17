#!/usr/bin/env python3
"""Deterministic census of the 23 bordering municipalities, from public registers.

Run with Python 3. PDF extraction (only --extract) requires pdfplumber.
Default replay is offline and uses the deliberately minimal structured snapshot.
No inference of vacancies, ownership, convention or geographic positions.
"""
import argparse, collections, csv, hashlib, json, pathlib, re, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = ROOT / 'research/neighbors'
CHECKED = '2026-11-17'
REG_PAGE = 'https://www.regione.lombardia.it/politiche-sociali-e-abitative/strutture-sociali-per-minori,-disabili-e-anziani'
REG_BASE = 'https://www.regione.lombardia.it/content/dam/rl/canali-tematici-servizi/08-politiche-sociali/14-unita-d-offerta-sociale/red-strutture-sociali-per-minori-disabili-e-anziani/allegati/'
FILES = {'nidi.pdf': ('Nido d’infanzia', 'NIDI.pdf'), 'micronidi.pdf': ('Micronido', 'MICRONIDI.pdf'), 'centri-prima-infanzia.pdf': ('Centro prima infanzia', 'CENTRI%20PRIMA%20INFANZIA.pdf'), 'nidi-famiglia.pdf': ('Nido famiglia', 'NIDI%20FAMIGLIA.pdf')}
MIM_URL = {k: 'https://dati.istruzione.it/opendata/opendata/catalog/'+v for k,v in [('statali','SCUANAGRAFESTAT'),('paritarie','SCUANAGRAFEPAR')]}

def read(path): return json.loads(path.read_text())
def write(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
def norm(s): return re.sub(r'[^A-Z0-9]+',' ',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().upper()).strip()
def slug(s): return norm(s).lower().replace(' ','-')
def clean(s): return re.sub(r'\s+',' ',s or '').strip()
def institutional_operator(s):
    # Only entities, never a sole proprietor or natural person's name.
    return s if re.search(r'\b(COMUNE|FONDAZIONE|ISTITUTO|UNIVERSITA|ENTE|SCUOLA|SOCIETA|COOPERATIVA|ASSOCIAZIONE|PARROCCHIA|ONLUS|SRL|S R L|SNC|S N C|SPA|S P A|SAS|S A S)\b',norm(s)) else None

def main():
    args=argparse.ArgumentParser();args.add_argument('--extract',action='store_true');opts=args.parse_args()
    towns=read(ROOT/'src/data/territorial-access.json')['municipalities']
    names={norm(t['name']):t for t in towns};assert len(names)==23
    if opts.extract:
        import pdfplumber
        regional=[]
        for filename,(typ,_) in FILES.items():
            with pdfplumber.open(ROOT/'research/nurseries'/filename) as pdf:
                for page_no,page in enumerate(pdf.pages,1):
                    for table in page.extract_tables():
                        for row in table:
                            if len(row)!=12 or norm(clean(row[3])) not in names:continue
                            # Exclude contacts, capacities and names of natural persons.
                            operator=institutional_operator(clean(row[10])) if typ!='Nido famiglia' else None
                            regional.append({'comune':names[norm(clean(row[3]))]['name'],'name':clean(row[4]),'address':clean(row[6]),'operator':operator,'cudes':clean(row[11]),'serviceType':typ,'file':filename,'page':page_no})
            print(filename, len(regional), flush=True)
        assert len({r['cudes'] for r in regional})==len(regional)
        write(BASE/'regional-rows.json',regional)
    regional=read(BASE/'regional-rows.json')
    schools=[]
    for source_type in ['statali','paritarie']:
        with (ROOT/f'research/snapshots/mim-{source_type}-2026-2027.csv').open(encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                town=names.get(norm(row['DESCRIZIONECOMUNE']))
                if not town or 'INFANZIA' not in row['DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA']:continue
                code=row['CODICESCUOLA']; management='Statale' if source_type=='statali' else 'Da verificare'
                source={'label':'MIM · anagrafica scuole '+source_type+' 2026/27','url':MIM_URL[source_type],'year':'2026/27','checkedAt':CHECKED}
                school=base('hinterland-mim-'+code.lower(),row['DENOMINAZIONESCUOLA'],row['INDIRIZZOSCUOLA'],town,'preschool','Scuola dell’infanzia',management,[source])
                school.update(code=code,sourceIds={'mim':code},recognition='Statale' if source_type=='statali' else 'Paritaria · titolarità da verificare',ageRange='3–6 anni',catalogYear='2026/27',description='Scuola dell’infanzia presente nell’anagrafica MIM 2026/27. Criteri di ammissione, servizi e condizioni vanno verificati con la scuola.',officialPage='https://unica.istruzione.gov.it/cercalatuascuola/istituti/'+code+'/',accessMode='Domanda alla scuola; ammissione secondo disponibilità e criteri dell’istituto' if source_type=='statali' else 'Da verificare con la scuola')
                site=clean(row.get('SITOWEBSCUOLA',''))
                if site and site.lower() not in ['non disponibile','null']:school['url']=site if site.startswith('http') else 'https://'+site
                if source_type=='paritarie':school['warnings'].append('La parità scolastica non identifica la titolarità comunale o privata e non dimostra l’esistenza di posti convenzionati.')
                schools.append(school)
    for r in regional:
        town=names[norm(r['comune'])];typ=r['serviceType'];operator=r['operator']
        management='Comunale' if operator and norm(operator)==norm('COMUNE DI '+town['name']) else 'Da verificare'
        source={'label':'Regione Lombardia · registro '+typ+' al 31/10/2026 · pagina '+str(r['page']),'url':REG_BASE+FILES[r['file']][1]+'#page='+str(r['page']),'year':'2026','checkedAt':CHECKED}
        school=base('hinterland-cudes-'+r['cudes'],r['name'],r['address'],town,'nursery',typ,management,[source])
        school.update(operator=operator,sourceIds={'cudes':r['cudes']},recognition='Registro UdOS 31/10/2026 · convenzione da verificare',ageRange='3–36 mesi' if typ in ['Nido d’infanzia','Micronido'] else '0–36 mesi; condizioni da verificare',accessMode='Da verificare con il Comune e con il servizio',catalogYear='Registro 31/10/2026',description=typ+' presente nel registro regionale delle unità di offerta sociali al 31 ottobre 2026. Accesso, convenzioni e condizioni vanno verificati con il servizio.',officialPage=REG_PAGE)
        school['warnings'].append('La presenza nel registro regionale non conferma l’accesso tramite graduatoria comunale né una convenzione.')
        schools.append(school)
    overrides=read(BASE/'service-overrides.json') if (BASE/'service-overrides.json').exists() else {}
    for s in schools:
        if s['id'] in overrides:
            o=overrides[s['id']]
            for k,v in o.get('fields',{}).items():
                assert k in ['management','operator','accessMode','officialPage','hours','cost','recognition']
                s[k]=v
            s['sources'].extend(o['sources']);s['warnings'].extend(o.get('warnings',[]))
    # Current-location corrections are separate from the preserved registry snapshots.
    address_path=BASE/'coordinate-round-3/reviewed-addresses.json'
    address_corrections=read(address_path) if address_path.exists() else {}
    assert set(address_corrections) <= {s['id'] for s in schools}, 'Unknown corrected identity'
    for s in schools:
        if s['id'] in address_corrections:
            c=address_corrections[s['id']]
            assert s['address']==c['previousAddress'] and s['comune']==c['previousComune'], s['id']
            previous_address=s['address'];previous_comune=s['comune']
            s['address']=c['newAddress'];s['comune']=c['newComune'];s['comuneSlug']=c['newComuneSlug']
            if s['zone']==previous_comune:s['zone']=s['comune']
            s['addressReview']={k:c[k] for k in ['previousAddress','previousComune','reviewedAt','reason','sources']}
            s['sources'].extend(c['sources'])
            s['aliases']=list(dict.fromkeys(s['aliases']+[previous_address+', '+previous_comune]))
            s['warnings']=[w for w in s['warnings'] if w not in c.get('obsoleteWarnings', [])]
    # Geographic matches are reviewed external snapshots, never generated points.
    geo=read(BASE/'coordinates.json') if (BASE/'coordinates.json').exists() else {}
    if (BASE/'nursery-location-candidates.json').exists():
        candidates=read(BASE/'nursery-location-candidates.json')
        for key,g in candidates.items():
            assert key not in geo, ('duplicate coordinate source',key)
            geo[key]=g
    round_two = BASE/'coordinate-round-2/reviewed-coordinates.json'
    if round_two.exists():
        reviewed = read(round_two)
        assert not (set(geo) & set(reviewed)), 'Reviewed coordinates cannot overwrite an existing position'
        assert set(reviewed) <= {s['id'] for s in schools}, 'Unknown reviewed school identity'
        geo.update(reviewed)
    round_three = BASE/'coordinate-round-3/reviewed-coordinates.json'
    if round_three.exists():
        reviewed = read(round_three)
        assert not (set(geo) & set(reviewed)), 'Round 3 cannot overwrite an existing position'
        assert set(reviewed) <= {s['id'] for s in schools}, 'Unknown reviewed school identity'
        geo.update(reviewed)
    for s in schools:
        if s['id'] in geo:
            g=geo[s['id']];assert 45.2<g['lat']<45.8 and 8.7<g['lng']<9.6 and g['source']['url'] and g['method']
            s.update(lat=g['lat'],lng=g['lng'],locationYear=g.get('year'),locationSource=g['source'])
            s['sources'].append(g['source']);s['sources'].extend(g.get('additionalSources', []));s['dataStatus']['location']=g['method']
            s['warnings'].extend(g.get('warnings', []))
            s['warnings']=[w for w in s['warnings'] if w!='Coordinate della sede non ancora verificate.']
            if g.get('year')=='2024/25':s['warnings'].append('La posizione dell’edificio proviene da dati 2024/25. Verificare che sede e ingresso siano ancora attuali.')
    schools.sort(key=lambda s:(s['comune'],s['educationStage'],s['name'],s['id']))
    assert len({s['id'] for s in schools})==len(schools)
    assert len({s['slug'] for s in schools})==len(schools)
    assert set(s['comune'] for s in schools)==set(t['name'] for t in towns)
    assert all(s['municipality'] is None and s['address'] and s['sources'] for s in schools)
    write(ROOT/'src/data/neighbor-schools.json',schools)
    fields=['id','name','slug','address','zone','municipality','comune','comuneSlug','management','recognition','lat','lng','legacyId','code','aliases','enriched','events','educationStage','serviceType','ageRange','accessMode','operator']
    write(ROOT/'src/data/neighbor-schools-client.json',[{k:s[k] for k in fields} for s in schools])
    audit={'checkedAt':CHECKED,'total':len(schools),'geolocated':sum(s['lat'] is not None for s in schools),'byServiceType':dict(collections.Counter(s['serviceType'] for s in schools)),'byManagement':dict(collections.Counter(s['management'] for s in schools)),'municipalities':[],'unlocatedIds':[s['id'] for s in schools if s['lat'] is None]}
    for t in towns:
        ss=[s for s in schools if s['comune']==t['name']]
        audit['municipalities'].append({'comune':t['name'],'total':len(ss),'preschools':sum(s['educationStage']=='preschool' for s in ss),'nurseries':sum(s['educationStage']=='nursery' for s in ss),'geolocated':sum(s['lat'] is not None for s in ss),'missingCoordinates':sum(s['lat'] is None for s in ss),'identitySources':'MIM 2026/27 e registro UdOS 31/10/2026','status':'Censimento anagrafico dei registri; copertura di sezioni primavera e servizi non presenti nei registri da verificare'})
    round_two_report = BASE/'coordinate-round-2/summary.json'
    if round_two_report.exists():
        audit['coordinateResearch'] = read(round_two_report)
    round_three_report = BASE/'coordinate-round-3/summary.json'
    if round_three_report.exists():
        audit['coordinateResearchHistory']=[audit['coordinateResearch']] if 'coordinateResearch' in audit else []
        audit['coordinateResearch']=read(round_three_report)
    write(BASE/'coverage.json',audit)
    write(ROOT/'src/data/neighbor-coverage.json',audit)
    print(json.dumps({k:v for k,v in audit.items() if k not in ['municipalities','unlocatedIds']},ensure_ascii=False,indent=2))

def base(identity,name,address,town,stage,typ,management,sources):
    return {'id':identity,'slug':identity+'-'+town['slug']+'-'+slug(name),'name':name,'address':address,'zone':town['name'],'municipality':None,'comune':town['name'],'comuneSlug':town['slug'],'educationStage':stage,'serviceType':typ,'ageRange':'','accessMode':'Da verificare','operator':None,'management':management,'recognition':'Da verificare','lat':None,'lng':None,'legacyId':None,'code':None,'url':None,'phone':None,'email':None,'description':'','hours':None,'cost':None,'services':[],'officialPage':None,'openDay':None,'events':[],'sources':sources,'catalogYear':'2026/27','detailYear':None,'status':'needs-review','verifiedAt':CHECKED,'enriched':False,'warnings':['Coordinate della sede non ancora verificate.','Nessuna disponibilità attuale di posti verificata.','Orari, tariffe, agevolazioni e regole specifiche della sede da verificare.'],'sourceIds':{},'aliases':[name],'locationYear':None,'geographyYear':'2026/27','dataStatus':{'identity':'Anagrafica ufficiale; servizio distinto per codice identificativo','details':'Condizioni specifiche della sede da approfondire','location':'Coordinate non verificate; sede consultabile per indirizzo'}}

if __name__=='__main__':main()
