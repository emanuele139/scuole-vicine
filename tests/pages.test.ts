import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const security = readFileSync(new URL('../worker/security.ts', import.meta.url), 'utf8').replace(/^export /gm, '');
const pages = readFileSync(new URL('../worker/pages.ts', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace('export default', 'const handler =');
const context = vm.createContext({ Request, Response, URL });
vm.runInContext(ts.transpileModule(security + '\n' + pages, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText + '\nglobalThis.handler = handler;', context);
const handler = (context as any).handler;
test('Pages forwards API requests unchanged to its internal binding and never sends their body to assets', async () => {
  const request = new Request('https://scuolevicine.it/api/spaces/test?revision=2', { method: 'PUT', headers: { Authorization: 'Bearer synthetic-test', Origin: 'https://scuolevicine.it' }, body: 'encrypted-test-envelope' });
  const response = await handler.fetch(request, { BACKEND: { async fetch(received: Request) {
    assert.equal(received.url, request.url); assert.equal(received.method, 'PUT');
    assert.equal(received.headers.get('authorization'), 'Bearer synthetic-test');
    assert.equal(received.headers.get('origin'), 'https://scuolevicine.it');
    assert.equal(await received.text(), 'encrypted-test-envelope');
    return new Response('revision-conflict', { status: 409 });
  } }, ASSETS: { fetch() { throw new Error('API data reached assets'); } } });
  assert.equal(response.status, 409); assert.equal(await response.text(), 'revision-conflict');
});
test('www and HTTP redirect to HTTPS canonical origin while retaining paths and queries', async () => {
  for (const url of ['https://www.scuolevicine.it/guide/?tema=costi', 'http://scuolevicine.it/guide/?tema=costi']) {
    const response = await handler.fetch(new Request(url), {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://scuolevicine.it/guide/?tema=costi');
  }
});
test('static security headers and noindex protect personal pages, missing pages and technical deployment hosts', async () => {
  for (const [url, status, noindex] of [
    ['https://scuolevicine.it/', 200, false], ['https://scuolevicine.it/famiglia/', 200, true], ['https://scuolevicine.it/s/', 200, true],
    ['https://scuole-vicine.pages.dev/', 200, true], ['https://scuolevicine.it/missing/', 404, true],
  ] as const) {
    const response = await handler.fetch(new Request(url), { ASSETS: { async fetch() { return new Response('static-content', { status }); } } });
    assert.equal(response.status, status); assert.equal(await response.text(), 'static-content');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));
    assert.equal(response.headers.has('x-robots-tag'), noindex);
  }
});
