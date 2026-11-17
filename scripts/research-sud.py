#!/usr/bin/env python3
"""Read-only fetch of public official school pages; evidence stays in sud/ only."""
import concurrent.futures, hashlib, json, pathlib, ssl, sys, urllib.request, urllib.parse, re, unicodedata
import certifi
from html.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'research/deepening/evidence/sud'
OUT.mkdir(parents=True,exist_ok=True)
class Text(HTMLParser):
 def __init__(self):super().__init__();self.text=[];self.links=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
  if t=='a':
   v=dict(a).get('href')
   if v:self.links.append(v)
 def handle_endtag(self,t):
  if t in ('script','style') and self.skip:self.skip-=1
 def handle_data(self,d):
  if not self.skip and d.strip():self.text.append(d.strip())
def fetch(u):
 name=hashlib.sha256(u.encode()).hexdigest()[:16]
 p=OUT/(name+'.json')
 if p.exists():
  old=json.loads(p.read_text())
  if old.get('status')!='error':return old
 r={'requestedUrl':u}
 try:
  req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (compatible; public school research)'})
  with urllib.request.urlopen(req,timeout=25,context=ssl.create_default_context(cafile=certifi.where())) as h:
   b=h.read(20_000_000);r.update(url=h.url,status=h.status,contentType=h.headers.get('content-type',''))
  if r['contentType'].startswith('image/'):
   ext='.png' if 'png' in r['contentType'] else '.jpg';(OUT/(name+ext)).write_bytes(b);r['text']='Image downloaded; inspect visually';r['links']=[]
  elif 'pdf' in r['contentType'] or r['url'].split('?')[0].endswith('.pdf'):
   (OUT/(name+'.pdf')).write_bytes(b);r['text']='PDF downloaded; extract separately';r['links']=[]
  else:
   parser=Text();parser.feed(b.decode('utf-8',errors='replace'))
   r['text']='\n'.join(parser.text);r['links']=list(dict.fromkeys(urllib.parse.urljoin(r['url'],x) for x in parser.links if not x.startswith(('#','mailto:','tel:','javascript:'))))
 except Exception as e:r.update(status='error',error=str(e))
 p.write_text(json.dumps(r,ensure_ascii=False,indent=2));return r

