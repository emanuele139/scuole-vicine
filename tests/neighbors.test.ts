import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path:string)=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const neighbours=read('../src/data/neighbor-schools.json');
const client=read('../src/data/neighbor-schools-client.json');
const territorial=read('../src/data/territorial-access.json');
const coverage=read('../src/data/neighbor-coverage.json');
const original=[...read('../src/data/schools.json'),...read('../src/data/nurseries.json')];
test('the neighbouring census covers 23 comuni with separate stable service identities',()=>{
  assert.equal(new Set(neighbours.map((s:any)=>s.comuneSlug)).size,23);
  assert.equal(coverage.total,neighbours.length);
  assert.equal(coverage.geolocated,neighbours.filter((s:any)=>s.lat!==null).length);
  assert.deepEqual([...coverage.unlocatedIds].sort(),neighbours.filter((s:any)=>s.lat===null).map((s:any)=>s.id).sort());
  const all=[...original,...neighbours];
  for(const key of ['id','slug'])assert.equal(new Set(all.map(s=>s[key])).size,all.length,key);
  assert.deepEqual(client.map((s:any)=>s.id).sort(),neighbours.map((s:any)=>s.id).sort());
  const byId=new Map(neighbours.map((s:any)=>[s.id,s]));
  for(const s of client)for(const [key,value]of Object.entries(s))assert.deepEqual(value,(byId.get(s.id) as any)[key],`${s.id}: ${key}`);
  for(const s of neighbours){
    assert.equal(s.municipality,null,'Milano Municipi cannot be assigned outside Milano');
    assert.ok(territorial.municipalities.some((m:any)=>m.slug===s.comuneSlug&&m.name===s.comune));
    assert.ok(s.sources.length&&s.sources.every((source:any)=>/^https:\/\//.test(source.url)));
    assert.equal(s.lat===null,s.lng===null);
    if(s.lat!==null){assert.ok(s.lat>45.30&&s.lat<45.65&&s.lng>8.95&&s.lng<9.50);assert.ok(s.locationYear);assert.ok(s.locationSource?.url, 'A coordinate needs its own traceable source');assert.ok(s.sources.some((source:any)=>source.url===s.locationSource.url));}
    if(s.addressReview){assert.match(s.addressReview.reviewedAt,/^\d{4}-\d{2}-\d{2}$/);assert.ok(s.addressReview.previousAddress&&s.addressReview.previousComune&&s.addressReview.reason);assert.ok(s.addressReview.sources.length);for(const source of s.addressReview.sources)assert.ok(s.sources.some((entry:any)=>entry.url===source.url));}
    if(s.serviceType==='Nido famiglia'){assert.equal(s.operator,null);assert.equal(s.phone,null);assert.equal(s.email,null);}
  }
});

test('a documented municipality correction keeps the original school identity and URL',()=>{
  const school=neighbours.find((s:any)=>s.id==='hinterland-mim-mi1a29100v');
  assert.equal(school.comune,'Baranzate');
  assert.equal(school.comuneSlug,'baranzate');
  assert.equal(school.code,'MI1A29100V');
  assert.equal(school.sourceIds.mim,'MI1A29100V');
  assert.equal(school.addressReview.previousComune,'Bollate');
  assert.ok(school.slug.includes('bollate'),'the existing family/bookmark URL must remain valid');
  assert.ok(school.lat!==null&&school.lng!==null);
  assert.ok(school.addressReview.sources.some((s:any)=>s.url.includes('comune.baranzate.mi.it')));
});
