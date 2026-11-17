import { absolute, seo } from '../lib/seo';
export const prerender = true;
export function GET() {
  const rules = seo.indexable ? `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absolute('/sitemap.xml')}\n` : 'User-agent: *\nDisallow: /\n';
  return new Response(rules, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
