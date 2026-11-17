import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
function source(path: string) {
  const code = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export default /gm, 'const worker = ').replace(/^export /gm, '');
  return ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
}
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_shared_spaces.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql: string) { return { bind(...values: any[]) { return {
    async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: result.changes } }; },
    async first() { return sqlite.prepare(sql).get(...values) || null; },
  }; } }; } };
  const stored = new Map<string, any>();
  let failWrites = false, offline = false, loseResponse = false;
  const context = vm.createContext({
    crypto: globalThis.crypto, URL, URLSearchParams, Request, Response, Headers, TextEncoder, TextDecoder, Uint8Array, btoa, atob, AbortSignal,
    structuredClone, setTimeout, clearTimeout, console,
    async writeVault(id: string, _c: any, value: any) { if (failWrites) throw new Error('blocked'); stored.set(id, structuredClone(value)); },
    async readVault(id: string) { return stored.get(id) || null; },
    async fetch(path: string, init: any) {
      if (offline) throw new Error('offline');
      const response = await (context as any).api(new Request(`https://scuole.test${path}`, init), { DB });
      if (loseResponse && init.method === 'PUT') { loseResponse = false; throw new Error('lost after commit'); }
      return response;
    },
  });
  vm.runInContext(source('../src/lib/shared/protocol.ts') + source('../src/lib/shared/document.ts') + source('../src/lib/shared/client.ts') + source('../worker/index.ts') + '\nglobalThis.api = api; globalThis.shared = { credentials, encrypt, decrypt, link, parseLink, merge, validateDocument, blankEntry, equal, SharedClient, request, decode };', context);
  return { api: (context as any).api, shared: (context as any).shared, DB, sqlite, stored,
    offline(value: boolean) { offline = value; }, failWrites(value: boolean) { failWrites = value; }, loseResponse() { loseResponse = true; } };
}
function doc(note = '') { return { version: 1, saved: ['school-0'], entries: { 'school-0': { status: 'da-valutare', note, questions: '', parentA: '', parentB: '' } } }; }
async function clients(env: ReturnType<typeof setup>) {
  const s = env.shared, c = s.credentials(), original = doc('iniziale');
  await s.request(c, 'POST', await s.encrypt(original, c, 1));
  const a = await s.SharedClient.open(c, 'tab-a', () => {}), b = await s.SharedClient.open(c, 'tab-b', () => {});
  // Tests explicitly drive sync; no debounce timers outlive the test.
  a.schedule = b.schedule = () => {};
  return { s, c, a, b };
}
test('encrypted content authenticates key, space and revision, with fresh IVs', async () => {
  const { shared: s } = setup(), c = s.credentials();
  const first = await s.encrypt(doc('SEGRETO'), c, 1), second = await s.encrypt(doc('SEGRETO'), c, 1);
  assert.notEqual(first.iv, second.iv);
  assert.ok(!JSON.stringify(first).includes('SEGRETO'));
  assert.equal((await s.decrypt(first, c)).entries['school-0'].note, 'SEGRETO');
  await assert.rejects(s.decrypt(first, { ...c, key: s.credentials().key }));
  await assert.rejects(s.decrypt({ ...first, revision: 2 }, c));
  await assert.rejects(s.decrypt(first, { ...c, id: s.credentials().id }));
  assert.deepEqual(JSON.parse(JSON.stringify(s.parseLink(new URL(s.link(c, 'https://scuole.test')).hash))), JSON.parse(JSON.stringify(c)));
});
test('D1 stores ciphertext and token hash; auth, CAS, idempotency, deletion and expiry are enforced', async () => {
  const env = setup(), s = env.shared, c = s.credentials();
  const e = await s.encrypt(doc('PRIVATE_NOTE'), c, 1);
  await s.request(c, 'POST', e); await s.request(c, 'POST', e);
  const row = env.sqlite.prepare('SELECT * FROM shared_spaces').get()!;
  assert.ok(!JSON.stringify(row).includes('PRIVATE_NOTE')); assert.notEqual(row.access_token_hash, c.access);
  await assert.rejects(s.request({ ...c, access: s.credentials().access }), /non disponibile/);
  const left = await s.encrypt(doc('sinistra'), c, 2), right = await s.encrypt(doc('destra'), c, 2);
  const results = await Promise.all([s.request(c, 'PUT', left), s.request(c, 'PUT', right)]);
  assert.equal(results[0].operation, results[1].operation);
  assert.equal(env.sqlite.prepare('SELECT revision FROM shared_spaces').get()!.revision, 2);
  const retry = await s.request(c, 'PUT', left); assert.equal(retry.revision, 2);
  await assert.rejects(s.request(c, 'DELETE', undefined, 1), /cambiato/);
  assert.equal((await s.request(c)).revision, 2);
  const cross = await env.api(new Request(`https://scuole.test/api/spaces/${c.id}`, { headers: { authorization: `Bearer ${c.access}`, origin: 'https://evil.test' } }), { DB: env.DB });
  assert.equal(cross.status, 403);
  await s.request(c, 'DELETE', undefined, 2); await assert.rejects(s.request(c), /non disponibile/);
  const fresh = s.credentials(); await s.request(fresh, 'POST', await s.encrypt(doc(), fresh, 1));
  env.sqlite.prepare('UPDATE shared_spaces SET expires_at = 1').run(); await assert.rejects(s.request(fresh), /scaduto/);
});
test('simultaneous independent edits merge, same-field edits require explicit resolution', async () => {
  const env = setup(), { s, c, a, b } = await clients(env);
  const one = doc('nota di A'); a.set(one); await a.sync();
  const two = doc('iniziale'); two.entries['school-0'].questions = 'domanda B'; b.set(two); await b.sync();
  let result = await s.decode(await s.request(c), c);
  assert.equal(result.entries['school-0'].note, 'nota di A'); assert.equal(result.entries['school-0'].questions, 'domanda B');
  await a.sync();
  a.set({ ...structuredClone(a.state.local), entries: { 'school-0': { ...a.state.local.entries['school-0'], note: 'nuova A' } } }); await a.sync();
  b.set({ ...structuredClone(b.state.local), entries: { 'school-0': { ...b.state.local.entries['school-0'], note: 'nuova B', parentB: 'da conservare' } } }); await b.sync();
  assert.equal(b.status, 'conflict'); assert.equal(b.conflicts.length, 1);
  assert.equal((await s.decode(await s.request(c), c)).entries['school-0'].note, 'nuova A');
  const restored = await s.SharedClient.restore(c, 'tab-b', () => {}); restored.schedule = () => {};
  assert.equal(restored.conflicts.length, 1);
  restored.resolve(['nota combinata']); await restored.sync();
  result = await s.decode(await s.request(c), c);
  assert.equal(result.entries['school-0'].note, 'nota combinata'); assert.equal(result.entries['school-0'].parentB, 'da conservare');
});
test('offline drafts survive refresh and an uncertain commit does not duplicate a write', async () => {
  const env = setup(), { s, c, a } = await clients(env);
  env.offline(true); a.set(doc('bozza offline')); await a.sync(); assert.equal(a.status, 'offline');
  const restored = await s.SharedClient.restore(c, 'tab-a', () => {}); restored.schedule = () => {};
  assert.equal(restored.state.local.entries['school-0'].note, 'bozza offline');
  env.offline(false); env.loseResponse(); await restored.sync(); assert.equal(restored.status, 'offline');
  const revision = (await s.request(c)).revision;
  await restored.sync(); assert.equal(restored.status, 'saved'); assert.equal((await s.request(c)).revision, revision);
  assert.equal((await s.decode(await s.request(c), c)).entries['school-0'].note, 'bozza offline');
});
test('storage failure prevents sending unsaved drafts; removal keeps notes; local adapter is separate', async () => {
  const env = setup(), { s, c, a } = await clients(env);
  env.failWrites(true); a.set(doc('non persistito')); await a.sync(); assert.equal(a.status, 'storage-error');
  assert.equal((await s.request(c)).revision, 1);
  const removed = doc('iniziale'); removed.saved = [];
  const other = doc('nuovo appunto'); const merged = s.merge(doc('iniziale'), removed, other);
  assert.equal(merged.document.saved.length, 0); assert.equal(merged.document.entries['school-0'].note, 'nuovo appunto');
});
