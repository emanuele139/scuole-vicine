/** Public identity is fixed; indexing is an explicit release setting. */
export function seoSettings(env = process.env) {
  const site = new URL(env.SITE_URL || 'https://scuolevicine.it');
  if (site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password || site.port || site.hostname === 'localhost' || !site.hostname.includes('.') || /^\d[\d.]+$/.test(site.hostname)) {
    throw new Error('SITE_URL deve essere un’origine HTTPS pubblica, senza percorsi, parametri o credenziali.');
  }
  if (env.SEO_INDEXABLE && !['true', 'false'].includes(env.SEO_INDEXABLE)) throw new Error('SEO_INDEXABLE deve essere true oppure false.');
  return { site: site.origin, indexable: env.SEO_INDEXABLE === 'true' };
}
export const seo = seoSettings();
