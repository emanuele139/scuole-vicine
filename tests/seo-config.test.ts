import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seoSettings } from '../seo.config.mjs';

test('indexing requires an explicit production build and uses the approved canonical host', () => {
  assert.deepEqual(seoSettings({}), { site: 'https://scuolevicine.it', indexable: false });
  assert.equal(seoSettings({ SEO_INDEXABLE: 'false' }).indexable, false);
  assert.equal(seoSettings({ SEO_INDEXABLE: 'true' }).indexable, true);
});
test('canonical origin rejects credentials, local hosts, paths and malformed release settings', () => {
  for (const SITE_URL of ['http://scuolevicine.it', 'https://localhost', 'https://127.0.0.1', 'https://scuolevicine.it/test/', 'https://name:secret@scuolevicine.it', 'https://scuolevicine.it/?q=1', 'https://scuolevicine.it/#hash', 'https://scuolevicine.it:4321']) {
    assert.throws(() => seoSettings({ SITE_URL }));
  }
  assert.throws(() => seoSettings({ SEO_INDEXABLE: 'yes' }));
});
