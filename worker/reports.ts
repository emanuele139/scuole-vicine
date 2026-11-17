import preschool from '../src/data/catalog-client.json';
import nurseries from '../src/data/nurseries-client.json';
import neighbours from '../src/data/neighbor-schools-client.json';
const schoolIds = new Set([...preschool, ...nurseries, ...neighbours].map(school => school.id));
const reportHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
function reportReply(status: number, value: unknown) { return new Response(JSON.stringify(value), { status, headers: reportHeaders }); }
export interface ReportEnv { DB: D1Database; REPORT_EMAIL?: SendEmail; REPORT_FROM?: string }
export async function reportApi(request: Request, env: ReportEnv): Promise<Response> {
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
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO school_reports (id, school_id, category, email, details, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, schoolId, category, email, details, now, now + 365 * 86400).run();
  await notifyReport(env, { id, school_id: schoolId, category, email, details });
  return reportReply(201, { received: true });
}

type PendingReport = { id: string; school_id: string; category: string; email: string; details: string };
const reportSchools = new Map([...preschool, ...nurseries, ...neighbours].map(school => [school.id, school.name]));
const categories: Record<string, string> = { closed: 'Sede chiusa', hours: 'Orari', address: 'Indirizzo', other: 'Altro' };
export async function notifyReport(env: ReportEnv, report: PendingReport): Promise<void> {
  if (!env.REPORT_EMAIL || !env.REPORT_FROM) return;
  const now = Math.floor(Date.now() / 1000);
  // A short lease avoids duplicate sends between a submission and the scheduled retry.
  try {
    const claim = await env.DB.prepare('UPDATE school_reports SET email_attempted_at = ?, email_attempts = email_attempts + 1 WHERE id = ? AND email_sent_at IS NULL AND email_attempts < 10 AND (email_attempted_at IS NULL OR email_attempted_at < ?)')
      .bind(now, report.id, now - 600).run();
    if (!claim.meta.changes) return;
    await env.REPORT_EMAIL.send({
      from: env.REPORT_FROM,
      to: 'emanuele@cardinali.studio',
      replyTo: report.email,
      subject: `[Scuole Vicine] Segnalazione: ${categories[report.category]}`,
      text: `Nuova segnalazione su Scuole Vicine\n\nScuola: ${reportSchools.get(report.school_id) || report.school_id}\nID scuola: ${report.school_id}\nMotivo: ${categories[report.category]}\nEmail per rispondere: ${report.email}\n\n${report.details || 'Nessun dettaglio aggiunto.'}\n\nID segnalazione: ${report.id}\nNon inoltrare né pubblicare i dati personali della segnalazione.`,
    });
    await env.DB.prepare('UPDATE school_reports SET email_sent_at = ? WHERE id = ?').bind(now, report.id).run();
  } catch {
    // The report remains saved. Retry later without logging its contents or contact.
  }
}
export async function flushReportEmails(env: ReportEnv): Promise<void> {
  if (!env.REPORT_EMAIL || !env.REPORT_FROM) return;
  const now = Math.floor(Date.now() / 1000);
  const pending = await env.DB.prepare('SELECT id, school_id, category, email, details FROM school_reports WHERE email_sent_at IS NULL AND email_attempts < 10 AND expires_at > ? AND (email_attempted_at IS NULL OR email_attempted_at < ?) ORDER BY created_at LIMIT 25').bind(now, now - 600).all<PendingReport>();
  for (const report of pending.results) await notifyReport(env, report);
}
