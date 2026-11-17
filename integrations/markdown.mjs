import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { parse, TEXT_NODE } from 'ultrahtml';
import { querySelector, querySelectorAll } from 'ultrahtml/selector';
import { decodeHTML } from 'entities';
import { markdownPath, htmlPath } from '../src/lib/markdown-paths.mjs';
import { seo } from '../seo.config.mjs';

const ignored = new Set(['script', 'style', 'svg', 'button', 'form', 'select', 'input', 'template', 'noscript', 'iframe']);
const block = new Set(['div', 'section', 'article', 'aside', 'header', 'nav', 'p', 'figure', 'details']);
const classes = node => (node.attributes?.class || '').split(/\s+/);
const compact = value => value.replace(/\s+/g, ' ').trim();
const escape = value => value.replace(/([\\`*_[\]])/g, '\\$1');
const destination = (href, canonical) => {
  try {
    const url = new URL(decodeHTML(href), canonical);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href.replace(/\(/g, '%28').replace(/\)/g, '%29') : null;
  } catch { return null; }
};
export function htmlToMarkdown(html, path, origin = seo.site) {
  const ast = parse(html), main = querySelector(ast, 'main');
  if (!main) throw new Error(`Markdown: main mancante per ${path}`);
  const canonical = new URL(path, origin).href;
  const children = node => (node.children || []).map(render).join('');
  function render(node) {
    if (node.type === TEXT_NODE) return escape(decodeHTML(node.value).replace(/\s+/g, ' '));
    if (!node.name) return '';
    if (ignored.has(node.name) || 'data-markdown-exclude' in node.attributes || 'hidden' in node.attributes || node.attributes['aria-hidden'] === 'true') return '';
    if (classes(node).some(c => ['breadcrumbs', 'guide-index', 'source-intro', 'eyebrow', 'guide-cover-number', 'answer-number'].includes(c))) return '';
    const content = () => children(node);
    if (/^h[1-6]$/.test(node.name)) return `\n\n${'#'.repeat(Number(node.name[1]))} ${compact(content())}\n\n`;
    if (node.name === 'br') return ' ';
    if (node.name === 'a') {
      const href = destination(node.attributes.href, canonical);
      const heading = querySelector(node, 'h1, h2, h3, h4');
      if (heading && href) {
        const label = compact(children(heading));
        const rest = node.children.filter(c => c !== heading).map(render).join('').trim();
        return `\n\n${'#'.repeat(Number(heading.name[1]))} [${label}](${href})\n\n${rest}\n\n`;
      }
      const label = compact(content());
      return label ? (href ? `[${label}](${href})` : label) : '';
    }
    if (node.name === 'strong' || node.name === 'b') return `**${content()}**`;
    if (node.name === 'em' || node.name === 'i') return `*${content()}*`;
    if (node.name === 'code') return '`' + content() + '`';
    if (node.name === 'ul' || node.name === 'ol') {
      return '\n\n' + node.children.filter(c => c.name === 'li').map((li, i) => {
        const text = children(li).trim();
        return `${node.name === 'ol' ? `${i + 1}.` : '-'} ${text.replace(/\n/g, '\n  ')}`;
      }).join('\n') + '\n\n';
    }
    if (node.name === 'table') {
      const rows = querySelectorAll(node, 'tr').map(tr => tr.children.filter(c => ['th', 'td'].includes(c.name)).map(c => compact(children(c)).replace(/\|/g, '\\|'))).filter(row => row.length);
      if (!rows.length) return '';
      const width = Math.max(...rows.map(r => r.length));
      const row = cells => '| ' + Array.from({length: width}, (_, i) => cells[i] || '').join(' | ') + ' |';
      const caption = querySelector(node, 'caption');
      return '\n\n' + (caption ? compact(children(caption)) + '\n\n' : '') + [row(rows[0]), row(Array(width).fill('---')), ...rows.slice(1).map(row)].join('\n') + '\n\n';
    }
    if (node.name === 'dl') return '\n\n' + node.children.map(c => render(c)).join('') + '\n\n';
    if (node.name === 'dt') return `\n\n**${compact(content())}**: `;
    if (node.name === 'dd') return content();
    if (node.name === 'nav' || classes(node).includes('catalog-links')) {
      return '\n\n' + node.children.map(c => c.name === 'a' ? '- ' + compact(render(c)) : render(c)).join('\n') + '\n\n';
    }
    if (node.name === 'span' && classes(node).includes('btn-text')) return '';
    if (node.name === 'span' || node.name === 'small') return ' ' + content() + ' ';
    if (block.has(node.name)) return '\n\n' + content() + '\n\n';
    return content();
  }
  // Keep the homepage's presentation and navigation, without dumping the interactive cards.
  const nodes = path === '/' ? querySelectorAll(main, '.home-hero, #raccolte, .catalog-note, .home-next-steps') : main.children;
  const body = nodes.map(render).join('').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const meta = querySelector(ast, 'meta[name="description"]')?.attributes.content || '';
  const author = querySelector(ast, 'meta[name="author"]')?.attributes.content;
  const title = compact(decodeHTML(querySelector(ast, 'title')?.children.map(n => n.value || '').join('') || ''));
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(decodeHTML(meta))}\nlanguage: it\ncanonical: ${JSON.stringify(canonical)}\n${author ? `author: ${JSON.stringify(decodeHTML(author))}\n` : ''}---\n\n${body}\n\n---\n\n[Leggi la pagina HTML](${canonical}) · [Dati e fonti](${new URL('/metodo/', origin).href})\n`;
}
export function markdownHeaders(path) {
  return { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${markdownPath(path).split('/').at(-1)}"`, 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, follow', 'Link': `<${new URL(path, seo.site).href}>; rel="canonical"` };
}
export async function generateMarkdown(dir) {
  const entries = await readdir(dir, { recursive: true });
  let headers = '';
  for (const file of entries.filter(f => f.endsWith('index.html'))) {
    const path = '/' + file.replaceAll('\\', '/').slice(0, -'index.html'.length);
    const markdown = markdownPath(path);
    if (!markdown) continue;
    const output = new URL('.' + markdown, dir);
    await mkdir(new URL('.', output), {recursive: true});
    await writeFile(output, htmlToMarkdown(await readFile(new URL(file, dir), 'utf8'), path));
    headers += `\n${markdown}\n` + Object.entries(markdownHeaders(path)).map(([key, value]) => `  ${key}: ${value}\n`).join('');
  }
  return headers;
}
export function markdownIntegration() {
  return { name: 'editorial-markdown', hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname;
        const path = htmlPath(pathname);
        if (!path || !['GET', 'HEAD'].includes(req.method || 'GET')) return next();
        try {
          // The socket port is trusted; never fetch a host supplied by the request.
          const response = await fetch(`http://127.0.0.1:${req.socket.localPort}${path}`, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) { res.statusCode = response.status; return res.end(); }
          const markdown = htmlToMarkdown(await response.text(), path);
          for (const [key, value] of Object.entries(markdownHeaders(path))) res.setHeader(key, value);
          res.setHeader('Cache-Control', 'no-store');
          res.end(req.method === 'HEAD' ? undefined : markdown);
        } catch (error) { next(error); }
      });
    },
  }};
}
