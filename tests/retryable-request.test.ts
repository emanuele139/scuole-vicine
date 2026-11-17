import test from 'node:test';
import assert from 'node:assert/strict';
import {RetryableRequest,type RequestState} from '../src/lib/retryable-request.ts';
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
test('retry repeats the failed input once without rolling back caller-owned filters or results',async()=>{
  const filters={municipality:'7',stage:'preschool'},results=['previous-result'];
  const pending=deferred<string[]>();let calls=0;const inputs:string[]=[];
  const task=new RetryableRequest<string,string[]>((input)=>{inputs.push(input);return ++calls===1?Promise.reject(new Error('offline')):pending.promise;},state=>{if(state.phase==='ready')results.splice(0,results.length,...state.value);});
  await task.start('Via Arena 21');assert.equal(task.state.phase,'error');assert.deepEqual(results,['previous-result']);
  filters.municipality='1';const retry=task.retry();await task.retry();assert.equal(calls,2);
  assert.deepEqual(inputs,['Via Arena 21','Via Arena 21']);assert.deepEqual(results,['previous-result']);assert.equal(filters.stage,'preschool');
  pending.resolve(['new-result']);await retry;assert.equal(task.state.phase,'ready');assert.equal(filters.municipality,'1');assert.deepEqual(results,['new-result']);
});
test('late success or failure cannot replace a newer request, even when transport ignores abort',async()=>{
  const old=deferred<string>();const states:RequestState<string,string>[]=[];
  const task=new RetryableRequest<string,string>(input=>input==='old'?old.promise:Promise.resolve('current'),state=>states.push(state));
  const previous=task.start('old');await task.start('new');old.resolve('obsolete');await previous;
  assert.deepEqual(task.state,{phase:'ready',input:'new',retry:false,value:'current'});assert.equal(states.filter(s=>s.phase==='ready').length,1);
  const failing=deferred<string>();const second=new RetryableRequest<string,string>(()=>failing.promise,()=>{});const run=second.start('old');second.cancel();failing.reject(new Error('late'));await run;assert.equal(second.state.phase,'idle');
});
test('timeout offers retry, cancellation does not; a successful empty response is not a network error',async()=>{
  let calls=0;const task=new RetryableRequest<string,string[]>(()=>++calls===1?new Promise(()=>{}):Promise.resolve([]),()=>{},10);
  const current=():RequestState<string,string[]>=>task.state;
  await task.start('address');const timeout=current();assert.equal(timeout.phase,'error');if(timeout.phase==='error')assert.equal(timeout.reason,'timeout');
  await task.retry();const ready=current();assert.equal(ready.phase,'ready');if(ready.phase==='ready')assert.deepEqual(ready.value,[]);
  task.cancel();await task.retry();assert.equal(calls,2);assert.equal(current().phase,'idle');
});
