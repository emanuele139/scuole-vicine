import { secureAsset } from './security';
interface PagesEnv { ASSETS: Fetcher; BACKEND: Fetcher }
export default {
  async fetch(request: Request, env: PagesEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === 'www.scuolevicine.it' || url.protocol === 'http:') {
      if (url.hostname === 'www.scuolevicine.it') url.hostname = 'scuolevicine.it';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname.startsWith('/api/')) return env.BACKEND.fetch(request);
    return secureAsset(request, env.ASSETS);
  },
};
