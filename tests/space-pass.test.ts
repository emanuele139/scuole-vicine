import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { createCredentials, link } from '../src/lib/shared/protocol.ts';
const code = (await build({ entryPoints: ['src/lib/shared/pass-pdf.ts'], bundle: true, write: false, platform: 'node', format: 'cjs' })).outputFiles[0].text;
const module = { exports: {} as any };
new Function('require', 'module', 'exports', code)(createRequire(import.meta.url), module, module.exports);
const { createSpacePassPDF, downloadSpacePass } = module.exports;
const assets = { display: readFileSync('public/fonts/font-2.ttf'), body: readFileSync('public/fonts/font-4.ttf') };

test('personal pass is one A4 with exact clickable secret URLs and no secret in metadata', async () => {
  const url = link(await createCredentials(), 'https://scuolevicine.example');
  const data = await createSpacePassPDF(url, assets);
  const pdf = await PDFDocument.load(data);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPage(0).getWidth() - 595.28) < .01);
  assert.ok(Math.abs(pdf.getPage(0).getHeight() - 841.89) < .01);
  const annots = pdf.getPage(0).node.Annots()!;
  const urls = annots.asArray().map(ref => (pdf.context.lookup(ref) as any).lookup(PDFName.of('A')).lookup(PDFName.of('URI')).decodeText());
  assert.equal(urls.filter(value => value === url).length, 3);
  assert.ok(![pdf.getTitle(), pdf.getSubject(), pdf.getAuthor()].some(value => value?.includes(url)));
  await assert.rejects(createSpacePassPDF('https://scuolevicine.example/s/#incomplete', assets));
});
test('PDF assets load only from this site; network failure or changed space cannot start a download', async t => {
  const calls: string[] = [];
  const url = link(await createCredentials(), 'https://scuolevicine.example');
  const fetch = t.mock.method(globalThis, 'fetch', async (path: Parameters<typeof globalThis.fetch>[0]) => {
    calls.push(String(path)); throw new Error('offline');
  });
  await assert.rejects(downloadSpacePass(url), /offline/);
  assert.deepEqual(calls.sort(), ['/fonts/font-2.ttf', '/fonts/font-4.ttf']);
  fetch.mock.mockImplementation(async (path: Parameters<typeof globalThis.fetch>[0]) => new Response(String(path).includes('font-2') ? assets.display : assets.body));
  // A successful preparation for a space that has since closed never reaches DOM/download APIs.
  await assert.rejects(downloadSpacePass(url, () => false), /spazio aperto è cambiato/);
});
