#!/usr/bin/env python3
"""Offline, deterministic import of intentionally public nursery registers.
See research/nurseries/README.md for acquisition, reconciliation and limits.
Never interprets registered capacity or January offered places as vacancies.
"""
import collections, hashlib, json, pathlib, re, unicodedata
ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = ROOT / 'research/nurseries'
CHECKED = '2026-11-16'
REG_PAGE = 'https://www.regione.lombardia.it/politiche-sociali-e-abitative/strutture-sociali-per-minori,-disabili-e-anziani'
REG_BASE = 'https://www.regione.lombardia.it/content/dam/rl/canali-tematici-servizi/08-politiche-sociali/14-unita-d-offerta-sociale/red-strutture-sociali-per-minori-disabili-e-anziani/allegati/'
MUN_PAGE = 'https://www.comune.milano.it/servizi/scuola/nidi-d-infanzia-e-sezioni-primavera'
DS_PAGE = 'https://dati.comune.milano.it/dataset/ds47-istruzione-asili-nido-localizzazione-delle-strutture'
PDF_URLS = json.loads((BASE/'pdf-urls.json').read_text())
REG_FILES = {'nidi.pdf':'NIDI.pdf','micronidi.pdf':'MICRONIDI.pdf','centri-prima-infanzia.pdf':'CENTRI%20PRIMA%20INFANZIA.pdf','nidi-famiglia.pdf':'NIDI%20FAMIGLIA.pdf'}

