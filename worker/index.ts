import { reportApi } from './reports';
import { idPattern, secretPattern, validEnvelope, MAX_CIPHERTEXT, type Envelope } from '../src/lib/shared/protocol';
interface Env { DB: D1Database; ASSETS: Fetcher; CREATE_LIMITER?: RateLimit; API_LIMITER?: RateLimit }
type Row = { revision: number; format_version: 1; ciphertext: string; iv: string; last_operation_id: string; expires_at: number };
const YEAR = 365 * 86400;
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
function reply(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers }); }
async function hash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('');
}
function remote(row: Row) { return { format: row.format_version, revision: row.revision, ciphertext: row.ciphertext, iv: row.iv, operation: row.last_operation_id, expiresAt: row.expires_at }; }
async function body(request: Request): Promise<Envelope> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('body');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > MAX_CIPHERTEXT + 1024) { await reader.cancel(); throw new Error('body'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder().decode(buffer));
  if (!validEnvelope(value)) throw new Error('body');
  return value;
}
export async function api(request: Request, env: Pick<Env, 'DB'>): Promise<Response> {
  const url = new URL(request.url);
  const match = /^\/api\/spaces\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname);
  if (!match || !idPattern.test(match[1])) return reply(404, { error: 'Non possiamo aprire questo spazio. Controlla di avere il link completo e riprova.' });
  if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return reply(403, { error: 'Non possiamo completare la richiesta da questa pagina. Apri lo spazio dal sito Scuole Milano e riprova.' });
  if (request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, { error: 'Non possiamo completare la richiesta da questa pagina. Apri lo spazio dal sito Scuole Milano e riprova.' });
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!secretPattern.test(token)) return reply(404, { error: 'Non possiamo aprire questo spazio. Controlla di avere il link completo e riprova.' });
  const id = match[1], digest = await hash(token), now = Math.floor(Date.now() / 1000);
  const db = env.DB; // No read replicas: use the primary for revision checks and read-after-write.
  if (request.method === 'POST') {
    const e = await body(request);
    if (e.revision !== 1) return reply(400, { error: 'Non siamo riusciti a creare lo spazio perché i dati ricevuti non sono validi. Riprova.' });
    const result = await db.prepare(`INSERT INTO shared_spaces (id, access_token_hash, revision, format_version, ciphertext, iv, last_operation_id, created_at, updated_at, expires_at) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(id, digest, e.ciphertext, e.iv, e.operation, now, now, now + YEAR).run();
    if (result.meta.changes) return reply(201, { ...e, expiresAt: now + YEAR });
    const existing = await db.prepare('SELECT * FROM shared_spaces WHERE id = ? AND access_token_hash = ? AND expires_at > ?').bind(id, digest, now).first<Row>();
    if (existing?.last_operation_id === e.operation) return reply(200, remote(existing));
    return reply(409, { error: 'Non siamo riusciti a creare un nuovo spazio. Riprova.' });
  }
  if (!['GET', 'PUT', 'DELETE'].includes(request.method)) return reply(405, { error: 'Questa operazione non è disponibile per lo spazio condiviso.' });
  if (request.method === 'DELETE') {
    // An old page cannot silently delete newer changes.
    const revision = Number(request.headers.get('if-match'));
    if (!Number.isSafeInteger(revision) || revision < 1) return reply(400, { error: 'Prima di eliminare lo spazio, sincronizza le modifiche e conferma di nuovo.' });
    const result = await db.prepare('DELETE FROM shared_spaces WHERE id = ? AND access_token_hash = ? AND expires_at > ? AND revision = ?').bind(id, digest, now, revision).run();
    if (result.meta.changes) return reply(200, { deleted: true });
  } else if (request.method === 'PUT') {
    const e = await body(request);
    const result = await db.prepare(`UPDATE shared_spaces SET revision = ?, format_version = 1, ciphertext = ?, iv = ?, last_operation_id = ?, updated_at = ?, expires_at = ? WHERE id = ? AND access_token_hash = ? AND expires_at > ? AND revision = ?`).bind(e.revision, e.ciphertext, e.iv, e.operation, now, now + YEAR, id, digest, now, e.revision - 1).run();
    if (result.meta.changes) return reply(200, { ...e, expiresAt: now + YEAR });
  }
  const row = await db.prepare('SELECT * FROM shared_spaces WHERE id = ? AND access_token_hash = ? AND expires_at > ?').bind(id, digest, now).first<Row>();
  if (!row) return reply(404, { error: 'Spazio non disponibile. Potrebbe essere stato eliminato o essere scaduto. Controlla di avere il link completo.' });
  if (request.method === 'GET' || (request.method === 'PUT' && request.headers.get('x-operation-id') === row.last_operation_id)) return reply(200, remote(row));
  return reply(409, remote(row));
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      try {
        const limiter = request.method === 'POST' ? env.CREATE_LIMITER : env.API_LIMITER;
        if (limiter) {
          const result = await limiter.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
          if (!result.success) return reply(429, { error: 'Abbiamo ricevuto molte richieste in poco tempo. Riprova tra un minuto.' });
        }
        if (new URL(request.url).pathname === '/api/reports') return await reportApi(request, env);
        return await api(request, env);
      } catch (error) {
        // Never log request headers, bodies or secret links.
        return reply(error instanceof SyntaxError || (error instanceof Error && error.message === 'body') ? 400 : 503, { error: 'Non siamo riusciti a completare la richiesta. I dati ricevuti potrebbero non essere validi oppure il servizio potrebbe essere temporaneamente non disponibile. Riprova più tardi.' });
      }
    }
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    if (response.status === 404 || /^\/(famiglia|confronto|design)(?:\/|$)/.test(new URL(request.url).pathname)) response.headers.set('X-Robots-Tag', 'noindex, follow');
    response.headers.set('Referrer-Policy', 'no-referrer');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tiles.openfreemap.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org; connect-src 'self' https://photon.komoot.io https://tile.openstreetmap.org https://tiles.openfreemap.org https://cloud.umami.is https://gateway.umami.is; frame-src https://www.openstreetmap.org; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    return response;
  },
  async scheduled(_event: ScheduledEvent, env: Env) {
    await env.DB.prepare('DELETE FROM school_reports WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
    await env.DB.prepare('DELETE FROM shared_spaces WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  },
};