def assemble():
 """Normalize researched facts, never infer school facilities from generic boilerplate."""
 schools=[s for s in json.loads((ROOT/'src/data/schools.json').read_text()) if s['municipality'] in (4,5,6)]
 directory=json.loads((ROOT/'research/deepening/shared/brave/municipal-directory.json').read_text())
 rules=json.loads((ROOT/'research/deepening/shared/municipal-rules.json').read_text())
 def tokens(x):return re.findall(r'[a-z]+|[0-9]+',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower())
 def match(s):
  t=[v for v in tokens(s['name'].split('(')[0]) if v not in ('s','via','dei','di','degli','della','del','v','c')]
  def score(q):
   z=tokens(q['name']);return sum(3 if k.isdigit() else 2 for k in t if k in z)/max(1,sum(3 if k.isdigit() else 2 for k in t))
  q=max(directory,key=score)
  if score(q)<.55:raise ValueError('Uncertain municipal match: '+s['name'])
  return q
 out=[]
 for s in schools:
  if s['management']!='Comunale':continue
  q=match(s);slug=q['url'].split('/')[-1]
  evidence=json.loads((ROOT/f'research/deepening/shared/brave/municipal-pages/{slug}.json').read_text())
  text=evidence['text'];body=text[text.rfind('I nostri spazi\n'):]
  intro=body.split('Il collegio')[0]
  # Exclude pedagogical explanations mentioning hypothetical gardens/courtyards.
  common=body.rsplit('Gli spazi comuni: descrizione e foto',1)[-1].split('Gli spazi esterni: descrizione e foto')[0]
  positive='\n'.join(p for p in common.split('\n\n') if p.lower().startswith(('nella scuola','sono inoltre','è presente','e presente','il salone','inoltre','sul terrazzo')))
  outdoor=body.rsplit('Gli spazi esterni: descrizione e foto',1)[-1].split('Dove siamo')[0]
  positive+='\n'+'\n'.join(p for p in outdoor.split('\n\n') if p.lower().startswith(('nella scuola','sono presenti','il giardino','gli spazi esterni della scuola')))
  facts=intro+'\n'+positive
  services=[]
  for pattern,label in [
   (r'biblioteca','Biblioteca / spazio lettura'),(r'spazio lettura','Spazio lettura'),
   (r'atelier','Atelier espressivo'),(r'laborator','Spazi laboratorio'),
   (r'motor|motric','Spazio per attività motorie'),(r'giardin','Giardino'),
   (r'cortil','Cortile'),(r'terrazz','Terrazza'),(r'orto|orti\b','Orto didattico'),
   (r'falegnameria','Laboratorio di falegnameria'),(r'cucito','Laboratorio di cucito'),
   (r'luce|luci|ombre|proiezioni','Esperienze di luce e proiezioni'),
   (r'travasi','Spazio travasi'),(r'scientific','Esperienze di esplorazione scientifica'),
   (r'montessorian','Spazio con materiali montessoriani')]:
   if re.search(pattern,facts,re.I):
    if label=='Spazio lettura' and 'Biblioteca / spazio lettura' in services:continue
    services.append(label)
  if re.search(r'(?:nella sezione|in ogni sezione)[^.\n]*spazio dedicato al riposo',body,re.I):services.append('Spazio per il riposo in sezione')
  elif re.search(r'in alcune sezioni[^.\n]*spazio dedicato al riposo',body,re.I):services.append('Spazio riposo in alcune sezioni: verificare l’organizzazione del gruppo')
  if 'Il pranzo viene fornito da Milano Ristorazione' in body:services.append('Pasti forniti da Milano Ristorazione, secondo la scheda di sede')
  count=re.search(r'suddivis[ie] in\s+([a-zà]+|\d+)\s+sezioni',body,re.I)
  count=count.group(1) if count else None
  floors='su due piani' if re.search(r'sezioni[^.\n]{0,55}due\s+piani',intro,re.I) else 'su un piano' if re.search(r'sezioni[^.\n]{0,55}un unico piano',intro,re.I) else ''
  desc=('La scheda comunale descrive '+count+' sezioni'+(' '+floors if floors else '')+'. ') if count else ''
  if services:desc+='Tra gli spazi documentati: '+', '.join(x.lower() for x in services if not x.startswith('Pasti'))+'.'
  warnings=[]
  sourceMunicipality=re.search(r'Municipio\s+(\d)',text)
  if sourceMunicipality and int(sourceMunicipality.group(1))!=s['municipality']:warnings.append(f"Municipio discordante: anagrafe {s['municipality']}, scheda attuale {sourceMunicipality.group(1)}. Verificare prima di usare il filtro territoriale.")
  if 'temporaneamente' in body.lower():
   where=re.search(r'temporaneamente in via\s+([^\n.*]+)',text,re.I)
   if where:warnings.append('Sede temporanea indicata dal Comune: via '+where.group(1).strip()+'. Confermare l’ingresso prima della visita.')
  if s['id']=='mi-1199':warnings.append('La scuola è denominata Ucelli di Nemi 44, ma l’indirizzo nell’anagrafe è 48: confermare il civico di ingresso.')
  if s['id']=='mi-1070':warnings.append('Denominazione Colletta 53, indirizzo della scheda 49–51: verificare il punto di ingresso.')
  if s['enriched'] and s['description']:desc=s['description']+' '+desc
  year=(evidence.get('updated') or '')[-4:]
  if not re.fullmatch(r'20\d\d',year):year='2026' if '2026' in text[:450] else None
  general=[{k:v for k,v in x.items() if k!='access'} for x in rules['sources']]
  url=q['url']
  out.append(dict(id=s['id'],checkedAt='2026-11-16',officialUrl='https://www.comune.milano.it',officialPage=url,hours=rules['hours'],cost=rules['cost'],services=services,description=desc or None,openDay=rules['openDay'],events=s['events'] if s['enriched'] else [],sources=[dict(label='Comune · scheda specifica della scuola, letta in Brave',url=url,checkedAt='2026-11-16',**({'year':year} if year else {})),*general],fieldEvidence={
   'hours':dict(status='operator-rule',sourceUrls=[rules['sources'][0]['url']],year='2026/27'),
   'cost':dict(status='operator-rule',sourceUrls=[rules['sources'][1]['url'],rules['sources'][2]['url']],year='2026/27'),
   'services':dict(status='verified',sourceUrls=[url],year=year),
   'openDay':dict(status='operator-rule',sourceUrls=[rules['sources'][3]['url']],year='2026/27'),
  },attempts=[dict(url=url,status='read',notes='Lettura reale in Brave; testo integrale in shared/brave/municipal-pages/'+slug+'.json'),*[dict(url=x['url'],status='read' if x.get('access')=='read' else 'indexed',notes='Regola di rete: non verifica locale di orari, quote o date future.') for x in rules['sources']]],warnings=warnings))
 for p in sorted(OUT.glob('private-batch-*.json')):out+=json.loads(p.read_text())
 overrides=OUT/'corrections.json'
 if overrides.exists():
  changes=json.loads(overrides.read_text())
  for row in out:
   if row['id'] in changes:row.update(changes[row['id']])
 # Check provenance against actual downloaded evidence; indexed never becomes a claimed read.
 downloads={}
 brave={}
 for p in (ROOT/'research/deepening/shared/brave').glob('*.json'):
  try:r=json.loads(p.read_text())
  except Exception:continue
  if isinstance(r,dict) and r.get('url') and r.get('text'):brave[r['url'].rstrip('/')]=p.name
 for p in OUT.glob('*.json'):
  try:r=json.loads(p.read_text())
  except Exception:continue
  if isinstance(r,dict) and r.get('requestedUrl'):
   downloads[r['requestedUrl'].rstrip('/')]=r
   if r.get('url'):downloads[r['url'].rstrip('/')]=r
 for row in out:
  if next(s for s in schools if s['id']==row['id'])['management']=='Comunale':continue
  for attempt in row['attempts']:
   if attempt['url'].rstrip('/') in brave:
    attempt['status']='read';attempt['notes']='Lettura reale in Brave, evidenza shared/brave/'+brave[attempt['url'].rstrip('/')];continue
   r=downloads.get(attempt['url'].rstrip('/'))
   if r:
    attempt['status']='read' if r.get('status')==200 else 'blocked' if any(x in r.get('error','') for x in ['403','Connection','closed']) else 'error'
    if r.get('status')!=200:attempt['notes']=r.get('error','Acquisizione fallita')
   elif attempt['status']=='read':attempt['status']='indexed';attempt['notes']='Contenuto individuato nell’indicizzazione web ufficiale; nessun download diretto salvato.'
  if row['id']=='mi-1224':
   for url in [row['officialPage'],'https://icviapalmieri.edu.it/argomento/open-day/']:
    row['attempts'].append(dict(url=url,status='indexed',notes='Avviso ufficiale letto nell’indice web: orario 2026/27 nel comunicato del 02.09.2026; archivio open day con evento passato 09.02.2026. Evidenze search-08 e search-15.'))
 ids=[r['id'] for r in out]
 if len(ids)!=len(set(ids)):raise ValueError('Duplicate IDs')
 target=ROOT/'research/deepening/sud.json';target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'records':len(out),'municipal':sum(s['management']=='Comunale' for s in schools),'other':len(out)-56,'missing':[s['id'] for s in schools if s['id'] not in ids]},ensure_ascii=False))

if __name__=='__main__':
 if sys.argv[1:]==['--assemble']:assemble();sys.exit()
 urls=sys.argv[1:]
 if urls==['--known']:
  a=json.loads((ROOT/'src/data/schools.json').read_text());urls=[s['url'] for s in a if s['municipality'] in (4,5,6) and s['management']!='Comunale' and s['url']]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  for r in pool.map(fetch,dict.fromkeys(urls)):print(json.dumps({k:v for k,v in r.items() if k not in ('text','links')},ensure_ascii=False),flush=True)
