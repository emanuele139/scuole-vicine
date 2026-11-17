import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
function setup() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0002_school_reports.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql: string) { return { bind(...values: any[]) { return { async run() { sqlite.prepare(sql).run(...values); } }; } }; } };
  const preschool = JSON.parse(readFileSync(new URL('../src/data/catalog-client.json', import.meta.url), 'utf8'));
  const nurseries = JSON.parse(readFileSync(new URL('../src/data/nurseries-client.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../worker/reports.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({ preschool, nurseries, Request, Response, URL, Uint8Array, TextDecoder, crypto: globalThis.crypto });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText + '\nglobalThis.reportApi = reportApi;', context);
  const valid = { schoolId: preschool[0].id, category: 'hours', email: 'utente@example.org', details: 'Orario fino alle 18. Fonte: https://example.org/' };
  function send(value: unknown = valid, headers: Record<string, string> = {}, method = 'POST') {
    return (context as any).reportApi(new Request('https://scuole.test/api/reports', { method, headers: { 'Content-Type': 'application/json', Origin: 'https://scuole.test', ...headers }, ...(method === 'POST' ? { body: typeof value === 'string' ? value : JSON.stringify(value) } : {}) }), { DB });
  }
  return { sqlite, send, valid, nurseryId: nurseries[0].id };
}
test('reports persist school, category and contact for preschool and nursery; no email in response', async () => {
  const { sqlite, send, valid, nurseryId } = setup();
  for (const schoolId of [valid.schoolId, nurseryId]) {
    const response = await send({ ...valid, schoolId, email: ' utente@example.org ' });
    assert.equal(response.status, 201); assert.deepEqual(await response.json(), { received: true });
  }
  const rows = sqlite.prepare('SELECT * FROM school_reports').all();
  assert.equal(rows.length, 2); assert.equal(rows[0].email, valid.email); assert.equal(rows[0].details, valid.details);
  assert.equal(Number(rows[0].expires_at) - Number(rows[0].created_at), 365 * 86400);
});
test('invalid email, school, category and missing other details never create a report', async () => {
  const { sqlite, send, valid } = setup();
  for (const patch of [{ email: '' }, { email: 'invalid' }, { email: 'a@b.c\r\nBcc:x@y.z' }, { schoolId: 'unknown' }, { category: 'unknown' }, { category: 'other', details: '   ' }, { details: 'a'.repeat(3001) }, { details: 123 }]) {
    assert.equal((await send({ ...valid, ...patch })).status, 400);
  }
  for (const value of ['{', 'null', '[]']) assert.equal((await send(value)).status, 400);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM school_reports').get()!.count, 0);
});
test('reports reject cross-site requests, wrong methods, wrong content type and oversized streams', async () => {
  const { send, valid } = setup();
  assert.equal((await send(valid, { Origin: 'https://other.test' })).status, 403);
  assert.equal((await send(valid, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await send(valid, {}, 'GET')).status, 405);
  assert.equal((await send(valid, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await send('a'.repeat(16385))).status, 413);
});
