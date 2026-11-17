import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressSuggestionCache, ADDRESS_CACHE_KEY } from '../src/lib/address-cache.ts';
const match = {label:'Via Torino 12, Milano',lat:45.463,lng:9.188,houseNumber:'12',street:'Via Torino'};
const storage=()=>{const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>{data.set(key,value);}};};
test('cache survives reload and supplies normalized exact and prefix suggestions synchronously',()=>{
  const disk=storage();const cache=new AddressSuggestionCache(disk,()=>1000);
  cache.set('Via Torino, Milano',[match]);
  const reloaded=new AddressSuggestionCache(disk,()=>1001);
  assert.deepEqual(reloaded.get('  VIA TÓRINO '),{matches:[match],exact:true,fresh:true});
  assert.deepEqual(reloaded.get('via tor').matches,[match]);
  assert.deepEqual(reloaded.get('via torino 1').matches,[]);
  assert.deepEqual(reloaded.get('via torino 12').matches,[match]);
  assert.deepEqual(reloaded.get('via dante').matches,[]);
});
test('cache refreshes old entries, expires after 24h and limits disk use',()=>{
  let now=1000;const disk=storage();const cache=new AddressSuggestionCache(disk,()=>now);
  cache.set('Via Torino',[match]);now+=6*60*1000;
  assert.equal(cache.get('Via Torino').fresh,false);assert.equal(cache.get('Via Torino').matches.length,1);
  now+=24*60*60*1000;assert.equal(cache.get('Via Torino').matches.length,0);
  for(let i=0;i<60;i++)cache.set(`Via ${i}`,[match]);
  assert.equal(JSON.parse(disk.getItem(ADDRESS_CACHE_KEY)!).length,50);
});
test('broken or blocked storage retains memory cache and invalid coordinates are rejected',()=>{
  const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
  const cache=new AddressSuggestionCache(blocked);cache.set('Via Torino',[match]);assert.equal(cache.get('via tor').matches.length,1);
  cache.set('Invalid',[{...match,lat:NaN}]);assert.equal(cache.get('invalid').matches.length,0);
  const malformed=new AddressSuggestionCache({getItem:()=>'{broken',setItem:()=>{}});assert.equal(malformed.get('via tor').matches.length,0);
});
test('empty old responses never hide useful prefix matches',()=>{
  const disk=storage();
  disk.setItem(ADDRESS_CACHE_KEY,JSON.stringify([
    {query:'via tor',matches:[],savedAt:1000},
    {query:'via torino',matches:[match],savedAt:1000},
  ]));
  const cache=new AddressSuggestionCache(disk,()=>1001);
  assert.deepEqual(cache.get('via tor').matches,[match]);
  cache.set('via tor',[]);
  assert.deepEqual(cache.get('via tor').matches,[match]);
});
