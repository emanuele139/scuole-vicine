import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createCredentials, link } from '../src/lib/shared/protocol.ts';
const bundle = (await build({
  entryPoints: ['src/lib/shared/controller.ts'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'controller',
  plugins: [{ name: 'isolated-family', setup(build) {
    build.onLoad({ filter: /\/catalog-client\.ts$/ }, () => ({ contents: 'export const getSchool = id => ({id});', loader: 'js' }));
    build.onLoad({ filter: /\/family\.ts$/ }, () => ({ contents: 'export const loadFamily = () => ({saved:[],entries:{},compare:[]}); export const setFamilyAdapter = () => {};', loader: 'js' }));
  } }],
})).outputFiles[0].text;

test('v2 fragments are erased before crypto awaits; late parsing cannot replace a newer invitation', async () => {
  const first = await createCredentials(), second = await createCredentials();
  const callbacks = new Map<string, () => void>(), gates: Array<() => void> = [];
  const location = { origin: 'https://scuole.test', pathname: '/s/', search: '', hash: new URL(link(first, 'https://scuole.test')).hash };
  const history: string[] = [], main = { inert: false, setAttribute() {}, removeAttribute() {} };
  const subtle = new Proxy(crypto.subtle, { get(target, name) {
    if (name === 'importKey') return (...args: Parameters<SubtleCrypto['importKey']>) => new Promise(resolve => gates.push(() => resolve((crypto.subtle.importKey as Function)(...args))));
    const value = Reflect.get(target, name); return typeof value === 'function' ? value.bind(target) : value;
  } });
  const context: any = {
    crypto: { subtle, getRandomValues: crypto.getRandomValues.bind(crypto) }, URL, URLSearchParams, Uint8Array, TextEncoder, TextDecoder, btoa, atob, structuredClone,
    location, history: { replaceState(_state: unknown, _unused: string, url: string) { history.push(url); location.hash = ''; } },
    document: { querySelector: (s: string) => s === 'main' ? main : null, getElementById: () => null, addEventListener() {} },
    window: { addEventListener: (type: string, fn: () => void) => callbacks.set(type, fn), dispatchEvent() {} },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null },
    setInterval: () => 0, setTimeout: () => 0, CustomEvent: class {},
  };
  runInNewContext(bundle, context);
  assert.equal(location.hash, ''); assert.equal(history[0], '/s/'); assert.equal(main.inert, true);
  assert.equal(gates.length, 1);
  location.hash = new URL(link(second, 'https://scuole.test')).hash; callbacks.get('hashchange')!();
  assert.equal(location.hash, ''); assert.equal(gates.length, 2);
  gates[1](); await new Promise(setImmediate);
  gates[0](); await context.controller.ready;
  assert.equal(context.controller.sharedInfo().incoming.id, second.id);
  assert.equal(context.controller.sharedInfo().error, ''); assert.equal(main.inert, false);
  assert.deepEqual(history, ['/s/', '/s/']);
});
