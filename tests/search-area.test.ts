import test from 'node:test';
import assert from 'node:assert/strict';
import { neighbouringComuni, normalizeArea, areaComune, areaLabel, matchesSearchArea, addressContext } from '../src/lib/search-area.ts';
import { parseCivicAddress } from '../src/lib/civic-address.ts';
import { findAddress, parseAddressMatches } from '../src/lib/proximity.ts';
import { AddressSuggestionCache } from '../src/lib/address-cache.ts';
import { publicSearchUrl } from '../src/lib/search-session.ts';

test('a single scope distinguishes Milano districts, the city, and each of the 23 neighbouring cities',()=>{
  assert.equal(neighbouringComuni.length,23);
  const city={comuneSlug:'milano',municipality:7}, neighbour={comuneSlug:'segrate',municipality:null};
  assert.equal(normalizeArea('7'),'municipio-7');
  assert.equal(matchesSearchArea(city,'7'),true);
  assert.equal(matchesSearchArea(neighbour,'unknown'),false);
  assert.equal(matchesSearchArea(city,'milano'),true);
  assert.equal(matchesSearchArea(neighbour,'milano'),false);
  assert.equal(matchesSearchArea(neighbour,''),true);
  for(const [slug,name] of neighbouringComuni){
    assert.equal(matchesSearchArea({comuneSlug:slug,municipality:null},slug),true);
    assert.equal(areaComune(slug),name); assert.equal(areaLabel(slug),name);
  }
  assert.equal(publicSearchUrl('/?area=segrate&lat=45.4&indirizzo=privato'),'/?area=segrate');
});

test('an explicit municipality overrides area context and keeps exact civic parsing',()=>{
  assert.deepEqual(addressContext('Via Roma 12/A, 20054, Segrate','Milano'),{address:'Via Roma 12/A',comune:'Segrate'});
  assert.deepEqual(parseCivicAddress('Via Roma 12/A, Segrate'),{street:'Via Roma',houseNumber:'12/A'});
  assert.deepEqual(addressContext('Via Roma 12',null),{address:'Via Roma 12',comune:null});
  assert.deepEqual(addressContext('Via Milano',null),{address:'Via Milano',comune:null});
});

test('remote geocoding honours the other city and never consults Milano civics for it',async()=>{
  const original=globalThis.fetch;const calls:URL[]=[];
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input),'https://test.invalid');calls.push(url);
    assert.equal(url.hostname,'photon.komoot.io');
    const feature=(city:string,number:string)=>({geometry:{coordinates:[9.28,45.49]},properties:{city,countrycode:'IT',street:'Via Test Comune',housenumber:number}});
    return new Response(JSON.stringify({features:[feature('Milano','12'),feature('Segrate','12'),feature('Segrate','14')]}));
  };
  try{
    const result=await findAddress('Via Test Comune 12, Segrate',new AbortController().signal,'Milano');
    assert.equal(result.length,1);assert.equal(result[0].label,'Via Test Comune 12, Segrate');
    assert.equal(calls[0].searchParams.get('city'),'Segrate');assert.equal(calls[0].searchParams.get('housenumber'),'12');
  }finally{globalThis.fetch=original;}
});

test('cache and provider retain municipality identity for homonymous streets',()=>{
  const make=(city:string)=>({lat:45.49,lng:9.28,label:`Via Roma 12, ${city}`,street:'Via Roma',houseNumber:'12'});
  const cache=new AddressSuggestionCache(null);cache.set('Via Roma 12, Milano',[make('Milano')]);
  assert.equal(cache.get('Via Roma 12, Segrate').matches.length,0);
  cache.set('Via Roma 12, Segrate',[make('Segrate')]);assert.deepEqual(cache.get('Via Roma 12, Segrate').matches,[make('Segrate')]);
  const feature=(city:string,lat=45.49)=>({geometry:{coordinates:[9.28,lat]},properties:{city,countrycode:'IT',street:'Via Roma',housenumber:'12'}});
  assert.equal(parseAddressMatches({features:[feature('Milano'),feature('Segrate'),feature('Monza'),feature('Opera',45.33)]}).length,3);
  assert.equal(parseAddressMatches({features:[feature('Milano'),feature('Segrate')]},'Segrate').length,1);
});
