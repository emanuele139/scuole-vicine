import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCivicAddress,matchesCivicAddress} from '../src/lib/civic-address.ts';
import {AddressSuggestionCache} from '../src/lib/address-cache.ts';
import {findAddress} from '../src/lib/proximity.ts';
const house={label:'Corso Magenta 15, 20123, Milano',street:'Corso Magenta',houseNumber:'15',lat:45.4656405,lng:9.1787123};
test('parses civic numbers, suffixes and full selected addresses without treating street dates as civics',()=>{
  for(const address of ['Corso Magenta 15','Corso Magenta 15,Milano','Corso Magenta 15, 20123, Milano'])assert.deepEqual(parseCivicAddress(address),{street:'Corso Magenta',houseNumber:'15'});
  assert.deepEqual(parseCivicAddress('Via Dante 12/A, Milano'),{street:'Via Dante',houseNumber:'12/A'});
  assert.equal(parseCivicAddress('Via 25 Aprile'),null);
  assert.equal(parseCivicAddress('Corso Magenta, Milano'),null);
});
test('requires both the real street and the exact civic including letters',()=>{
  const requested=parseCivicAddress('Corso Magenta 15')!;
  assert.equal(matchesCivicAddress(house,requested),true);
  for(const candidate of [{...house,houseNumber:null},{...house,houseNumber:'15a'},{...house,street:'Via Magenta'},{...house,street:'Corso Sempione'}])assert.equal(matchesCivicAddress(candidate,requested),false);
  assert.equal(matchesCivicAddress({...house,street:'Via Dante',houseNumber:'12a'},parseCivicAddress('Via Dante 12/A')!),true);
});
test('cached generic street or wrong civic cannot satisfy a civic query',()=>{
  const cache=new AddressSuggestionCache(null);
  cache.set('Corso Magenta 15',[{...house,houseNumber:null}]);
  assert.equal(cache.get('Corso Magenta 15').matches.length,0);
  assert.equal(cache.get('Corso Magenta 15').fresh,false);
  cache.set('Corso Magenta',[house,{...house,houseNumber:'15a'}]);
  assert.deepEqual(cache.get('Corso Magenta 15').matches,[house]);
});
test('structured search retains the actual civic coordinates and never falls back to street',async()=>{
  const original=globalThis.fetch;const urls:URL[]=[];
  const feature=(street:string,number:string,point:number[],kind='place')=>({geometry:{coordinates:point},properties:{countrycode:'IT',city:'Milano',street,housenumber:number,postcode:'20123',osm_key:kind,osm_value:kind==='place'?'house':'museum',name:kind==='place'?undefined:'Museo'}});
  globalThis.fetch=async(input)=>{
    const url=new URL(String(input));urls.push(url);
    const features=url.searchParams.get('housenumber')==='15' ? [feature('Corso Magenta','15',[9.1787191,45.465621],'tourism'),feature('Corso Magenta','15',[house.lng,house.lat]),feature('Corso Magenta','15a',[9.18,45.46]),feature('Corso Sempione','15',[9.17,45.47])] : [feature('Corso Magenta','99',[9.18,45.46])];
    return new Response(JSON.stringify({features}));
  };
  try{
    assert.deepEqual(await findAddress('Corso Magenta 15',new AbortController().signal),[house]);
    assert.equal(urls[0].pathname,'/structured');assert.equal(urls[0].searchParams.get('street'),'Corso Magenta');assert.equal(urls[0].searchParams.get('housenumber'),'15');
    assert.deepEqual(await findAddress('Corso Magenta 999',new AbortController().signal),[]);
    assert.equal(urls.length,2);
  }finally{globalThis.fetch=original;}
});
