import { build } from 'esbuild';
import { access, writeFile } from 'node:fs/promises';
// Build only after Astro, in a public copy without local guides.
try { await access('src/pages/design.astro'); throw new Error('Esegui la build Pages nella copia pubblica, senza la guida locale.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await access('dist/index.html');
await build({ entryPoints: ['worker/pages.ts'], outfile: 'dist/_worker.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
await writeFile('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
