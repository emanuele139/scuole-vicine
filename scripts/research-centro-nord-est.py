"""Read-only official-source crawler; writes only assigned evidence directory."""
import concurrent.futures as cf
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/deepening/evidence/centro-nord-est'
OUT.mkdir(parents=True, exist_ok=True)
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[]; self.links=[]; self.skip=0; self.href=None; self.label=[]; self.images=[]
    def handle_starttag(self, tag, attrs):
        if tag in ('script','style','noscript','svg'): self.skip+=1
        if tag in ('p','div','h1','h2','h3','h4','li','br','tr','section'): self.text.append('\n')
        if tag=='a': self.href=dict(attrs).get('href'); self.label=[]
        if tag=='img': self.images.append(dict(attrs))
    def handle_endtag(self, tag):
        if tag in ('script','style','noscript','svg'): self.skip=max(0,self.skip-1)
        if tag=='a' and self.href: self.links.append((self.href,' '.join(self.label))); self.href=None
        if tag in ('p','div','h1','h2','h3','li'): self.text.append('\n')
    def handle_data(self,data):
        if not self.skip:
            self.text.append(data)
            if self.href: self.label.append(data.strip())

def fetch(url):
    token=hashlib.sha1(url.encode()).hexdigest()[:12]
    record={'url':url,'checkedAt':'2026-11-16','status':'error','file':token+'.txt'}
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; school research)'})
        response=urllib.request.urlopen(req,timeout=30)
        raw=response.read(30_000_000); record['urlFinal']=response.url
        if response.headers.get('Content-Type','').startswith('image/'):
            extension='.png' if 'png' in response.headers.get('Content-Type','') else '.jpg'
            (OUT/(token+extension)).write_bytes(raw)
            record['imageFile']=token+extension
            (OUT/(token+'.txt')).write_text('Image downloaded for visual review: '+url)
            record['links']=[]
        elif 'pdf' in response.headers.get('Content-Type','') or raw[:4]==b'%PDF':
            pdf=OUT/(token+'.pdf');pdf.write_bytes(raw)
            sys.path.insert(0, '/private/tmp/centro-nord-est-pdf-deps')
            from pypdf import PdfReader
            (OUT/(token+'.txt')).write_text('\n\n'.join(page.extract_text() or '' for page in PdfReader(pdf).pages))
            record['links']=[]
        else:
            p=Page();p.feed(raw.decode('utf-8',errors='replace'))
            text='\n'.join(' '.join(line.split()) for line in ''.join(p.text).splitlines() if line.strip())
            (OUT/(token+'.txt')).write_text(text)
            record['images']=p.images
            record['links']=[{'url':urllib.parse.urljoin(response.url,u),'label':label} for u,label in p.links if u and not u.startswith(('mailto:','tel:','javascript:','#'))]
        record['status']='read';record['bytes']=len(raw)
    except Exception as exc: record['error']=str(exc)
    (OUT/(token+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2))
    return record

