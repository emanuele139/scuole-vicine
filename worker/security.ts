export async function secureAsset(request: Request, assets: Fetcher): Promise<Response> {
    const asset = await assets.fetch(request);
    const response = new Response(asset.body, asset);
    if (new URL(request.url).hostname.endsWith('.pages.dev') || response.status === 404 || /^\/(famiglia|confronto|design)(?:\/|$)/.test(new URL(request.url).pathname)) response.headers.set('X-Robots-Tag', 'noindex, follow');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org; connect-src 'self' https://photon.komoot.io https://tile.openstreetmap.org https://tiles.openfreemap.org https://cloud.umami.is https://gateway.umami.is; frame-src https://www.openstreetmap.org; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return response;
}
