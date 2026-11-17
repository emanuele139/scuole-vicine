import test from 'node:test';
import assert from 'node:assert/strict';
import { makeConsent, parseConsent, analyticsPath } from '../src/lib/consent.ts';
const now = new Date('2026-11-17T12:00:00Z').getTime();
test('no consent on missing, corrupt, stale, future or changed-purpose records', () => {
  for (const value of [null, '', '{', '{}', JSON.stringify({...makeConsent(true,true,now),version:2}), JSON.stringify(makeConsent(true,true,now+1)), JSON.stringify(makeConsent(true,true,now-366*86400000))]) assert.equal(parseConsent(value,now), null);
});
test('accept and reject retain independent categories for the same six months', () => {
  for (const [a,m] of [[true,false],[false,true],[false,false],[true,true]]) {
    const consent=makeConsent(a,m,now);
    assert.deepEqual(parseConsent(JSON.stringify(consent),now),consent);
    assert.equal(parseConsent(JSON.stringify(consent),consent.expiresAt),null);
    assert.equal(consent.expiresAt,new Date('2027-05-17T12:00:00Z').getTime());
  }
});
test('personal pages and URL payloads cannot enter analytics', () => {
  for (const path of ['/famiglia/','/s/','/s/#1.secret','/confronto/','/privacy/','/design/','/api/reports','/?q=via+roma','/famiglia/#chiave=secret','/scuole/a/?email=test@example.org']) assert.equal(analyticsPath(path),null);
  for (const path of ['/','/scuole/scuola-esempio/','/guide/come-scegliere/','/nidi/','/municipi/9/']) assert.equal(analyticsPath(path),path);
});