def compose():
    schools={s['id']:s for s in json.loads((ROOT/'src/data/schools.json').read_text()) if s['municipality'] in (1,2,3)}
    reviewed=json.loads((OUT/'reviewed.json').read_text())
    if (OUT/'reviewed-part2.json').exists(): reviewed+=json.loads((OUT/'reviewed-part2.json').read_text())
    if (OUT/'reviewed-part3.json').exists(): reviewed+=json.loads((OUT/'reviewed-part3.json').read_text())
    if (OUT/'municipal-reviewed.json').exists(): reviewed+=json.loads((OUT/'municipal-reviewed.json').read_text())
    seeds=json.loads((OUT/'seeds.json').read_text())
    metadata={}
    for f in OUT.glob('*.json'):
        d=json.loads(f.read_text())
        if isinstance(d,dict) and 'url' in d and 'status' in d:metadata[d['url']]=d
    rules={x['url']:x for x in json.loads((ROOT/'research/deepening/shared/municipal-rules.json').read_text())['sources']}
    ruleLabels={u:x['label'] for u,x in rules.items()}
    output=[]
    for row in reviewed:
        s=schools[row['id']]
        page=row.get('page'); urls=list(dict.fromkeys([u for v in row.get('fieldUrls',{}).values() for u in v]+([page] if page else [])))
        fields={}
        for field in ('hours','cost','services','openDay'):
            evidence=row.get('fieldUrls',{}).get(field,[])
            fields[field]={'status':row.get('statuses',{}).get(field,'verified' if evidence and row.get(field) else 'not-found'),'sourceUrls':evidence or ([page] if page else []),'year':row.get('years',{}).get(field)}
        attempts=[]
        for url in list(dict.fromkeys(seeds.get(row['id'],[])+urls)):
            if url in rules:
                attempts.append({'url':url,'status':rules[url]['access'],'notes':'Fonte di rete documentata in shared/municipal-rules.json; accesso come registrato nella fonte condivisa.'})
                continue
            d=metadata.get(url)
            if d:
                status='read' if d['status']=='read' else ('blocked' if any(v in d.get('error','') for v in ('403','closed connection','SSL','handshake','timed out')) else 'error')
                attempts.append({'url':url,'status':status,'notes':('Testo archiviato in evidence/centro-nord-est/'+d['file']) if status=='read' else d.get('error','Errore di lettura')})
            elif url in urls: attempts.append({'url':url,'status':row.get('access','read'),'notes':row.get('accessNote','Fonte letta tramite strumento web; riscontro conservato nelle evidenze di ricerca.')})
        for key in row.get('braveFiles',[]):
            brave=json.loads((ROOT/'research/deepening/shared/brave'/(key+'.json')).read_text())
            attempts.append({'url':brave.get('actualUrl',brave['url']),'status':'read','notes':'Testo completo letto in Brave, conservato in shared/brave/'+key+'.json'})
        attempts=list({(a['url'],a['status']):a for a in attempts+row.get('attemptsAdd',[])}.values())
        result={'id':s['id'],'checkedAt':'2026-11-16','officialUrl':row.get('officialUrl') if 'officialUrl' in row else (urllib.parse.urlsplit(page).scheme+'://'+urllib.parse.urlsplit(page).netloc if page else None),'officialPage':page,'hours':row.get('hours') or 'Orari della sede non trovati nelle fonti ufficiali consultate; chiedere alla segreteria ingresso, uscita e condizioni del prolungamento.','cost':row.get('cost') or 'Listino completo della sede non trovato nelle pagine ufficiali consultate. Richiedere preventivo annuale con iscrizione, mensa e servizi aggiuntivi.','services':row.get('services',[]),'description':row.get('description'),'openDay':row.get('openDay') or 'Non trovata una data verificata di open day dell’infanzia per questa sede nelle fonti consultate; chiedere un colloquio alla scuola.','events':row.get('events',[]),'sources':[{'label':ruleLabels.get(u,('Documento ufficiale' if '.pdf' in u.lower() else 'Pagina ufficiale')+' · '+s['name']),'url':u,'checkedAt':'2026-11-16',**({'year':next((row.get('years',{}).get(k) for k,v in row.get('fieldUrls',{}).items() if u in v and row.get('years',{}).get(k)),None)} if any(u in v and row.get('years',{}).get(k) for k,v in row.get('fieldUrls',{}).items()) else {})} for u in urls],'fieldEvidence':fields,'attempts':attempts,'warnings':row.get('warnings',[])}
        output.append(result)
    destination=ROOT/'research/deepening/centro-nord-est.json'
    destination.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    print('Checkpoint:',len(output),'su',len(schools),'sedi; '+str(destination))

if __name__=='__main__' and sys.argv[1]=='--compose':
    compose()
elif __name__=='__main__':
    urls=json.loads(Path(sys.argv[1]).read_text())
    if isinstance(urls,dict): urls=list(dict.fromkeys(u for values in urls.values() for u in values))
    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        records=list(pool.map(fetch,urls))
    print(json.dumps([{k:r[k] for k in ('url','status','file','error') if k in r} for r in records],ensure_ascii=False,indent=2))
