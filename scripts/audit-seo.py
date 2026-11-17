#!/usr/bin/env python3
"""Audit the generated HTML, not the source templates. No network dependencies."""
import argparse
import json
import re
import struct
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import xml.etree.ElementTree as ET

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.meta, self.links, self.ids, self.hrefs = {}, {}, set(), []
        self.h1 = 0
        self.title = ''
        self.in_title = self.in_schema = False
        self.schema_text = ''
        self.graphs = []
        self.language = None
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'html': self.language = a.get('lang')
        if tag == 'title': self.in_title = True
        if tag == 'h1': self.h1 += 1
        if a.get('id'): self.ids.add(a['id'])
        if tag == 'a' and a.get('href'): self.hrefs.append(a['href'])
        if tag == 'meta': self.meta[a.get('name', a.get('property'))] = a.get('content', '')
        if tag == 'link': self.links[a.get('rel')] = a.get('href')
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.in_schema = True
            self.schema_text = ''
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'script' and self.in_schema:
            self.graphs.append(json.loads(self.schema_text))
            self.in_schema = False
    def handle_data(self, value):
        if self.in_title: self.title += value
        if self.in_schema: self.schema_text += value

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['preview', 'production'], default='preview')
    parser.add_argument('--directory', default='dist')
    parser.add_argument('--site', default='https://scuolevicine.it')
    parser.add_argument('--base-url', help='Optional running Worker or public origin for GET/HEAD checks')
    args = parser.parse_args()
    root = Path(args.directory)
    production = args.mode == 'production'
    site = args.site.rstrip('/')
    errors = []
    def require(condition, message):
        if not condition: errors.append(message)
    documents = {}
    for path in root.rglob('*.html'):
        route = '/' + path.relative_to(root).as_posix().removesuffix('index.html')
        if route.startswith('/design/'): continue  # Local-only style guide has its own shell.
        try: documents[route] = Document(path.read_text())
        except (ValueError, json.JSONDecodeError) as e: errors.append(f'{route}: HTML/JSON-LD {e}')
    excluded = {'/famiglia/', '/s/', '/confronto/', '/404.html'}
    public = set(documents) - excluded
    school_data = json.loads(Path('src/data/schools.json').read_text()) + json.loads(Path('src/data/nurseries.json').read_text())
    require(len([p for p in public if p.startswith('/scuole/')]) == len(school_data), 'School route coverage differs from catalogue')
    require(len([p for p in public if p.startswith('/municipi/')]) == 9, 'Expected nine Municipality collections')
    titles, descriptions, link_count, schemas = [], [], 0, 0
    for route, doc in documents.items():
        require(doc.h1 == 1, f'{route}: expected one H1, found {doc.h1}')
        require(doc.language == 'it', f'{route}: incorrect document language')
        require(doc.title and doc.meta.get('description'), f'{route}: missing title/description')
        canonical = site + route
        require(doc.links.get('canonical') == (None if route == '/404.html' else canonical), f'{route}: canonical mismatch')
        require(doc.meta.get('og:url') == canonical, f'{route}: OG URL mismatch')
        require(doc.meta.get('og:title') == doc.title == doc.meta.get('twitter:title'), f'{route}: inconsistent titles')
        require(doc.meta.get('og:description') == doc.meta.get('description') == doc.meta.get('twitter:description'), f'{route}: inconsistent descriptions')
        for key in ['og:image', 'og:image:alt', 'twitter:image', 'twitter:image:alt']:
            require(doc.meta.get(key), f'{route}: missing {key}')
        image_path = urlsplit(doc.meta.get('og:image', '')).path
        require((root / image_path.lstrip('/')).is_file(), f'{route}: missing social image')
        robots = doc.meta.get('robots', '')
        require(('noindex' not in robots) == (production and route in public), f'{route}: incorrect robots {robots}')
        if route in public:
            titles.append(doc.title)
            descriptions.append(doc.meta.get('description'))
            require(len(doc.graphs) == 1, f'{route}: missing or duplicate JSON-LD graph')
            for graph in doc.graphs:
                require(graph.get('@context') == 'https://schema.org', f'{route}: schema context')
                nodes = graph.get('@graph', [])
                ids = [n.get('@id') for n in nodes]
                require(len(ids) == len(set(ids)), f'{route}: duplicate entity IDs')
                require(all(i and i.startswith(site + '/') for i in ids), f'{route}: entity on incorrect host')
                require(any(n.get('@type') == 'WebSite' for n in nodes), f'{route}: missing site identity')
                for node in nodes:
                    schemas += 1
                    if node.get('@type') == 'BreadcrumbList':
                        for item in node['itemListElement']:
                            require(item['item'].removeprefix(site) in documents, f'{route}: breadcrumb target missing')
                    if node.get('@type') == 'ItemList':
                        items = node['itemListElement']
                        require(node['numberOfItems'] == len(items), f'{route}: collection count mismatch')
                        for item in items:
                            require(item['url'].removeprefix(site) in documents, f'{route}: collection target missing')
                    require(node.get('@type') not in ['AggregateRating', 'Review', 'Offer', 'FAQPage'], f'{route}: unexpected claims in structured data')
        for href in doc.hrefs:
            parsed = urlsplit(href)
            if parsed.scheme in ['mailto', 'tel', 'javascript', 'data']: continue
            if parsed.netloc and parsed.netloc != urlsplit(site).netloc: continue
            target = unquote(parsed.path) or route
            if not target.startswith('/'): continue
            if target.startswith('/design'): continue
            if target.endswith('/index.html'): target = target.removesuffix('index.html')
            link_count += 1
            if target in documents:
                if parsed.fragment:
                    require(unquote(parsed.fragment) in documents[target].ids, f'{route}: missing anchor {href}')
            else:
                require((root / target.lstrip('/')).is_file(), f'{route}: missing local link {href}')
    for values, name in [(titles, 'title'), (descriptions, 'description')]:
        for value, count in Counter(values).items(): require(count == 1, f'Duplicate {name}: {value}')
    tree = ET.fromstring((root / 'sitemap.xml').read_text())
    locations = [e.text for e in tree.findall('{*}url/{*}loc')]
    require(len(locations) == len(set(locations)), 'Duplicate sitemap URLs')
    require(set(locations) == ({site + p for p in public} if production else set()), 'Sitemap does not match indexable HTML inventory')
    robots = (root / 'robots.txt').read_text()
    require(('Sitemap: ' + site + '/sitemap.xml' in robots) == production, 'robots sitemap policy mismatch')
    require(('Disallow: /\n' in robots) != production, 'robots preview policy mismatch')
    headers = (root / '_headers').read_text()
    require(('X-Robots-Tag: noindex' in headers.split('\n\n', 1)[0]) != production, 'HTTP header preview policy mismatch')
    llms = (root / 'llms.txt').read_text()
    require(('## Pagine e raccolte' in llms) == production, 'llms publication policy mismatch')
    for url in re.findall(r'\]\((https://[^)]+)\)', llms):
        if url.startswith(site):
            target = url.removeprefix(site)
            require(target in public or (target.endswith('.md') and (root / target.lstrip('/')).is_file()), f'llms target missing: {url}')
    markdown_count = 0
    for route in sorted(public):
        doc = documents[route]
        if route.startswith('/scuole/'):
            require('alternate' not in doc.links, f'{route}: unexpected per-school alternate')
            continue
        md_path = '/index.md' if route == '/' else route.rstrip('/') + '.md'
        file = root / md_path.lstrip('/')
        require(doc.links.get('alternate') == site + md_path, f'{route}: missing Markdown discovery')
        require(md_path in doc.hrefs, f'{route}: missing visible Markdown link')
        require(file.is_file(), f'{route}: missing Markdown document')
        if file.is_file():
            markdown_count += 1
            text = file.read_text()
            require(f'canonical: "{site + route}"' in text, f'{md_path}: incorrect canonical')
            require('\n# ' in text and 'language: it' in text, f'{md_path}: empty or incomplete document')
            require(md_path in headers and f'<{site + route}>; rel="canonical"' in headers, f'{md_path}: missing HTTP policy')
    require(len(list(root.rglob('*.md'))) == markdown_count, 'Unexpected Markdown outside editorial inventory')
    png = (root / 'social/scuole-vicine.png').read_bytes()
    require(png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1200, 630), 'Invalid social PNG dimensions')
    http_checks = []
    if args.base_url:
        base = args.base_url.rstrip('/')
        paths = ['/', '/nidi/', '/municipi/7/', '/famiglia/', '/confronto/?ids=mi-1007', '/robots.txt', '/sitemap.xml', '/llms.txt', '/social/scuole-vicine.png', '/questa-pagina-non-esiste-seo/', '/api/nonexistent', '/api/reports', '/index.md', '/metodo.md', '/guide/costi-e-isee.md']
        for path in paths:
            try:
                for method in ['GET', 'HEAD']:
                    try: response = urlopen(Request(base + path, method=method, headers={'User-Agent': 'ScuoleVicine-QA/1.0'}), timeout=15)
                    except HTTPError as e: response = e
                    data = response.read()
                    status = response.status
                    robots_header = response.headers.get('X-Robots-Tag', '')
                    http_checks.append({'path': path, 'method': method, 'status': status, 'robots': robots_header})
                    expected = 405 if path == '/api/reports' else 404 if path.startswith(('/questa-pagina-', '/api/')) else 200
                    require(status == expected, f'HTTP {method} {path}: expected {expected}, got {status}')
                    private = path.endswith('.md') or path.startswith(('/famiglia/', '/confronto/', '/api/', '/questa-pagina-', '/llms.txt'))
                    if private or not production:
                        require('noindex' in robots_header, f'HTTP {method} {path}: missing noindex header')
                    else:
                        require('noindex' not in robots_header, f'HTTP {method} {path}: unexpected noindex header')
                    if method == 'GET' and path == '/questa-pagina-non-esiste-seo/':
                        require(b'Questa pagina' in data, '404 did not serve the designed error page')
                    if method == 'GET' and path == '/':
                        served = Document(data.decode())
                        require(('noindex' not in served.meta.get('robots', '')) == production, 'HTTP HTML robots differs from the expected build')
                        require(served.links.get('canonical') == site + '/', 'HTTP canonical host mismatch')
                    if path.endswith('.md'):
                        html_route = '/' if path == '/index.md' else path[:-3] + '/'
                        require(response.headers.get('Content-Type', '').startswith('text/markdown'), f'{path}: wrong MIME')
                        require('attachment;' in response.headers.get('Content-Disposition', ''), f'{path}: missing download header')
                        require(response.headers.get('Link') == f'<{site + html_route}>; rel="canonical"', f'{path}: missing HTTP canonical')
                    if method == 'HEAD': require(not data, f'HTTP HEAD {path}: unexpected body')
            except Exception as e: errors.append(f'HTTP {path}: {e}')
    print(json.dumps({'mode': args.mode, 'html_pages': len(documents), 'public_content_pages': len(public), 'school_pages': len(school_data), 'sitemap_urls': len(locations), 'internal_links_checked': link_count, 'schema_entities': schemas, 'markdown_documents': markdown_count, 'http_checks': http_checks, 'errors': errors}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if errors else 0)

if __name__ == '__main__': main()
