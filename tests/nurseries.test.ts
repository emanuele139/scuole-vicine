import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const preschools = read('../src/data/schools.json');
const nurseries = read('../src/data/nurseries.json');
const clientNurseries = read('../src/data/nurseries-client.json');
const ids = (rows: any[]) => rows.map(s => s.id).sort();

test('0–3 records retain independent identities and cannot replace a preschool at the same address', () => {
  const combined = [...preschools, ...nurseries];
  assert.ok(nurseries.length > 0);
  assert.equal(new Set(combined.map(s => s.id)).size, combined.length);
  assert.equal(new Set(combined.map(s => s.slug)).size, combined.length);
  for (const school of nurseries) {
    assert.equal(school.educationStage, 'nursery');
    assert.ok(school.serviceType && school.ageRange && school.accessMode);
    assert.ok(school.sources.length > 0, school.id);
    assert.ok(school.municipality === null || (Number.isInteger(school.municipality) && school.municipality >= 1 && school.municipality <= 9), school.id);
    assert.equal(school.lat === null, school.lng === null, school.id);
    if (school.lat !== null) {
      assert.ok(school.lat > 45.35 && school.lat < 45.62, school.id);
      assert.ok(school.lng > 8.95 && school.lng < 9.45, school.id);
      assert.ok(school.locationYear, school.id);
    }
  }
});

test('the browser catalog preserves all nursery identities, types, locations and events', () => {
  assert.deepEqual(ids(clientNurseries), ids(nurseries));
  const byId = new Map(nurseries.map((s: any) => [s.id, s]));
  for (const client of clientNurseries) {
    const full: any = byId.get(client.id);
    for (const [key, value] of Object.entries(client)) assert.deepEqual(value, full[key], `${client.id}: ${key}`);
    assert.equal(client.research, undefined);
    assert.equal(client.sources, undefined);
  }
});

test('nursery coverage reports limitations and does not manufacture fees, events or family contacts', () => {
  const report = read('../public/dati/copertura-nidi.json');
  assert.equal(report.total, nurseries.length);
  assert.equal(report.geolocated, nurseries.filter((s: any) => s.lat !== null).length);
  assert.equal(report.geolocated, report.geolocatedCurrent + report.geolocatedHistorical);
  assert.equal(report.confirmedMunicipalAccess, nurseries.filter((s: any) => s.sourceIds.municipal).length);
  assert.ok(report.limits.length > 0);
  for (const school of nurseries) {
    assert.equal(school.code, null, 'CUDES is not a MIM school code');
    if (school.cost) assert.ok(school.research?.fieldEvidence.cost.sourceUrls.length, 'a fee needs its own evidence');
    for (const event of school.events) assert.match(event.source, /^https:\/\//);
    if (school.serviceType === 'Nido famiglia') {
      assert.equal(school.operator, null);
      assert.equal(school.email, null);
      assert.equal(school.phone, null);
    }
  }
});

test('canonical and browser lookups support both stages and retain every existing family ID', () => {
  for (const [file, imports] of [
    ['../src/lib/catalog.ts', { schoolData: preschools, nurseryData: nurseries, reportData: read('../src/data/reconciliation-report.json') }],
    ['../src/lib/catalog-client.ts', { data: read('../src/data/catalog-client.json'), nurseryData: clientNurseries }],
  ] as const) {
    const source = stripTypeScriptTypes(readFileSync(new URL(file, import.meta.url), 'utf8'))
      .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
    const context = vm.createContext({ ...imports });
    vm.runInContext(`${source}\nglobalThis.api = {schools, getSchool};`, context);
    const { api } = context as any;
    assert.equal(api.schools.length, preschools.length + nurseries.length);
    for (const school of [...preschools, ...nurseries]) {
      assert.equal(api.getSchool(school.id)?.id, school.id);
      assert.equal(api.getSchool(school.slug)?.id, school.id);
      if (school.legacyId) assert.equal(api.getSchool(school.legacyId)?.id, school.id);
    }
    assert.ok(api.schools.every((s: any) => s.educationStage && s.ageRange && s.serviceType));
  }
});
