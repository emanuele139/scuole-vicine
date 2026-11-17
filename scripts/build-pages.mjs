import { build } from 'esbuild';
import { access, readFile, readdir, writeFile } from 'node:fs/promises';
import { blockedInlineScripts } from './audit-client-scripts.mjs';
// Build only after Astro, in a public copy without local guides.
try { await access('src/pages/design.astro'); throw new Error('Esegui la build Pages nella copia pubblica, senza la guida locale.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await access('dist/index.html');
const pages = (await readdir('dist', { recursive: true })).filter(path => path.endsWith('.html'));
for (const page of pages) {
  if (blockedInlineScripts(await readFile(`dist/${page}`, 'utf8')).length) {
    throw new Error(`Script inline incompatibile con la CSP di produzione: ${page}`);
  }
}
await build({ entryPoints: ['worker/pages.ts'], outfile: 'dist/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
