import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Exercise the actual storage/import module with browser storage isolated per test.
// The catalog boundary is a small fixture; catalog reconciliation has its own checks.
const source = stripTypeScriptTypes(readFileSync(new URL('../src/lib/family.ts', import.meta.url), 'utf8'))
  .replace(/import \{ schools, getSchool \} from ['"]\.\/catalog-client['"];?/, '')
  .replace(/^export /gm, '');
const fixture = Array.from({ length: 5 }, (_, i) => ({ id: `school-${i}`, legacyId: `old-${i}`, slug: `slug-${i}` }));

function setup(initial: Record<string, string> = {}, unavailable = false) {
  const stored = new Map(Object.entries(initial));
  const events: Array<{ type: string; detail: any }> = [];
  const context = vm.createContext({
    schools: fixture,
    getSchool: (id: string) => fixture.find(s => s.id === id || s.legacyId === id || s.slug === id),
    localStorage: {
      getItem: (key: string) => { if (unavailable) throw new Error('blocked'); return stored.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (unavailable) throw new Error('blocked'); stored.set(key, value); },
    },
    window: { dispatchEvent: (event: any) => events.push(event), addEventListener() {}, location: { origin: 'https://example.test' } },
    CustomEvent: class { type: string; detail: any; constructor(type: string, init: any) { this.type = type; this.detail = init.detail; } },
    URL,
  });
  vm.runInContext(`${source}\nglobalThis.api = { removeSavedSchool, restoreSavedSchool, loadFamily, saveFamily, toggleSaved, toggleCompare, updateSchool, exportFamily, parseFamilyImport, mergeFamilyImport, selectionLink, isFamilyStorageAvailable, setFamilyAdapter, isSharedFamily, localFamilyCopy };`, context);
  return { api: (context as any).api, stored, events };
}
const json = (value: any) => JSON.parse(JSON.stringify(value));

test('migrates original preferences and notes without deleting the old values', () => {
  const { api, stored } = setup({ 'paolo-schools-fav': '["old-0"]', 'paolo-schools-notes': '{"old-0":"Giardino visitato","old-1":"Da chiamare"}' });
  const state = api.loadFamily();
  assert.deepEqual(json(state.saved), ['school-0', 'school-1']);
  assert.equal(state.entries['school-0'].note, 'Giardino visitato');
  assert.ok(stored.has('paolo-schools-notes'));
  assert.ok(stored.has('scuole-milano-family-v1'));
});

test('limits comparison to three schools and canonicalizes legacy IDs', () => {
  const { api, events } = setup();
  api.toggleCompare('old-0'); api.toggleCompare('school-1'); api.toggleCompare('school-2');
  api.toggleCompare('school-3');
  assert.deepEqual(json(api.loadFamily().compare), ['school-0', 'school-1', 'school-2']);
  assert.ok(events.some(e => e.type === 'family:notice'));
  api.toggleCompare('school-0');
  assert.equal(api.loadFamily().compare.length, 2);
});

test('export/import validates before merging and retains both sets of notes', () => {
  const first = setup().api;
  first.updateSchool('school-0', { note: 'Prima visita', status: 'visitata' });
  const second = setup().api;
  second.updateSchool('school-0', { note: 'Altra osservazione', questions: 'Chiedere luglio', status: 'da-contattare' });
  const preview = first.parseFamilyImport(second.exportFamily());
  assert.equal(preview.schoolCount, 1);
  assert.equal(first.loadFamily().entries['school-0'].note, 'Prima visita');
  first.mergeFamilyImport(preview);
  const entry = first.loadFamily().entries['school-0'];
  assert.match(entry.note, /Prima visita/);
  assert.match(entry.note, /Altra osservazione/);
  assert.equal(entry.questions, 'Chiedere luglio');
  assert.equal(entry.status, 'visitata');
  assert.throws(() => first.parseFamilyImport('{broken'), /JSON valido/);
  assert.throws(() => first.parseFamilyImport(JSON.stringify({ format: 'other', version: 1 })), /esportato/);
});

test('a rejected merge does not partially alter the existing data', () => {
  const local = setup().api;
  local.updateSchool('school-0', { note: 'a'.repeat(9990) });
  const incoming = setup().api;
  incoming.updateSchool('school-0', { note: 'b'.repeat(100) });
  incoming.toggleSaved('school-1');
  const before = local.exportFamily();
  assert.throws(() => local.mergeFamilyImport(local.parseFamilyImport(incoming.exportFamily())), /supera/);
  assert.deepEqual(JSON.parse(local.exportFamily()).state, JSON.parse(before).state);
});

test('blocked storage keeps changes in memory and signals that they are not persisted', () => {
  const { api, events } = setup({}, true);
  api.updateSchool('school-0', { note: 'Da esportare' });
  assert.equal(api.loadFamily().entries['school-0'].note, 'Da esportare');
  assert.equal(api.isFamilyStorageAvailable(), false);
  assert.ok(events.some(e => e.type === 'family:change' && e.detail.persisted === false));
});

test('selection links contain public school IDs only', () => {
  const { api } = setup();
  api.updateSchool('school-0', { note: 'PRIVATE_NOTE', parentA: 'PRIVATE_PRIORITY' });
  const link = api.selectionLink();
  assert.equal(link, 'https://example.test/famiglia/?scuole=school-0');
  assert.doesNotMatch(link, /PRIVATE|note|parent/);
});

test('malformed entries cannot be imported and unknown schools are reported', () => {
  const { api } = setup();
  const file = { format: 'scuole-milano-family', version: 1, state: { version: 1, saved: ['school-0', 'unknown'], compare: [], entries: { 'school-0': { status: 'inventato', note: 'test' } } } };
  assert.throws(() => api.parseFamilyImport(JSON.stringify(file)), /stato visita/);
  file.state.entries['school-0'].status = 'visitata';
  const preview = api.parseFamilyImport(JSON.stringify(file));
  assert.equal(preview.ignoredCount, 1);
  assert.deepEqual(json(preview.state.saved), ['school-0']);
});


test('shared adapter keeps notes out of localStorage and returns to the original local copy', () => {
  const { api, stored } = setup();
  api.updateSchool('school-0', { note: 'Solo locale' });
  const original = stored.get('scuole-milano-family-v1');
  let shared = { version: 1, saved: ['school-1'], compare: [], entries: { 'school-1': { status: 'da-valutare', note: 'Condivisa', questions: '', parentA: '', parentB: '' } } };
  api.setFamilyAdapter({ load: () => shared, save: (state: any) => { shared = json(state); } });
  assert.equal(api.isSharedFamily(), true);
  api.updateSchool('school-1', { note: 'Modifica segreta' });
  assert.equal(shared.entries['school-1'].note, 'Modifica segreta');
  assert.equal(stored.get('scuole-milano-family-v1'), original);
  assert.equal(api.localFamilyCopy().entries['school-0'].note, 'Solo locale');
  api.setFamilyAdapter(null);
  assert.equal(api.loadFamily().entries['school-0'].note, 'Solo locale');
  assert.deepEqual(json(api.loadFamily().saved), ['school-0']);
});


test('undoing removal merges membership into current state without reverting newer notes or comparison', () => {
  const { api } = setup();
  api.updateSchool('school-0', { note: 'Primo appunto' });
  api.updateSchool('school-1', { note: 'Da conservare', status: 'visitata' });
  api.toggleSaved('school-2'); api.toggleCompare('school-1');
  const removal = api.removeSavedSchool('old-1');
  assert.deepEqual(json(removal), { id: 'school-1', index: 1 });
  assert.equal(api.loadFamily().entries['school-1'].note, 'Da conservare');
  api.updateSchool('school-0', { note: 'Appunto aggiornato nel frattempo' });
  api.toggleSaved('school-3'); api.toggleCompare('school-2');
  api.restoreSavedSchool(removal);
  const current = api.loadFamily();
  assert.deepEqual(json(current.saved), ['school-0', 'school-1', 'school-2', 'school-3']);
  assert.deepEqual(json(current.compare), ['school-1', 'school-2']);
  assert.equal(current.entries['school-0'].note, 'Appunto aggiornato nel frattempo');
  assert.equal(current.entries['school-1'].status, 'visitata');
  api.restoreSavedSchool(removal);
  assert.equal(api.loadFamily().saved.filter((id: string) => id === 'school-1').length, 1);
  assert.equal(api.removeSavedSchool('missing'), null);
});

test('undo removal is available in memory when browser storage is blocked', () => {
  const { api } = setup({}, true);
  api.updateSchool('school-0', { questions: 'Ambientamento?' });
  const removal = api.removeSavedSchool('school-0');
  assert.equal(api.loadFamily().saved.length, 0);
  api.restoreSavedSchool(removal);
  assert.deepEqual(json(api.loadFamily().saved), ['school-0']);
  assert.equal(api.loadFamily().entries['school-0'].questions, 'Ambientamento?');
});
