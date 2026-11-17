import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupMunicipalCivic, type MunicipalCivics } from '../src/lib/municipal-civics.ts';
import { findAddress } from '../src/lib/proximity.ts';
const data: MunicipalCivics = { version: 1, streets: [
  {name:'Via Ada Esempio',aliases:['Via Esempio Ada','Via Ada Campione'],numbers:[['12',45.46,9.19],['12A',45.461,9.191],['12/1',45.462,9.192],['121',45.463,9.193]]},
  {name:'Viale Ada Esempio',aliases:[],numbers:[['12',45.47,9.20]]},
]};
test('municipal lookup preserves civic coordinates, street type, suffixes and numeric subdivisions',()=>{
  for(const [requested,expected] of [['12','12'],['012','12'],['12/A','12A'],['12/1','12/1']]) {
    const matches=lookupMunicipalCivic(data,{street:'Via Esempio',houseNumber:requested});
    assert.equal(matches.length,1);assert.equal(matches[0].houseNumber,expected);
    assert.equal(matches[0].lat,data.streets[0].numbers.find(row=>row[0]===expected)![1]);
  }
  assert.deepEqual(lookupMunicipalCivic(data,{street:'Via Esempio',houseNumber:'999'}),[]);
  assert.equal(lookupMunicipalCivic(data,{street:'Viale Esempio',houseNumber:'12'})[0].lat,45.47);
});
test('official street aliases remain usable when a suggestion is selected',()=>{
  const match=lookupMunicipalCivic(data,{street:'Via Ada Campione',houseNumber:'12'})[0];
  assert.equal(match.label,'Via Ada Campione 12, Milano');
});
test('civics found locally send no typed address to Photon; missing civics keep exact remote validation',async()=>{
  const original=globalThis.fetch;const urls:string[]=[];let finishDownload!:(response:Response)=>void;
  globalThis.fetch=async(input)=>{
    urls.push(String(input));
    if(String(input)==='/dati/civici-milano.json')return new Promise<Response>(resolve=>{finishDownload=resolve;});
    return new Response(JSON.stringify({features:[{geometry:{coordinates:[9.19,45.46]},properties:{city:'Milano',countrycode:'IT',street:'Via Diversa',housenumber:'999'}}]}));
  };
  try {
    const controller=new AbortController();
    const cancelled=findAddress('Via Esempio 12',controller.signal);controller.abort();
    await assert.rejects(cancelled,{name:'AbortError'});
    const next=findAddress('Via Esempio 12',new AbortController().signal);
    finishDownload(new Response(JSON.stringify(data)));
    assert.equal((await next)[0].lat,45.46);
    assert.deepEqual(urls,['/dati/civici-milano.json']);
    assert.deepEqual(await findAddress('Via Esempio 999',new AbortController().signal),[]);
    assert.equal(urls.length,2);assert.equal(new URL(urls[1]).hostname,'photon.komoot.io');
  } finally {globalThis.fetch=original;}
});
