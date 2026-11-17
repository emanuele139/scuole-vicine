export const FORMAT = 1;
export const MAX_CIPHERTEXT = 1_400_000;
export type Credentials = { id: string; access: string; key: string };
export type Envelope = { format: 1; revision: number; ciphertext: string; iv: string; operation: string };
export type Remote = Envelope & { expiresAt: number };
export const secretPattern = /^[A-Za-z0-9_-]{43}$/;
export const idPattern = /^[A-Za-z0-9_-]{22}$/;
export function base64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function bytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export function random(size = 32): string { return base64(crypto.getRandomValues(new Uint8Array(size))); }
export function credentials(): Credentials { return { id: random(16), access: random(), key: random() }; }
export function validCredentials(value: unknown): value is Credentials {
  const c = value as Credentials | null;
  return !!c && idPattern.test(c.id) && secretPattern.test(c.access) && secretPattern.test(c.key);
}
export function parseLink(hash: string): Credentials | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const c = { id: p.get('spazio') || '', access: p.get('accesso') || '', key: p.get('chiave') || '' };
  return validCredentials(c) ? c : null;
}
export function link(c: Credentials, origin: string): string {
  return `${origin}/famiglia/#${new URLSearchParams({ spazio: c.id, accesso: c.access, chiave: c.key })}`;
}
export function validEnvelope(value: unknown): value is Envelope {
  const e = value as Envelope | null;
  return !!e && e.format === FORMAT && Number.isSafeInteger(e.revision) && e.revision >= 1 &&
    typeof e.iv === 'string' && /^[A-Za-z0-9_-]{16}$/.test(e.iv) &&
    typeof e.ciphertext === 'string' && e.ciphertext.length >= 22 && e.ciphertext.length <= MAX_CIPHERTEXT && /^[A-Za-z0-9_-]+$/.test(e.ciphertext) &&
    typeof e.operation === 'string' && idPattern.test(e.operation);
}
async function aes(c: Credentials) {
  return crypto.subtle.importKey('raw', bytes(c.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
function aad(c: Credentials, revision: number) { return new TextEncoder().encode(`scuole-milano:${c.id}:${FORMAT}:${revision}`); }
export async function encrypt(value: unknown, c: Credentials, revision: number, operation = random(16)): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(c, revision) }, await aes(c), new TextEncoder().encode(JSON.stringify(value)));
  return { format: FORMAT, revision, ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv), operation };
}
export async function decrypt(e: Envelope, c: Credentials): Promise<unknown> {
  if (!validEnvelope(e)) throw new Error('Non siamo riusciti a leggere lo spazio perché il suo formato non è valido.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(e.iv), additionalData: aad(c, e.revision) }, await aes(c), bytes(e.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain));
}
