import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown, markdownHeaders } from '../integrations/markdown.mjs';
import { markdownPath, htmlPath } from '../src/lib/markdown-paths.mjs';

test('alternate documents cover editorial routes while excluding schools and personal pages', () => {
  for (const path of ['/', '/guide/', '/guide/costi-e-isee/', '/metodo/', '/progetto/', '/privacy/', '/iscrizioni/', '/agenda/', '/nidi/', '/scuole-infanzia/', '/municipi/7/']) {
    const md = markdownPath(path);
    assert.ok(md);
    assert.equal(htmlPath(md), path);
  }
  for (const path of ['/scuole/test/', '/famiglia/', '/confronto/', '/design/', '/api/reports', '/municipi/10/', '/guide/../../famiglia/']) assert.equal(markdownPath(path), null);
  assert.equal(htmlPath('/scuole/test.md'), null);
});
test('Markdown preserves tables, periods, evidence and source URLs from the main HTML', () => {
  const html = `<html><head><title>Costi &amp; fonti</title><meta name="description" content="Rette 2026/27"></head><body><header>MENU</header><main><nav class="breadcrumbs">NAV</nav><h1>Costi</h1><p>502,20 € nel 2026/27: da riconfermare per il 2027/28.</p><table><caption>Importi mensili</caption><tr><th>Fascia</th><th>Retta</th></tr><tr><td>A | B</td><td>502,20 €</td></tr></table><details><summary>Fonti</summary><p>Documento consultato il 16 novembre 2026.</p><a href="https://example.org/bando?a=1&amp;b=2">Bando</a></details><p><a href="#fonti">Verifica</a></p><div hidden>PERSONAL</div><form>FORM</form><script>SECRET</script><p data-markdown-exclude>Download</p></main><footer>FOOTER</footer></body></html>`;
  const md = htmlToMarkdown(html, '/guide/costi/', 'https://scuolevicine.it');
  assert.match(md, /canonical: "https:\/\/scuolevicine.it\/guide\/costi\/"/);
  assert.match(md, /502,20 € nel 2026\/27: da riconfermare per il 2027\/28/);
  assert.ok(md.includes('| Fascia | Retta |\n| --- | --- |\n| A \\| B | 502,20 € |'));
  assert.ok(md.includes('https://example.org/bando?a=1&b=2'));
  assert.ok(md.includes('https://scuolevicine.it/guide/costi/#fonti'));
  assert.ok(md.includes('16 novembre 2026'));
  assert.doesNotMatch(md, /MENU|NAV|PERSONAL|FORM|SECRET|Download|FOOTER/);
});
test('home export omits interactive catalogue cards and keeps collection discovery and limits', () => {
  const md = htmlToMarkdown('<main><section class="home-hero"><h1>Milano</h1></section><section id="raccolte"><h2>Raccolte</h2><nav><a href="/nidi/">Nidi</a><a href="/municipi/7/">Municipio 7</a></nav></section><section class="explorer">HIDDEN-CARDS</section><div class="catalog-note"><p>Non indica posti disponibili.</p></div></main>', '/');
  assert.ok(md.includes('- [Nidi](https://scuolevicine.it/nidi/)\n- [Municipio 7](https://scuolevicine.it/municipi/7/)'));
  assert.ok(md.includes('Non indica posti disponibili.'));
  assert.doesNotMatch(md, /HIDDEN-CARDS/);
});
test('Markdown HTTP headers point to HTML and prevent separate index entries', () => {
  const headers = markdownHeaders('/metodo/');
  assert.equal(headers['Content-Type'], 'text/markdown; charset=utf-8');
  assert.equal(headers['X-Robots-Tag'], 'noindex, follow');
  assert.equal(headers['Content-Disposition'], 'attachment; filename="metodo.md"');
  assert.equal(headers.Link, '<https://scuolevicine.it/metodo/>; rel="canonical"');
});
