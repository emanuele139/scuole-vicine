import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { CONSENT_KEY, makeConsent } from '../src/lib/consent.ts';
const bundle = (await build({ entryPoints:['src/scripts/privacy.ts'], bundle:true, write:false, format:'iife', platform:'browser' })).outputFiles[0].text;
function browser(options: { stored?: string; blocked?: boolean; hostname?: string; path?: string; dnt?: string; gpc?: boolean } = {}) {
  const handlers: Record<string,Record<string,Function>> = {};
  const nodes: Record<string,any> = {};
  function node(key:string) { return nodes[key] ??= { hidden:true, checked:false, disabled:false, open:false, textContent:'', dataset:{}, addEventListener(type:string,fn:Function){ (handlers[key] ??= {})[type]=fn; }, focus(){}, showModal(){this.open=true;}, close(){this.open=false;} }; }
  const banner=node('#cookie-banner');banner.dataset={analyticsEnabled:'true',umamiScript:'https://cloud.umami.is/script.js',umamiId:'b2ef9376-6eab-4ace-a55f-0db284e48135'};
  const storage = new Map(options.stored ? [[CONSENT_KEY,options.stored]] : []);
  const scripts:any[]=[]; const sent:any[]=[]; const listeners:Record<string,Function>={};
  const window:any={addEventListener(type:string,fn:Function){listeners[type]=fn;},dispatchEvent(){}, umami:{track(fn:Function){const result=window.scuoleBeforeSend('event',fn({website:banner.dataset.umamiId,url:'https://scuolevicine.it/?q=private#secret',referrer:'https://private.test',title:'private'}));if(result)sent.push(result);}}};
  const document={querySelector:node,querySelectorAll(selector:string){return selector==='[data-private-map]' ? [] : [node(selector)];},createElement(){return {dataset:{},remove(){}};},head:{append(script:any){scripts.push(script);}}};
  runInNewContext(bundle,{window,document,location:{hostname:options.hostname||'scuolevicine.it',origin:'https://scuolevicine.it',pathname:options.path||'/'},navigator:{language:'it-IT',doNotTrack:options.dnt,globalPrivacyControl:options.gpc},screen:{width:390,height:844},localStorage:{getItem:(k:string)=>storage.get(k)||null,setItem(k:string,v:string){if(options.blocked)throw Error('blocked');storage.set(k,v);}},setTimeout:()=>1,clearTimeout(){},Event:class{}});
  return {nodes,scripts,sent,window,storage,listeners,click(selector:string){handlers[selector].click();}};
}
test('tracker is never requested before consent, after refusal, or for local and personal pages',()=>{
  for(const config of [{},{stored:JSON.stringify(makeConsent(false,false))},{stored:JSON.stringify(makeConsent(true,false)),hostname:'localhost'},{stored:JSON.stringify(makeConsent(true,false)),path:'/famiglia/'},{stored:JSON.stringify(makeConsent(true,false)),path:'/s/'},{stored:JSON.stringify(makeConsent(true,false)),dnt:'1'},{stored:JSON.stringify(makeConsent(true,false)),gpc:true}]) assert.equal(browser(config).scripts.length,0);
});
test('consent loads tracker once, sends only sanitized pageview and withdrawal blocks pending sends',()=>{
  const b=browser(); b.click('[data-consent-accept]'); assert.equal(b.scripts.length,1);
  b.scripts[0].onload();assert.equal(b.sent.length,1);
  assert.equal(b.sent[0].url,'https://scuolevicine.it/');assert.equal(b.sent[0].referrer,'');assert.equal(b.sent[0].title,'Scuole Vicine');
  assert.equal(b.window.scuoleBeforeSend('identify',{email:'private'}),false);
  assert.equal(b.window.scuoleBeforeSend('event',{name:'click',data:{email:'private'}}),false);
  b.click('[data-consent-reject]');b.scripts[0].onload();assert.equal(b.sent.length,1);
  assert.equal(JSON.parse(b.storage.get(CONSENT_KEY)!).analytics,false);
});
test('cross-tab withdrawal blocks future sends and blocked storage is reported',()=>{
  const b=browser({stored:JSON.stringify(makeConsent(true,true))});assert.equal(b.scripts.length,1);
  b.storage.set(CONSENT_KEY,JSON.stringify(makeConsent(false,false)));b.listeners.storage({key:CONSENT_KEY});b.scripts[0].onload();assert.equal(b.sent.length,0);
  const blocked=browser({blocked:true});blocked.click('[data-consent-reject]');assert.match(blocked.nodes['#privacy-storage-status'].textContent,/impedisce/);assert.equal(blocked.nodes['#privacy-preferences'].open,true);assert.equal(blocked.scripts.length,0);
});
test('renewed consent measures again without reloading the tracker or duplicating an unchanged choice',()=>{
  const b=browser();b.click('[data-consent-accept]');b.scripts[0].onload();
  b.click('[data-consent-accept]');assert.equal(b.sent.length,1);
  b.click('[data-consent-reject]');assert.equal(b.sent.length,1);
  b.click('[data-consent-accept]');assert.equal(b.sent.length,2);assert.equal(b.scripts.length,1);
});
test('withdrawal while loading and network failure do not prevent a later consented pageview',()=>{
  const b=browser();b.click('[data-consent-accept]');b.click('[data-consent-reject]');b.scripts[0].onload();
  assert.equal(b.sent.length,0);b.click('[data-consent-accept]');assert.equal(b.sent.length,1);
  const failed=browser();failed.click('[data-consent-accept]');failed.scripts[0].onerror();
  failed.click('[data-consent-accept]');assert.equal(failed.scripts.length,2);failed.scripts[1].onload();assert.equal(failed.sent.length,1);
});
test('browser privacy signals visibly override consent without requesting the tracker',()=>{
  for(const config of [{dnt:'1'},{gpc:true}]) {
    const b=browser({...config,stored:JSON.stringify(makeConsent(true,true))});
    assert.equal(b.nodes['#consent-analytics'].disabled,true);
    assert.equal(b.nodes['#privacy-signals-status'].hidden,false);
    assert.match(b.nodes['#privacy-signals-status'].textContent,/statistiche restano disattivate/);
    b.click('[data-consent-accept]');assert.equal(b.scripts.length,0);
    assert.equal(JSON.parse(b.storage.get(CONSENT_KEY)!).analytics,false);
  }
});
