import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
function setup(emailFails = false) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0002_school_reports.sql', import.meta.url), 'utf8'));
  sqlite.exec(readFileSync(new URL('../migrations/0003_report_notifications.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql: string) { return { bind(...values: any[]) { return {
    async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
  }; } }; } };
  const messages: any[] = [];
  const REPORT_EMAIL = { async send(message: any) { if (emailFails) throw new Error('temporary delivery failure'); messages.push(message); return { messageId: 'test' }; } };
  const preschool = JSON.parse(readFileSync(new URL('../src/data/catalog-client.json', import.meta.url), 'utf8'));
  const nurseries = JSON.parse(readFileSync(new URL('../src/data/nurseries-client.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../worker/reports.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({ preschool, nurseries, Request, Response, URL, Uint8Array, TextDecoder, crypto: globalThis.crypto });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText + '\nglobalThis.reportApi = reportApi; globalThis.flushReportEmails = flushReportEmails;', context);
  const valid = { schoolId: preschool[0].id, category: 'hours', email: 'utente@example.org', details: 'Orario fino alle 18. Fonte: https://example.org/' };
  function send(value: unknown = valid, headers: Record<string, string> = {}, method = 'POST', notify = false) {
    return (context as any).reportApi(new Request('https://scuole.test/api/reports', { method, headers: { 'Content-Type': 'application/json', Origin: 'https://scuole.test', ...headers }, ...(method === 'POST' ? { body: typeof value === 'string' ? value : JSON.stringify(value) } : {}) }), { DB, ...(notify ? { REPORT_EMAIL, REPORT_FROM: 'segnalazioni@scuolevicine.it' } : {}) });
  }
  return { sqlite, send, valid, nurseryId: nurseries[0].id, messages, retry: () => (context as any).flushReportEmails({ DB, REPORT_EMAIL, REPORT_FROM: 'segnalazioni@scuolevicine.it' }) };
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

test('report email goes only to the owner with fixed sender and visitor reply-to; retry does not duplicate accepted messages', async () => {
  const { send, valid, messages, sqlite, retry } = setup();
  assert.equal((await send(valid, {}, 'POST', true)).status, 201);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'emanuele@cardinali.studio');
  assert.equal(messages[0].from, 'segnalazioni@scuolevicine.it');
  assert.equal(messages[0].replyTo, valid.email);
  assert.ok(messages[0].text.includes(valid.details));
  assert.ok(sqlite.prepare('SELECT email_sent_at FROM school_reports').get()!.email_sent_at);
  await retry();
  assert.equal(messages.length, 1);
});
test('mail failure preserves an accepted report for scheduled retries and leases prevent immediate repeated sends', async () => {
  const { send, valid, messages, sqlite, retry } = setup(true);
  assert.equal((await send(valid, {}, 'POST', true)).status, 201);
  assert.equal(messages.length, 0);
  const row = sqlite.prepare('SELECT * FROM school_reports').get()!;
  assert.equal(row.email_sent_at, null);
  assert.equal(row.email_attempts, 1);
  await retry();
  assert.equal(sqlite.prepare('SELECT email_attempts FROM school_reports').get()!.email_attempts, 1);
});
test('scheduled retries deliver pending reports and ignore expired reports', async () => {
  const { send, valid, messages, sqlite, retry } = setup();
  await send(valid);
  await retry();
  assert.equal(messages.length, 1);
  await send(valid);
  sqlite.prepare('UPDATE school_reports SET expires_at = 0 WHERE email_sent_at IS NULL').run();
  await retry();
  assert.equal(messages.length, 1);
});
