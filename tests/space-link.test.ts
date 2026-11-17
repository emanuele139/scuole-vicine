import test from 'node:test';
import assert from 'node:assert/strict';
import { hkdfSync } from 'node:crypto';
import QRCode from 'qrcode';
import { base64, credentials, createCredentials, credentialsFromSeed, restoreCredentials, link, parseLink, parseSpaceURL } from '../src/lib/shared/protocol.ts';

test('v2 derives domain-separated credentials using the same results as independent HKDF', async () => {
  const raw = Uint8Array.from({ length: 32 }, (_, i) => i), seed = base64(raw);
  const c = await credentialsFromSeed(seed);
  const salt = 'scuole-vicine/shared-space/v2';
  for (const [field, info, length] of [['id', 'id', 16], ['access', 'access', 32], ['key', 'encryption', 32]] as const) {
    assert.equal(c[field], base64(new Uint8Array(hkdfSync('sha256', raw, salt, info, length))));
  }
  assert.notEqual(c.key, c.access); assert.notEqual(c.seed, c.key); assert.notEqual(c.seed, c.access);
  const changed = await credentialsFromSeed(base64(raw.map(b => b ^ 1)));
  for (const field of ['id', 'access', 'key'] as const) assert.notEqual(c[field], changed[field]);
});

test('new spaces have 72-character links, less dense QRs and stable credentials after storage', async () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const c = await createCredentials(), url = link(c, 'https://scuolevicine.it');
    assert.equal(c.seed?.length, 43); assert.equal(c.key.length, 43); assert.equal(c.access.length, 43); assert.equal(c.id.length, 22);
    assert.equal(url.length, 72); assert.equal(new URL(url).hash.length, 46);
    assert.equal(new URL(url).pathname, '/s/'); assert.equal(new URL(url).search, '');
    assert.deepEqual(await parseSpaceURL(url, 'https://scuolevicine.it'), c);
    const restored = await restoreCredentials(JSON.parse(JSON.stringify(c)));
    assert.deepEqual(restored, c); assert.equal(link(restored!, 'https://scuolevicine.it'), url);
    assert.equal(QRCode.create(url, { errorCorrectionLevel: 'M' }).modules.size, 37);
    ids.add(c.id);
  }
  assert.equal(ids.size, 100);
});

test('v2 rejects malformed roots and mismatched persisted metadata without changing any old credentials', async () => {
  const c = await credentialsFromSeed(base64(new Uint8Array(32))), url = link(c, 'https://scuolevicine.it'), hash = new URL(url).hash;
  for (const invalid of [hash.slice(0, -1), hash + 'A', hash + '=', hash.slice(0, -1) + 'B', '#2.%20', '#2.' + 'a'.repeat(42), '#2.' + 'a'.repeat(44)]) assert.equal(await parseLink(invalid), null);
  for (const field of ['id', 'access', 'key', 'seed'] as const) {
    const other = await createCredentials();
    const tampered = { ...c, [field]: other[field] };
    assert.equal(await restoreCredentials(tampered), null);
    assert.throws(() => link(tampered, 'https://scuolevicine.it'), /verificate/);
  }
  assert.throws(() => link(JSON.parse(JSON.stringify(c)), 'https://scuolevicine.it'), /verificate/);
  await assert.rejects(credentialsFromSeed('too-short'));
  const old = credentials(), restored = await restoreCredentials(old);
  assert.deepEqual(restored, old); assert.equal(link(restored!, 'https://scuolevicine.it'), link(old, 'https://scuolevicine.it'));
});

test('compact links preserve all 640 random bits and accept every existing space', async () => {
  for (let i = 0; i < 100; i++) {
    const c = credentials(), compact = link(c, 'https://scuolevicine.it');
    const old = `https://scuolevicine.it/famiglia/#${new URLSearchParams({ spazio: c.id, accesso: c.access, chiave: c.key })}`;
    assert.deepEqual(await parseLink(new URL(compact).hash), c);
    assert.deepEqual(await parseSpaceURL(old, 'https://scuolevicine.it'), c);
    assert.deepEqual(await parseSpaceURL(compact, 'https://scuolevicine.it'), c);
    assert.ok(compact.length < old.length);
    assert.equal(new URL(compact).hash.length, 110);
    assert.equal(new URL(compact).pathname, '/s/');
    assert.equal(new URL(compact).search, '');
    assert.equal(compact.split('#')[0], 'https://scuolevicine.it/s/');
  }
});
test('packing preserves leading zero bytes and rejects truncated, extended or noncanonical encodings', async () => {
  const c = { id: base64(new Uint8Array(16)), access: base64(new Uint8Array(32)), key: base64(new Uint8Array(32)) };
  const url = link(c, 'https://scuolevicine.it'), hash = new URL(url).hash;
  assert.deepEqual(await parseLink(hash), c);
  for (const invalid of [hash.slice(0, -1), hash + 'A', hash + '=', hash.slice(0, -1) + 'B', '#1.%20', '#2.' + hash.slice(3)]) assert.equal(await parseLink(invalid), null);
  for (const invalid of [url.replace('/s/', '/private/'), url.replace('/s/', '/s/?tracking=true'), url.replace('https://', 'http://'), url.replace('https://', 'https://user@')]) assert.equal(await parseSpaceURL(invalid, 'https://scuolevicine.it'), null);
});
