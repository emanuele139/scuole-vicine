import test from 'node:test';
import assert from 'node:assert/strict';
import { findAddress } from '../src/lib/proximity.ts';
test('an unavailable local catalogue falls back to exact Photon results without repeating the failed download',async()=>{
  const original=globalThis.fetch;const urls:string[]=[];
  globalThis.fetch=async(input)=>{
    urls.push(String(input));
    if(String(input)==='/dati/civici-milano.json')return new Response('unavailable',{status:503});
    const number=new URL(String(input)).searchParams.get('housenumber');
    return new Response(JSON.stringify({features:[{geometry:{coordinates:[9.19,45.46]},properties:{city:'Milano',countrycode:'IT',street:'Via Esempio',housenumber:number}}]}));
  };
  try {
    for(const number of ['42','43'])assert.equal((await findAddress(`Via Esempio ${number}`,new AbortController().signal))[0].houseNumber,number);
    assert.equal(urls.filter(url=>url==='/dati/civici-milano.json').length,1);
    assert.equal(urls.filter(url=>url.startsWith('https://photon.komoot.io/')).length,2);
  } finally {globalThis.fetch=original;}
});
