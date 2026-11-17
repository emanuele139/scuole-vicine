import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, radiusKm, formatDistance } from '../src/lib/proximity.ts';
const duomo={lat:45.4642,lng:9.19};
test('great-circle distances are in km, symmetric, and zero at origin',()=>{
  assert.equal(distanceKm(duomo,duomo),0);
  const north={lat:46.4642,lng:9.19};
  assert.ok(Math.abs(distanceKm(duomo,north)-111.195)<.001);
  assert.equal(distanceKm(duomo,north),distanceKm(north,duomo));
  assert.ok(Number.isFinite(distanceKm({lat:0,lng:0},{lat:0,lng:180})));
});
test('radius accepts only whole km from 1 to 10',()=>{
  for(let km=1;km<=10;km++)assert.equal(radiusKm(String(km)),km);
  for(const value of ['','0','11','-1','1.5','NaN'])assert.equal(radiusKm(value),2);
});
test('distance labels use meters below 1 km and Italian km formatting',()=>{
  assert.equal(formatDistance(.125),'125 m');assert.equal(formatDistance(1.25),'1,3 km');
});

test('geocoder results reject invalid/out-of-area coordinates and preserve civic precision',async()=>{
  const { parseAddressMatches } = await import('../src/lib/proximity.ts');
  const feature=(coords:unknown,p:object)=>({geometry:{coordinates:coords},properties:{countrycode:'IT',...p}});
  const matches=parseAddressMatches({features:[
    feature([9.19,45.46],{street:'Via Torino',housenumber:'12',city:'Milano'}),
    feature([9.19,45.46],{street:'Via Torino',housenumber:'12',city:'Milano'}),
    feature([9.18,45.47],{name:'Via Dante',city:'Milano'}),
    feature([12.49,41.89],{name:'Roma'}),feature([null,null],{name:'Invalid'}),
    feature(['9.19','45.46'],{name:'Invalid'}),
  ]});
  assert.equal(matches.length,2);
  assert.equal(matches[0].label,'Via Torino 12, Milano');
  assert.equal(matches[0].houseNumber,'12');assert.equal(matches[1].houseNumber,null);
  assert.throws(()=>parseAddressMatches({error:'unavailable'}));
});

test('superseded uncached requests abort during the throttle wait without calling the provider',async()=>{
  const {findAddress}=await import('../src/lib/proximity.ts');
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return new Response(JSON.stringify({features:[{geometry:{coordinates:[9.19,45.46]},properties:{countrycode:'IT',city:'Milano',street:'Via Test Attesa',housenumber:'4'}}]}),{status:200});
  };
  try {
    const first=await findAddress('Via Test Attesa 4',new AbortController().signal);
    assert.equal(first[0].houseNumber,'4');
    const controller=new AbortController();
    const superseded=findAddress('Via Test Superata 5',controller.signal);
    controller.abort();
    await assert.rejects(superseded,{name:'AbortError'});
    assert.equal(calls,1);
    await findAddress('Via Test Attesa 4',new AbortController().signal);
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;}
});
