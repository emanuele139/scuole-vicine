/** Collect the installed production dependencies' licenses for the static distribution. */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const sections = ['Licenze delle dipendenze di produzione installate\n\nLe licenze originali rimangono applicabili. Questo elenco include anche strumenti di build; non tutti i pacchetti vengono inviati al browser. I pacchetti opzionali di altre piattaforme non installati non sono inclusi.\n'];
const missing = [];
for (const [location, entry] of Object.entries(lock.packages).sort(([a], [b]) => a.localeCompare(b))) {
  if (!location || entry.dev) continue;
  const directory = resolve(root, location);
  if (!existsSync(resolve(directory, 'package.json'))) continue;
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const files = readdirSync(directory, { withFileTypes: true }).filter(file => file.isFile() && /^(licen[cs]e|copying|notice)(\.|$|-)/i.test(file.name)).map(file => file.name).sort();
  if (!files.length) missing.push(pkg.name);
  sections.push(`\n${'='.repeat(72)}\n${pkg.name} ${pkg.version}\nLicenza dichiarata: ${entry.license || pkg.license || 'Vedere upstream'}\nSorgente: ${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url || pkg.homepage || entry.resolved || ''}\n`);
  if (!files.length) sections.push(`Avviso: file LICENSE autonomo non incluso nel pacchetto. Autore dichiarato: ${typeof pkg.author === 'string' ? pkg.author : pkg.author?.name || 'Vedere upstream'}. Consultare il sorgente upstream per il testo completo.\n`);
  for (const file of files) sections.push(`\n--- ${file} ---\n${readFileSync(resolve(directory, file), 'utf8')}\n`);
}
if (missing.length) sections.push(`\nPacchetti che non includono un file LICENSE autonomo (vedere licenza dichiarata e sorgente upstream sopra): ${missing.join(', ')}\n`);
writeFileSync(resolve(root, 'public/third-party-licenses.txt'), sections.join('\n').replace(/\r\n/g, '\n'));
console.log('Aggiornato public/third-party-licenses.txt');
