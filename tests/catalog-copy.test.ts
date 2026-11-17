import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { catalogText, catalogParagraphs } from '../src/lib/catalog-copy.ts';

const records = ['schools', 'nurseries'].flatMap(name => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8')));
const fields = ['description', 'hours', 'cost', 'services', 'warnings', 'accessMode', 'recognition', 'openDay'];
const numbers = (value: string) => value.match(/\d+(?:[.,:/]\d+)*/g) ?? [];
const links = (value: string) => value.match(/(?:https?:\/\/|www\.)[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];

test('catalogue editorial presentation preserves numbers, contact links and raw records across every prose field', () => {
  const before = JSON.stringify(records);
  for (const record of records) {
    for (const field of fields) {
      for (const value of [record[field]].flat()) {
        if (typeof value !== 'string') continue;
        const rendered = catalogText(value);
        assert.deepEqual(numbers(rendered), numbers(value), `${record.id}: ${field} numeric facts`);
        assert.deepEqual(links(rendered), links(value), `${record.id}: ${field} links`);
        assert.equal(catalogText(rendered), rendered, `${record.id}: ${field} repeated rendering`);
        assert.equal(catalogParagraphs(value).join(' '), rendered, `${record.id}: ${field} paragraph content`);
      }
    }
  }
  assert.equal(JSON.stringify(records), before);
});

test('catalogue presentation explains registry, common municipal rules and simultaneous teacher presence', () => {
  assert.match(catalogText('Nido d’infanzia presente nel registro regionale delle unità di offerta sociali al 31 ottobre 2026.'), /elenco regionale dei servizi per la prima infanzia/);
  assert.match(catalogText('Rete comunale 2026/27: lunedì–venerdì 7:30–16:15; prolungamento fino alle 18:00 subordinato ai requisiti del bando.'), /Indicazioni generali del Comune per le scuole comunali/);
  assert.match(catalogText('Due docenti organizzati su turni, con compresenza al pasto: non dedurre due adulti presenti durante tutta la giornata.'), /Durante la visita puoi chiedere come sono organizzati i turni/);
  assert.match(catalogText('La quota resta da verificare; chiedere chiarimento alla segreteria.'), /Puoi chiedere un chiarimento alla segreteria/);
});
