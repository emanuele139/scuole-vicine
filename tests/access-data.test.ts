import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('territorial research covers the exact 23 neighbours with distinct service rules and evidence', () => {
  const data = read('../src/data/territorial-access.json');
  const expected = ['Arese','Assago','Baranzate','Bollate','Bresso','Buccinasco','Cesano Boscone','Cologno Monzese','Cormano','Corsico','Cusago','Novate Milanese','Opera','Pero','Peschiera Borromeo','Rho','Rozzano','San Donato Milanese','Segrate','Sesto San Giovanni','Settimo Milanese','Trezzano sul Naviglio','Vimodrone'];
  assert.deepEqual(data.municipalities.map((m: any) => m.name).sort(), expected.sort());
  assert.equal(new Set(data.municipalities.map((m: any) => m.slug)).size, 23);
  for (const municipality of data.municipalities) {
    assert.match(municipality.slug, /^[a-z0-9-]+$/);
    assert.deepEqual(municipality.services.map((s: any) => `${s.stage}/${s.management}`).sort(), ['nursery/Comunale','preschool/Comunale','preschool/Statale'].sort());
    for (const service of municipality.services) {
      assert.ok(['verified','partial','not-found'].includes(service.status));
      for (const field of ['eligibility','priority','costs','benefits','application','year']) assert.ok(service[field]?.trim(), `${municipality.name}: ${field}`);
      assert.ok(service.sources.length > 0, `${municipality.name}: missing provenance`);
      for (const source of service.sources) assert.match(source.url, /^https:\/\//);
      for (const tariff of service.tariffExamples || []) {
        assert.ok(tariff.year && tariff.conditions && tariff.unit, `${municipality.name}: tariff lacks scope`);
        assert.ok(Number.isFinite(Number(tariff.amount)) && Number(tariff.amount) >= 0);
      }
    }
  }
});

test('Milan access overlay accounts for every existing school without changing identities or inferring individual evidence', () => {
  const schools = [...read('../src/data/schools.json'), ...read('../src/data/nurseries.json')];
  const data = read('../src/data/milan-access.json');
  const records = new Map(data.records.map((record: any) => [record.id, record]));
  assert.equal(records.size, schools.length);
  assert.equal(data.records.length, schools.length);
  for (const school of schools) {
    const record: any = records.get(school.id);
    assert.ok(record, school.id);
    assert.equal(record.municipalityName, 'Milano');
    assert.equal(record.stage, school.educationStage || 'preschool');
    assert.ok(['network','school','unknown'].includes(record.evidenceScope));
    assert.ok(['verified','partial','needs-confirmation'].includes(record.status));
    for (const field of ['eligibility','priority','costs','benefits','application']) {
      assert.ok(record[field], `${school.id}: missing ${field}`);
      assert.ok(record.fieldEvidence?.[field], `${school.id}: missing evidence for ${field}`);
      const evidence = record.fieldEvidence[field];
      if (evidence.status === 'verified') assert.ok(evidence.sourceUrls.length > 0, `${school.id}: unsourced verification`);
    }
    if (record.evidenceScope === 'unknown') assert.notEqual(record.status, 'verified', `${school.id}: unknown scope cannot certify individual rules`);
  }
});

test('all guide source references resolve and territorial guides keep explicit scope', () => {
  const data = read('../src/data/guides.json');
  const slugs = new Set<string>();
  for (const guide of data.guides) {
    assert.ok(!slugs.has(guide.slug)); slugs.add(guide.slug);
    const ids = new Set<string>();
    for (const question of guide.questions) {
      assert.ok(!ids.has(question.id), `${guide.slug}: duplicate anchor`); ids.add(question.id);
      assert.ok(question.refs.length > 0);
      for (const ref of question.refs) assert.ok(data.sources[ref]?.url, `${guide.slug}/${question.id}: broken source ${ref}`);
    }
  }
  for (const slug of ['nido-fuori-comune','infanzia-fuori-comune']) {
    const guide = data.guides.find((g: any) => g.slug === slug);
    assert.ok(guide?.territorial && guide.checkedAt);
  }
});

test('documented municipal place fees reach cards and suspended school websites cannot be promoted as official', async () => {
  const bundled = await build({entryPoints:[new URL('../src/lib/access.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false});
  const access = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const nurseries = read('../src/data/nurseries.json');
  const schools = read('../src/data/schools.json');
  const nursery = nurseries.find((s:any)=>s.id==='nido-cudes-047991');
  assert.equal(nursery.cost,null);
  const fee = access.schoolCost(nursery);
  assert.match(fee.value,/Posto comunale/);
  assert.equal(fee.evidence.status,'operator-rule');
  assert.ok(fee.evidence.sourceUrls.length);
  const dualRoute = nurseries.find((s:any)=>s.id==='nido-cudes-094133');
  const dualFee = access.schoolCost(dualRoute);
  assert.ok(dualFee.value.includes(dualRoute.cost), 'private fee must survive the municipal overlay');
  assert.match(dualFee.value,/Iscrizione privata/);
  assert.match(dualFee.alternative,/Posto comunale/);
  const swiss = schools.find((s:any)=>s.id==='mi-1036');
  assert.equal(access.schoolWebsiteAllowed(swiss,swiss.url),false);
  assert.equal(access.schoolWebsiteAllowed(swiss,swiss.officialPage),false);
  assert.ok(access.getSchoolAccess(swiss.id).websiteWarning);
  assert.equal(access.schoolWebsiteAllowed(swiss,'javascript:alert(1)'),false);
  assert.equal(access.schoolWebsiteAllowed(schools[0],'https://www.comune.milano.it/'),true);
});
