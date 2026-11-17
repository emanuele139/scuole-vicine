import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSearchUrl, validateSearchSession, writeSearchSession, readSearchSession, SEARCH_SESSION_TTL, type SearchSession } from '../src/lib/search-session.ts';
const now=Date.now();
const state:SearchSession={version:1,savedAt:now,url:'/?fascia=preschool&municipio=7',openedPath:'/scuole/arena-21-mi-1007/',mode:'address',query:'Via Arena 21, Milano',stage:'preschool',radius:'2',municipality:'7',management:'',service:'',sort:'distance',onlySaved:false,origin:{lat:45.455,lng:9.18,label:'Via Arena 21, Milano',houseNumber:'21',street:'Via Arena'},expandedFacts:['mi-1007:hours'],view:'map',shown:36,count:40,selectedId:'mi-1007',scrollY:2400,mapView:{lat:45.455,lng:9.18,zoom:16}};
function storage(){const values=new Map<string,string>();return{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};}
test('the tab restores radius origin, map position, expanded data, pagination and scroll together',()=>{
  const cache=storage();assert.equal(writeSearchSession(cache,state),true);
  const resumed=readSearchSession(cache,now+1000)!;
  assert.deepEqual(resumed,state);
  assert.equal(readSearchSession(cache,now+SEARCH_SESSION_TTL+1),null);
});
test('return links strip location data and reject other paths or origins',()=>{
  assert.equal(publicSearchUrl('/?municipio=7&indirizzo=private&lat=45.4&lng=9.2&q=private#test'),'/?municipio=7');
  assert.match(publicSearchUrl('/?tipo=nome&q=Arena'),/q=Arena/);
  assert.throws(()=>publicSearchUrl('https://hostile.test/'));
  assert.throws(()=>publicSearchUrl('//hostile.test/'));
  assert.throws(()=>publicSearchUrl('/scuole/test/'));
});
test('a long catalogue retains deep scroll and expanded facts after loading all results',()=>{
  const cache=storage();
  const deep={...state,count:735,shown:744,scrollY:700000,expandedFacts:Array.from({length:735},(_,i)=>['hours','cost','access'].map(field=>`school-${i}:${field}`)).flat()};
  assert.equal(writeSearchSession(cache,deep),true);
  assert.deepEqual(readSearchSession(cache,now+1000),deep);
});
test('invalid state cannot silently turn a distance search into an unrestricted result set',()=>{
  for(const patch of [{origin:null},{origin:{...state.origin,lat:0}},{radius:'20'},{scrollY:Infinity},{openedPath:'https://hostile.test/'},{view:'other'},{savedAt:now+10000},{expandedFacts:['x'.repeat(1000)]}]){
    assert.equal(validateSearchSession({...state,...patch},now),null);
  }
  assert.equal(writeSearchSession(null,state),false);
  assert.equal(readSearchSession({getItem(){throw Error('blocked');},setItem(){},removeItem(){}},now),null);
});
