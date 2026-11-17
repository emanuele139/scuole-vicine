import preschool from '../src/data/catalog-client.json';
import nurseries from '../src/data/nurseries-client.json';
const schoolIds = new Set([...preschool, ...nurseries].map(school => school.id));
const reportHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
function reportReply(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: reportHeaders }); }
export async function reportApi(request: Request, env: { DB: D1Database }): Promise<Response> {
  if (request.method !== 'POST') return reportReply(405, { error: 'Puoi solo inviare una segnalazione.' });
  const origin = new URL(request.url).origin;
  if ((request.headers.get('origin') && request.headers.get('origin') !== origin) || request.headers.get('sec-fetch-site') === 'cross-site') return reportReply(403, { error: 'Invia la segnalazione dal sito Scuole Milano.' });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return reportReply(415, { error: 'Formato della segnalazione non valido.' });
  const reader = request.body?.getReader();
  if (!reader) return reportReply(400, { error: 'Compila i campi della segnalazione.' });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); return reportReply(413, { error: 'La segnalazione è troppo lunga.' }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(buffer)); } catch { return reportReply(400, { error: 'La segnalazione non è valida.' }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reportReply(400, { error: 'La segnalazione non è valida.' });
  const { schoolId, category } = value;
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const details = typeof value.details === 'string' ? value.details.trim() : null;
  if (typeof schoolId !== 'string' || !schoolIds.has(schoolId) || !['closed', 'hours', 'address', 'other'].includes(category) || !email || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || details === null || details.length > 3000 || (category === 'other' && !details)) return reportReply(400, { error: 'Controlla la scuola, il motivo e l’email. Se scegli Altro, aggiungi una descrizione.' });
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO school_reports (id, school_id, category, email, details, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), schoolId, category, email, details, now, now + 365 * 86400).run();
  return reportReply(201, { received: true });
}
