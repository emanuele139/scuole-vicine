// A synthetic link on the reserved .example domain: never use real credentials
// in design previews, screenshots or checked-in research artifacts.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { base64, credentialsFromSeed, link } from '../src/lib/shared/protocol.ts';
await mkdir('tmp/pdfs', { recursive: true });
await mkdir('output/pdf', { recursive: true });
await build({ entryPoints: ['src/lib/shared/pass-pdf.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'tmp/pdfs/pass-pdf.cjs' });
const { createSpacePassPDF } = createRequire(import.meta.url)('../tmp/pdfs/pass-pdf.cjs');
const url = link(await credentialsFromSeed(base64(new Uint8Array(32).fill(34))), 'https://scuolevicine.example');
const data = await createSpacePassPDF(url, { display: await readFile('public/fonts/font-2.ttf'), body: await readFile('public/fonts/font-4.ttf') });
await writeFile('output/pdf/scuole-vicine-pass-esempio.pdf', data);
await writeFile('tmp/pdfs/expected-url.txt', url);
console.log(`PDF dimostrativo generato: ${data.length} byte. Nessun accesso reale.`);
