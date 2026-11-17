import { defineConfig } from 'astro/config';
import { writeFile } from 'node:fs/promises';
import { generateMarkdown, markdownIntegration } from './integrations/markdown.mjs';
import { seo } from './seo.config.mjs';

export default defineConfig({
  site: seo.site,
  output: 'static',
  integrations: [markdownIntegration(), {
    name: 'seo-response-headers',
    hooks: { 'astro:build:done': async ({ dir }) => {
      const excluded = ['/famiglia', '/famiglia/', '/confronto', '/confronto/', '/design', '/design/', '/404', '/404.html', '/api/*', '/dati/*', '/llms.txt'];
      const headers = `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n${seo.indexable ? '' : '  X-Robots-Tag: noindex, nofollow\n'}\n` + excluded.map(path => `${path}\n  X-Robots-Tag: noindex, follow\n`).join('\n');
      await writeFile(new URL('_headers', dir), headers + await generateMarkdown(dir));
    } },
  }],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  server: { host: '127.0.0.1' },
  vite: { server: { strictPort: true } },
});
