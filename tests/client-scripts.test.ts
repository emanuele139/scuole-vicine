import test from 'node:test';
import assert from 'node:assert/strict';
import { blockedInlineScripts } from '../scripts/audit-client-scripts.mjs';

test('production script audit detects inline guide behavior blocked by CSP', () => {
  for (const type of ['', ' type="module"', ' type="text/javascript"']) {
    assert.equal(blockedInlineScripts(`<script${type}>document.querySelector('.source-trigger').addEventListener('click', openNote)</script>`).length, 1);
  }
});

test('external guide scripts and inert catalog/schema data remain allowed', () => {
  assert.equal(blockedInlineScripts(`<script type="module" src="/_astro/guide.js"></script>
    <script type="application/json">{"schools":[]}</script>
    <script type="application/ld+json">{"@type":"Article"}</script>`).length, 0);
});