def read(name): return json.loads((BASE/name).read_text())
def write(path,data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def norm(s):
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().upper()
    for a,b in [('G.S.','GRAN SAN '),('SS.','SANTISSIMA '),('F.LLI','FRATELLI'),('C.SO','CORSO'),('P.ZA','PIAZZA'),('L.GO','LARGO'),('S.','SAN '),("SANT'",'SAN '),('SANT ','SAN '),('UCELLI','UCCELLI'),('ERLEMBALDO','ERLEMBARDO'),('ZAMBELETTI','ZAMBELLETTI'),('SCIALOIA','SCIALOJA'),('VENTIDUE','XXII')]:s=s.replace(a,b)
    return re.sub(r'[^A-Z0-9]+',' ',s).strip()
def split(s):
    s=norm(s);m=re.search(r'\b\d',s)
    return (s[:m.start()].strip(),s[m.start():].strip()) if m else (s,'')
def tokens(s):return {t for t in norm(s).split() if len(t)>1}-set('VIA VIALE PIAZZA PIAZZALE VICOLO CORSO LARGO DEL DELLA DELLE DEI DI DA SAN NIDO SEZIONE PRIMAVERA'.split())
def slug(s):return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip('-')
def addr_key(s):
    st,num=split(s);return (' '.join(sorted(norm(st).split())),num)
def private_operator(s):
    # Legal form is evidence about the operator only, never about convention.
    n=norm(s)
    return bool(re.search(r'\b(SRL|SRLS|SPA|SNC|SAS|S R L|S R L S|S P A|S N C|S A S|SOCIETA|COOPERATIVA|ASSOCIAZIONE|PARROCCHIA|ONLUS)\b',n))
def legal_operator(s):
    return s if private_operator(s) or re.search(r'\b(COMUNE|FONDAZIONE|ISTITUTO|UNIVERSITA|ENTE|SCUOLA|MERKOS)\b',norm(s)) else None

regional=read('regional-milano-rows.json'); municipal=read('municipal-2026-2027-rows.json'); old=read('ds47-nidi-2016-2019.json')
assert len(regional)==385 and len({r['cudes'] for r in regional})==385
assert len(municipal)==240
# Only inspected, explicit exceptions; these preserve source address disagreements.
OVERRIDES={
 'Nido Colletta, 72':'048750', 'Nido Bergognone, 4/A':'056064',
 'ASILO NIDO HAPPY CHILD 2 - PITTERI':'093751',
 'ASILO NIDO HAPPY CHILD - ALDINI':'067713', 'IL GIARDINO DEI BAMBINI':'055363',
 'LA CASA DEI BALOCCHI':'048020', 'BEBEK - PASOLINI 2':'093505',
 'BEBEK - PASOLINI 86':'096415', 'ASILO NIDO PALAZZO REGIONE LOMBARDIA':'054125',
 "NIDO D'INFANZIA INTERAZIENDALE BAMBINI BICOCCA":'054126',
}
# Four CUDES cannot be individually attached to the suffixes shown by the municipality.
AMBIGUOUS={'Nido SS. Trinità, 5':['054875','052436'],'Nido SS. Trinità, 5 bis':['054875','052436'],
 'Nido Guerzoni, 40':['048730','052414'],'Nido Guerzoni, 40 bis':['048730','052414']}
# Avoid double counting the two regional pairs: replace each pair with the two
# distinct municipal service records, retaining candidate CUDES in the audit only.
excluded={c for vals in AMBIGUOUS.values() for c in vals}
records={r['cudes']:{'r':r,'m':None,'warnings':[]} for r in regional if r['cudes'] not in excluded}
unmatched=[]; matches=[]
for m in municipal:
    a=m.get('address',re.sub(r'^(Nido|Sezione Primavera)\s+','',m['name']))
    if m['name'] in AMBIGUOUS:
        unmatched.append({'m':m,'warnings':['Il Comune distingue questa sede dal civico con/senza bis. Il registro regionale riporta due CUDES allo stesso civico: associazione individuale non risolta.'],'candidateCudes':AMBIGUOUS[m['name']]});continue
    if m['serviceType']=='Sezione primavera':unmatched.append({'m':m,'warnings':[]});continue
    st,num=split(a)
    candidates=[r for r in regional if r['serviceType'] in ['Nido d’infanzia','Micronido','Centro prima infanzia'] and split(r['address'])[1]==num and tokens(st) and tokens(st)<=tokens(split(r['address'])[0])]
    if len(candidates)>1:
        exact=[r for r in candidates if tokens(split(r['address'])[0])==tokens(st)]
        if len(exact)==1:candidates=exact
    chosen=next((r for r in regional if r['cudes']==OVERRIDES.get(m['name'])),None)
    if chosen is None and len(candidates)==1:chosen=candidates[0]
    if chosen is None:
        unmatched.append({'m':m,'warnings':['Identità non associata in modo univoco a un CUDES del registro regionale.']});continue
    code=chosen['cudes']
    if code not in records or records[code]['m'] is not None:raise ValueError(('duplicate match',m,code))
    records[code]['m']=m
    if m['name'] in ['Nido Colletta, 72','Nido Bergognone, 4/A']:
        records[code]['warnings'].append('Corrispondenza provvisoria: indirizzo comunale e regionale discordanti ('+a+' / '+chosen['address']+'). Verificare sede e ingresso.')
    if m['name']=='ASILO NIDO PALAZZO REGIONE LOMBARDIA':records[code]['warnings'].append('Ingressi diversi nelle fonti: Comune via Francesco Restelli 2; registro regionale via Melchiorre Gioia 35. Verificare accesso.')
    if 'temporaneamente' in m['name']:records[code]['warnings'].append('Il Comune segnala un trasferimento temporaneo: '+m['name']+'. Verificare la sede prima della visita.')
    matches.append({'municipalName':m['name'],'cudes':code,'method':'reviewed-exception' if m['name'] in OVERRIDES else 'unique-address-tokens-and-exact-civic'})

# Exact full street+civic only for historical coordinates. No fuzzy location match.
old_by_addr=collections.defaultdict(list)
for r in old:
    if r['CODANNOSCOLASTICO']!=1819:continue
    old_by_addr[addr_key(' '.join([str(r.get('TIPO_VIA')or''),str(r.get('INDIRIZZO')or''),str(r.get('NUMEROCIVICO')or'')]))].append(r)

geo=read('coordinates-geoschool-2026-27.json')['features']
GEO_PAGE='https://www.comune.milano.it/servizi/scuola/geoschool-trova-nidi-e-scuole-dell-infanzia'
def geoname(s):
    s=re.sub(r'^(Nido|Sezione Primavera)\s+','',s,flags=re.I)
    s=re.sub(r' - (Nido d.Infanzia|Sezione Primavera)$','',s,flags=re.I)
    return norm(s)
def geoaddress(a):
    civic=a['civicoindirizzosede'] or ''
    exp=a['esponenteindirizzosede'] or ''
    return a['indirizzosede']+' '+civic+('/'+exp if exp and exp.upper()!='BIS' else ' '+exp if exp else '')
schools=[]
for item in list(records.values())+unmatched:
    r=item.get('r');m=item.get('m');warnings=list(item['warnings'])
    typ=r['serviceType'] if r else m['serviceType']
    address=r['address'] if r else m.get('address',re.sub(r'^(Nido|Sezione Primavera)\s+','',m['name']))
    if m and any(x in m['name'] for x in ['Colletta, 72','Bergognone, 4/A']):address=re.sub('^Nido ','',m['name'])
    if m and 'temporaneamente' in m['name']:
        address='Via Dei Canzi, 28' if 'SACCARDO' in m['name'] else 'Via Monte Popera, 14'
    name=m['name'] if m else r['name'].title()
    if r and not m and (name.lower().startswith("nido d'infanzia") or name=='Nido Comunale' or name=='Sezione Di Nido In Scuola Materna'):name=typ+' — '+address.title()
    identity='nido-cudes-'+r['cudes'] if r else 'nido-comune-'+slug(m['name'])
    management=m['management'] if m else ('Comunale' if r['operator']=='COMUNE DI MILANO' else 'Privata' if private_operator(r['operator']) else 'Da verificare')
    # An operator's legal name alone is not evidence of public/private ownership.
    if not m:warnings.append('Accesso ai posti comunali e titolarità della struttura da verificare. La gestione è classificata solo quando il registro identifica il Comune o una forma giuridica privata; non prova una convenzione.')
    label=m.get('managementLabel') if m else None
    operator=legal_operator(r['operator']) if r else m.get('operator')
    access='Graduatoria comunale' if m else 'Da verificare con il gestore'
    if label=='Privato accreditato':access='Posti in convenzione tramite graduatoria comunale; eventuali posti privati da chiedere al gestore'
    elif label=='Comunale in appalto':access='Graduatoria comunale · gestione in appalto'
    age='24–36 mesi' if typ=='Sezione primavera' else ('3–36 mesi' if typ in ['Nido d’infanzia','Micronido'] else '0–36 mesi; condizioni da verificare con il servizio')
    sources=[]
    if r:sources.append({'label':'Regione Lombardia · registro '+typ+' al 31/10/2026 · pagina '+str(r['page']),'url':REG_BASE+REG_FILES[r['file']]+'#page='+str(r['page']),'year':'2026','checkedAt':CHECKED})
    if m:sources.append({'label':'Comune di Milano · allegato '+str(m['source'])+' iscrizioni 2026/27','url':PDF_URLS['allegato-'+str(m['source'])+'-2026-2027.pdf'],'year':'2026/27','checkedAt':CHECKED})
    # Current public Geoschool: preserve service type and civic suffix; duplicates
    # for age groups must agree on the point. Never use a nearby school as fallback.
    lat=lng=None;location_year=None
    current=[]
    for f in geo:
        a=f['attributes']; ga=geoaddress(a)
        if (typ=='Sezione primavera') != (a['label_servizio']=='Sezione Primavera'):continue
        if m and geoname(m['name'])==geoname(a['nomesede']):
            # Explicit municipal service name includes its civic; require exact
            # civic again to prevent dropped bis or alphabetic suffixes.
            raw=m.get('address',re.sub(r'^(Nido|Sezione Primavera)\s+','',m['name']))
            if split(raw)[1]==split(ga)[1]:current.append(f)
        elif addr_key(address)==addr_key(ga):current.append(f)
    cpoints={(f['geometry']['y'],f['geometry']['x']) for f in current}
    if len(cpoints)==1 and not any(x in ' '.join(item['warnings']) for x in ['provvisoria','trasferimento','Ingressi diversi']):
        lat,lng=next(iter(cpoints)); location_year='2026/27'
        address=geoaddress(current[0]['attributes'])
        sources.append({'label':'Comune di Milano · Geoschool 2026/27, coordinate ufficiali','url':GEO_PAGE,'year':'2026/27','checkedAt':CHECKED})
    # Historical fallback: exact full address and civic, single point, no conflict.
    historic=old_by_addr.get(addr_key(address),[])
    points={(o.get('LAT_WGS84'),o.get('LONG_WGS84')) for o in historic if o.get('LAT_WGS84') and o.get('LONG_WGS84')}
    if location_year is None and len(points)==1 and not item['warnings']:
        lat,lng=next(iter(points));location_year='2018/19'
        sources.append({'label':'Comune di Milano · DS47, coordinate storiche 2018/19','url':DS_PAGE,'year':'2018/19','checkedAt':CHECKED})
        warnings.append('Coordinate storiche 2018/19 associate per indirizzo completo e civico esatti; non costituiscono verifica attuale dell’ingresso.')
    municipality=m['municipality'] if m else None
    zone='Municipio '+str(municipality) if municipality else 'Zona da verificare'
    geography_year='2026/27' if m else None
    # Reuse geographic attributes only from the same exact full-address historical
    # match already admitted for the coordinates. Reject invalid/disagreeing values.
    old_municipalities={o.get('MUNICIPIO') for o in historic}
    if municipality is None and location_year=='2018/19' and not item['warnings'] and len(old_municipalities)==1:
        candidate=next(iter(old_municipalities))
        if isinstance(candidate,int) and 1<=candidate<=9:
            municipality=candidate; geography_year='2018/19'
            nils={str(o.get('NIL') or '').strip() for o in historic}
            zone=next(iter(nils)).title() if len(nils)==1 and '' not in nils else 'Municipio '+str(municipality)
            warnings.append('Municipio e quartiere attribuiti dal DS47 storico 2018/19 sullo stesso indirizzo completo e civico esatti delle coordinate; attribuzione geografica da riconfermare.')
            for source in sources:
                if source['url']==DS_PAGE:source['label']='Comune di Milano · DS47, coordinate e geografia storiche 2018/19'
    warnings.append('Nessuna disponibilità attuale di posti verificata. Capienza del registro e posti del bando non sono posti liberi oggi.')
    if typ=='Nido famiglia':operator=None
    school={'id':identity,'slug':identity+'-'+slug(name),'name':name,'address':address,'zone':zone,'municipality':municipality,'management':management,'recognition':'Accreditato con posti comunali 2026/27' if label=='Privato accreditato' else ('Servizio comunale' if management=='Comunale' else 'Registro UdOS 31/10/2026 · titolarità e convenzione da verificare'),'lat':lat,'lng':lng,'legacyId':None,'code':None,'url':None,'phone':None if typ=='Nido famiglia' else (m.get('phone') if m else r['phone']or None),'email':None,'description':typ+' presente '+('nell’offerta comunale 2026/27.' if m else 'nel registro regionale delle unità di offerta sociali al 31 ottobre 2026. Eventuali limiti di accesso, posti e condizioni vanno verificati con il servizio.'),'hours':None,'cost':None,'services':[],'officialPage':MUN_PAGE if m else REG_PAGE,'openDay':None,'events':[],'sources':sources,'catalogYear':'2026/27' if m else 'Registro 31/10/2026','detailYear':None,'status':'needs-review' if item['warnings'] else 'active','verifiedAt':CHECKED,'enriched':False,'warnings':warnings,'sourceIds':{'municipal': 'nidi-2026-'+slug(m['name'])} if m else {},'aliases':list(dict.fromkeys(([r['name']] if r else [])+([m['name']] if m else []))),'locationYear':location_year,'geographyYear':geography_year,'dataStatus':{'identity':'Registro regionale 31/10/2026'+(' e offerta comunale 2026/27' if m and r else '') if r else 'Offerta comunale 2026/27','details':'Orari, costi e visite da approfondire','location':('Coordinate ufficiali Geoschool 2026/27' if location_year=='2026/27' else 'Coordinate storiche 2018/19') if lat else 'Coordinate non verificate; ricerca per indirizzo'},'educationStage':'nursery','serviceType':typ,'ageRange':age,'accessMode':access,'operator':operator}
    if r:school['sourceIds']['cudes']=r['cudes']
    schools.append(school)
# Validate all research before any output is replaced. A partial shard must not
# silently erase an existing enrichment during an anagraphic replay.
research_report = None
if (BASE/'deepening/assignment-manifest.json').exists():
    from nursery_research import merge_nursery_research
    schools, research_report = merge_nursery_research(schools)
assert len({s['id'] for s in schools})==len(schools)
assert len({s['slug'] for s in schools})==len(schools)
schools.sort(key=lambda s:(s['municipality'] or 10,s['name'].casefold(),s['id']))
client_fields=['id','name','slug','address','zone','municipality','management','recognition','lat','lng','legacyId','code','aliases','enriched','events','educationStage','serviceType','ageRange','accessMode','operator']
write(ROOT/'src/data/nurseries.json',schools)
write(ROOT/'src/data/nurseries-client.json',[{k:s[k] for k in client_fields} for s in schools])
report={'checkedAt':CHECKED,'total':len(schools),'regionalRegisterDate':'2026-10-31','regionalRecords':len(regional),'municipalRecords':len(municipal),'byServiceType':dict(collections.Counter(s['serviceType'] for s in schools)),'byManagement':dict(collections.Counter(s['management'] for s in schools)),'geolocated':sum(s['lat'] is not None for s in schools),'geolocatedCurrent':sum(s['locationYear']=='2026/27' for s in schools),'geolocatedHistorical':sum(s['locationYear']=='2018/19' for s in schools),'confirmedMunicipalAccess':len(municipal),'unknownAccess':sum('Da verificare' in s['accessMode'] for s in schools),'unknownMunicipality':sum(s['municipality'] is None for s in schools),'historicalMunicipality':sum(s['geographyYear']=='2018/19' for s in schools),'sources':[{'label':'Comune di Milano · coordinate Geoschool','url':GEO_PAGE,'year':'2026/27'},{'label':'Regione Lombardia · registri UdOS','url':REG_PAGE,'year':'31/10/2026'},{'label':'Comune di Milano · iscrizioni e allegati pubblici','url':MUN_PAGE,'year':'2026/27'},{'label':'Comune di Milano · DS47 coordinate storiche','url':DS_PAGE,'year':'2018/19'}],'limits':['Il totale conta schede di servizio, non edifici o sedi fisiche uniche. Nido e primavera possono condividere indirizzo e gestori possono avere più unità registrate allo stesso civico.','Registri regionali al 31/10/2026 e offerta comunale 2026/27: nessuna conferma automatica per il 2027/28.','Le convenzioni sono documentate solo per le sedi presenti negli allegati comunali. Le altre non sono considerate automaticamente private, non accreditate o escluse dal canale comunale.','45 sezioni primavera comunali aggiunte separatamente: la fonte regionale NIDI non censisce sistematicamente questo tipo di servizio.','Coordinate Geoschool 2026/27 quando servizio e civico corrispondono; solo in assenza di corrispondenza attuale, DS47 storico 2018/19 con indirizzo completo esatto. Nessuna geocodifica approssimata.','Municipio e NIL storici sono riusati solo per gli stessi indirizzi completi e civici ammessi per le coordinate DS47 2018/19, con Municipio valido e concordante. Le attribuzioni storiche sono esplicitamente segnalate.','Nessuna retta, tariffa, probabilità di ammissione, posto libero o appuntamento attribuito dal registro.','Nido famiglia: omesso il nome del gestore per evitare esposizione non necessaria di persone fisiche; registri intenzionalmente pubblicati dalla Regione.'],'unresolvedCudesGroups':[{'municipalNames':[k for k,v in AMBIGUOUS.items() if v==cs],'candidateCudes':cs,'handling':'Due schede comunali sostituiscono due record regionali; nessuna associazione CUDES individuale forzata.'} for cs in [['054875','052436'],['048730','052414']]],'sameAddressRegionalGroups':[{'address':a,'cudes':[r['cudes'] for r in rows]} for a,rows in __import__('itertools').groupby([],lambda x:x)]}
byaddr=collections.defaultdict(list)
for r in regional:byaddr[norm(r['address'])].append(r)
report['sameAddressRegionalGroups']=[{'address':a,'cudes':[r['cudes'] for r in rows]} for a,rows in sorted(byaddr.items()) if len(rows)>1]
report['unresolvedAddressRecords']=[{'id':s['id'],'name':s['name'],'warnings':[w for w in s['warnings'] if any(x in w for x in ['provvisoria','Ingressi diversi','trasferimento','non associata','non risolta'])]} for s in schools if s['status']=='needs-review']
write(ROOT/'public/dati/copertura-nidi.json',report)
write(BASE/'reconciliation.json',{'checkedAt':CHECKED,'matches':matches,'unmatchedMunicipal':[{'name':x['m']['name'],'type':x['m']['serviceType'],'warnings':x['warnings']} for x in unmatched], 'summary':{k:report[k] for k in ['total','byServiceType','byManagement','geolocated']}})
print(json.dumps({k:report[k] for k in ['total','byServiceType','byManagement','geolocated','confirmedMunicipalAccess','unknownAccess']},ensure_ascii=False,indent=2))

if research_report is not None:
    from nursery_research import publish_nursery_research, update_inventory_report
    publish_nursery_research(schools, research_report)
    update_inventory_report(schools, research_report)
