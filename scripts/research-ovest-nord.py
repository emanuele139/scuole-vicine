#!/usr/bin/env python3
"""Read official school pages for assigned western/northern Milano catalogue.
Caches response bodies under /tmp only. Evidence/output is curated separately.
"""
import concurrent.futures, json, re, hashlib, time, urllib.request, urllib.parse
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/tmp/scuole-ovest-nord-cache');CACHE.mkdir(exist_ok=True)
class Extract(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.text=[];self.links=[];self.title=[];self.intitle=False
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ['script','style','noscript','svg']:self.skip+=1
  if tag=='title':self.intitle=True
  if tag=='a' and a.get('href'):self.links.append({'href':a['href'],'text':''})
  if tag in ['p','br','h1','h2','h3','li','tr','div','section']:self.text.append('\n')
 def handle_endtag(self,tag):
  if tag in ['script','style','noscript','svg'] and self.skip:self.skip-=1
  if tag=='title':self.intitle=False
 def handle_data(self,data):
  if self.skip:return
  if self.intitle:self.title.append(data)
  self.text.append(data)
  if self.links:self.links[-1]['text']=(self.links[-1]['text']+' '+data)[-200:]
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest();file=CACHE/(key+'.json')
 if file.exists():return json.loads(file.read_text())
 result={'url':url,'checkedAt':'2026-11-16'}
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (school-catalog-research; reading public school information)'})
  with urllib.request.urlopen(req,timeout=22) as res:
   raw=res.read(20000000);result.update(status=res.status,finalUrl=res.url,contentType=res.headers.get('Content-Type',''))
  if 'pdf' in result['contentType'] or raw[:4]==b'%PDF':
   (CACHE/(key+'.pdf')).write_bytes(raw);result['pdfPath']=str(CACHE/(key+'.pdf'));result['text']=''
  else:
   html=raw.decode('utf-8',errors='replace');p=Extract();p.feed(html)
   result['title']=' '.join(p.title);result['text']=re.sub(r'\n\s*\n+','\n',''.join(p.text));result['links']=[{'url':urllib.parse.urljoin(result['finalUrl'],v['href']),'text':v['text'].strip()} for v in p.links]
 except Exception as exc:result.update(status='error',error=str(exc),text='',links=[])
 file.write_text(json.dumps(result,ensure_ascii=False,indent=2))
 return result
def compile_output():
 import unicodedata
 EVID=ROOT/'research/deepening/evidence/ovest-nord';EVID.mkdir(parents=True,exist_ok=True)
 targets=[s for s in json.load(open(ROOT/'src/data/schools.json')) if s['municipality'] in [7,8,9,None]]
 common=json.load(open(ROOT/'research/deepening/shared/municipal-rules.json'))
 annotations=json.load(open(EVID/'annotations.json')) if (EVID/'annotations.json').exists() else {}
 articles=json.load(open('/tmp/ovest-municipal-pages.json')).get('articles',[]) if Path('/tmp/ovest-municipal-pages.json').exists() else []
 article_by_url={a['url']:a for a in articles}
 directory=json.load(open(ROOT/'research/deepening/shared/brave/municipal-directory.json')) if (ROOT/'research/deepening/shared/brave/municipal-directory.json').exists() else []
 old={str(s['CODICE']):s for s in json.load(open(ROOT/'research/snapshots/municipal-schools-2025-2026.json'))}
 def fe(status,urls=[],year=None):return {'status':status,'sourceUrls':list(dict.fromkeys(urls)),'year':year}
 def words(t):return set(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',str(t).lower()).encode('ascii','ignore').decode()))-{'scuola','dell','infanzia','via','viale','di','da','de','del','delle','degli','della','dei','d','a'}
 def directory_match(s):
  if any(s['url']==d['url'] for d in directory):return next(d for d in directory if d['url']==s['url'])
  o=old.get(s['sourceIds'].get('municipal'),{});allwords=words(s['name']+' '+s['address']+' '+o.get('DENOMINAZIONE','')+' '+o.get('INDIRIZZO',''))
  matches=[d for d in directory if words(d['name']) and words(d['name'])<=allwords]
  return matches[0] if len(matches)==1 else None
 results=[]
 for s in targets:
  prior=s['enriched'];url=s['url'] if s['url'] and '@' not in s['url'] else None
  entry={'id':s['id'],'checkedAt':'2026-11-16','officialUrl':url,'officialPage':None,'hours':s['hours'] if prior else None,'cost':s['cost'] if prior else None,'services':[],'description':s['description'] if prior else None,'openDay':s['openDay'] if prior else None,'events':[{k:v for k,v in e.items() if k!='id'} for e in s['events']] if prior else [],'sources':[],'fieldEvidence':{k:fe('prior-research' if prior else 'not-found',[src['url'] for src in s['sources']] if prior else [],'2026/27' if prior else None) for k in ['hours','cost','services','openDay']},'attempts':[],'warnings':[],'researchComplete':False}
  if prior:
   entry['sources']=[{**src,'checkedAt':src.get('checkedAt','2026-11-15')} for src in s['sources']]
   entry['warnings'].append('Informazioni della ricerca del 15 novembre conservate. La verifica del 16 novembre riguarda solo i campi con nuove evidenze esplicite.')
  if url:
   p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.json')
   if p.exists():
    r=json.load(open(p));entry['attempts'].append({'url':url,'status':'read' if r['status']==200 else 'blocked' if '403' in r.get('error','') else 'error','notes':r.get('title') or r.get('error','')})
    if r['status']==200:entry['officialPage']=r.get('finalUrl',url)
  if s['management']=='Comunale':
   entry.update(hours=common['hours'],cost=common['cost'],services=list(common['services']),openDay=common['openDay'])
   for src in common['sources']:
    clean={k:v for k,v in src.items() if k!='access'}
    entry['sources'].append(clean)
    entry['attempts'].append({'url':src['url'],'status':src.get('access','indexed'),'notes':'Regola di rete comunale, non verifica individuale di sede.'})
   entry['fieldEvidence']={k:fe('operator-rule',[v['url'] for v in common['sources'] if (('orari' in v['label']) if k=='hours' else ('quote' in v['label'] or 'refezione' in v['label']) if k=='cost' else 'open day' in v['label'] if k=='openDay' else 'orari' in v['label'] or 'refezione' in v['label'])],'2026/27') for k in ['hours','cost','services','openDay']}
   d=directory_match(s)
   if d:
    entry['officialUrl']=entry['officialPage']=d['url'];a=article_by_url.get(d['url']);body=a['body'] if a else '';access='indexed'
    bp=ROOT/'research/deepening/shared/brave/municipal-pages'/(d['url'].rstrip('/').split('/')[-1]+'.json')
    if bp.exists():
     br=json.load(open(bp));body=br.get('text','');access='read'
    if body:
     entry['attempts'].append({'url':d['url'],'status':access,'notes':'Scheda individuale Comune letta in Brave.' if access=='read' else 'Contenuto esteso indicizzato; accesso diretto Comune bloccato.'})
     entry['sources'].append({'label':'Comune · scheda della sede','url':d['url'],'checkedAt':'2026-11-16'})
     lines=[l.strip() for l in body.splitlines() if l.strip()]
     facts=' '.join(l for l in lines if re.match(r'^(Oltre alle sezioni|Nella scuola|Nella Scuola|Nella sezione|La scuola.*(suddivisi|condivide)|Sono presenti|È presente)',l,re.I))
     features=[]
     for pattern,label in [(r'giardin','Giardino'),(r'\borto\b','Orto'),(r'cortile','Cortile'),(r'terrazz','Terrazzo'),(r'biblioteca|spazio lettura','Biblioteca / spazio lettura'),(r'riposo','Spazio per il riposo'),(r'motori','Spazio per attività motorie'),(r'scientific','Laboratorio scientifico'),(r'pittura|pittoric','Atelier di pittura'),(r'manipol','Attività di manipolazione'),(r'teatro','Spazio teatro'),(r'costruzion','Spazio costruzioni'),(r'immersiv|multisensor','Spazio immersivo / multisensoriale'),(r'luci e ombre','Laboratorio luci e ombre'),(r'cucito','Laboratorio di cucito')]:
      if re.search(pattern,facts,re.I):features.append(label)
     match=re.search(r'suddivisi in\s+(?:in\s+)?(\w+)\s+sezioni',facts,re.I)
     n=match.group(1) if match else None
     extra=[]
     if n and s['id']!='mi-1322':extra.append(f'{n.capitalize()} sezioni indicate nella scheda comunale.')
     if features:extra.append('Spazi documentati: '+', '.join(f[0].lower()+f[1:] for f in features)+'.')
     if facts and (n or features):
      entry['services']=features+entry['services']
      entry['fieldEvidence']['services']=fe('verified',[d['url']],None)
      if not prior:entry['description']=' '.join(extra)
      entry['researchComplete']=True
      evidence={'id':s['id'],'url':d['url'],'access':access,'checkedAt':'2026-11-16','sectionCount':None if s['id']=='mi-1322' else n,'documentedFeatures':features,'notes':'Dati specifici della scheda; condizioni 2027/28 non confermate.'}
      (EVID/(s['id']+'-municipal.json')).write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
     else:entry['warnings'].append('Scheda della sede individuata; dati specifici non disponibili nell’estratto consultato.')
    else:entry['attempts'].append({'url':d['url'],'status':'blocked','notes':'URL presente nella directory ufficiale acquisita in Brave; contenuto individuale ancora da leggere.'})
   else:
    entry['attempts'].append({'url':'https://www.comune.milano.it/argomenti/scuola/3-6-anni','status':'read','notes':'Controllata directory ufficiale delle sedi comunali: nessuna corrispondenza univoca con questa identità/indirizzo.'})
    entry['warnings'].append('Regole comunali generali; sede specifica da verificare, non trovata con corrispondenza univoca nella directory consultata.')
   if s['id']=='mi-1322':entry['warnings'].append('La scheda comunale Betti 56 è incoerente sul numero di sezioni (due / tre): numero non assunto come certo.')
   if s['id']=='mi-1270':entry['warnings'].append('Lavori e possibili sedi temporanee Milesi: spazi descritti nella scheda storica non certificano l’ingresso attuale.')
  if s['id'] in annotations:
   a=annotations[s['id']]
   for k in ['officialUrl','officialPage','hours','cost','services','description','openDay','events','statusUpdate','statusReason','statusSource']:
    if k in a:entry[k]=a[k]
   entry['sources']+=a.get('sources',[]);entry['attempts']+=a.get('attempts',[]);entry['warnings']+=a.get('warnings',[])
   entry['fieldEvidence'].update(a.get('fieldEvidence',{}));entry['researchComplete']=a.get('researchComplete',True)
  if s['management']=='Statale' and (not entry['cost'] or entry['fieldEvidence']['cost']['status'] in ['not-found','not-published']):
   law='https://www.mim.gov.it/documents/20182/0/Decreto%2BLegislativo%2Bn.%2B297.pdf/1826d70b-10cd-4d11-b518-b445863c706a?version=1.0'
   entry['cost']='Frequenza didattica gratuita nelle scuole dell’infanzia statali (art. 99 D.Lgs. 297/1994). Quote di refezione secondo ISEE e servizi aggiuntivi da verificare con il gestore; nessun costo totale annuale specifico confermato.'
   entry['fieldEvidence']['cost']=fe('operator-rule',[law],None)
   entry['sources'].append({'label':'MIM · gratuità della frequenza statale, art.99','url':law,'checkedAt':'2026-11-16'})
   entry['attempts'].append({'url':law,'status':'indexed','notes':'Letto articolo 99 nel documento MIM indicizzato; regola statale generale, non tariffario refezione della singola scuola.'})
  entry['sources']=list({v['url']:v for v in entry['sources']}.values())
  entry['services']=list(dict.fromkeys(entry['services']));entry['warnings']=list(dict.fromkeys(entry['warnings']))
  results.append(entry)
 assert len(results)==125 and len(set(r['id'] for r in results))==125
 (ROOT/'research/deepening/ovest-nord.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'records':len(results),'complete':sum(r['researchComplete'] for r in results),'specificServices':sum(r['fieldEvidence']['services']['status']=='verified' for r in results),'readAttempts':sum(a['status']=='read' for r in results for a in r['attempts'])},indent=2))

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('urls',nargs='*');parser.add_argument('--initial',action='store_true');parser.add_argument('--compile',action='store_true');args=parser.parse_args()
 if args.compile:
  compile_output();raise SystemExit(0)
 school=json.load(open(ROOT/'src/data/schools.json'))
 targets=[s for s in school if s['municipality'] in [7,8,9,None]]
 urls=args.urls
 if args.initial:urls=list(dict.fromkeys(s['url'] for s in targets if s['url'] and '@' not in s['url'] and s['management']!='Comunale'))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  for r in pool.map(fetch,urls):print(json.dumps({'url':r['url'],'status':r['status'],'title':r.get('title'),'chars':len(r['text']),'cache':str(CACHE/(hashlib.sha256(r['url'].encode()).hexdigest()+'.json'))},ensure_ascii=False),flush=True)
