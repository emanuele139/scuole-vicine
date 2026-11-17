export const FORMAT = 1;
export const MAX_CIPHERTEXT = 1_400_000;
export type Credentials = { id: string; access: string; key: string; seed?: string };
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
/** Legacy independent credentials, retained for compatibility fixtures. */
export function credentials(): Credentials { return { id: random(16), access: random(), key: random() }; }
const verifiedSeeds = new WeakMap<Credentials, string>();
const fingerprint = (c: Credentials) => `${c.seed}:${c.id}:${c.access}:${c.key}`;
const canonicalSeed = (seed: unknown): seed is string => {
  if (typeof seed !== 'string' || !secretPattern.test(seed)) return false;
  try { return bytes(seed).length === 32 && base64(bytes(seed)) === seed; } catch { return false; }
};
/** HKDF-SHA-256, RFC 5869; fixed application/version salt and distinct info
 * labels separate the public ID, API capability and AES-256 encryption key.
 * The 256-bit root is never sent to the API. */
export async function credentialsFromSeed(seed: string): Promise<Credentials> {
  if (!canonicalSeed(seed)) throw new Error('Il link segreto è incompleto o non è valido.');
  if (!crypto.subtle) throw new Error('Per leggere il link protetto, apri il sito tramite HTTPS con un browser aggiornato.');
  const material = await crypto.subtle.importKey('raw', bytes(seed), 'HKDF', false, ['deriveBits']);
  const salt = new TextEncoder().encode('scuole-vicine/shared-space/v2');
  const derive = async (info: string, length: number) => base64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(info) }, material, length)));
  const [id, access, key] = await Promise.all([derive('id', 128), derive('access', 256), derive('encryption', 256)]);
  const c = { id, access, key, seed };
  verifiedSeeds.set(c, fingerprint(c));
  return c;
}
export async function createCredentials(): Promise<Credentials> { return credentialsFromSeed(random()); }
export function validCredentials(value: unknown): value is Credentials {
  const c = value as Credentials | null;
  return !!c && idPattern.test(c.id) && secretPattern.test(c.access) && secretPattern.test(c.key) && (c.seed === undefined || canonicalSeed(c.seed));
}
/** Validate persisted seed metadata against all three derived values before use.
 * Legacy records keep their existing ID, authorization and ciphertext. */
export async function restoreCredentials(value: unknown): Promise<Credentials | null> {
  if (!validCredentials(value)) return null;
  if (value.seed === undefined) return { id: value.id, access: value.access, key: value.key };
  const derived = await credentialsFromSeed(value.seed);
  return derived.id === value.id && derived.access === value.access && derived.key === value.key ? derived : null;
}
export async function parseLink(hash: string): Promise<Credentials | null> {
  const fragment = hash.replace(/^#/, '');
  if (fragment.startsWith('2.')) {
    const seed = fragment.slice(2);
    return canonicalSeed(seed) ? credentialsFromSeed(seed) : null;
  }
  // Lossless packing of the same 16 + 32 + 32 random bytes. No shorter keys,
  // lookup service or server-side copy of the encryption key is introduced.
  if (fragment.startsWith('1.')) {
    const packed = fragment.slice(2);
    if (!/^[A-Za-z0-9_-]{107}$/.test(packed)) return null;
    try {
      const data = bytes(packed);
      if (data.length !== 80 || base64(data) !== packed) return null;
      return { id: base64(data.slice(0, 16)), access: base64(data.slice(16, 48)), key: base64(data.slice(48, 80)) };
    } catch { return null; }
  }
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const c = { id: p.get('spazio') || '', access: p.get('accesso') || '', key: p.get('chiave') || '' };
  return validCredentials(c) ? c : null;
}
// Pasted links are read locally; never navigate to or fetch the pasted URL.
export async function parseSpaceURL(value: string, origin: string): Promise<Credentials | null> {
  try {
    const url = new URL(value.trim());
    if (url.origin !== origin || !/^\/(?:famiglia|s)\/?$/.test(url.pathname) || url.username || url.password || url.search) return null;
    return parseLink(url.hash);
  } catch { return null; }
}
export function link(c: Credentials, origin: string): string {
  if (!validCredentials(c)) throw new Error('Credenziali dello spazio non valide.');
  if (c.seed !== undefined) {
    // Fail closed for mutated credentials or unverified JSON metadata, rather
    // than producing a link that silently opens a different space.
    if (verifiedSeeds.get(c) !== fingerprint(c)) throw new Error('Le credenziali dello spazio devono essere verificate prima di creare il link.');
    return `${origin}/s/#2.${c.seed}`;
  }
  const packed = new Uint8Array(80);
  packed.set(bytes(c.id), 0); packed.set(bytes(c.access), 16); packed.set(bytes(c.key), 48);
  return `${origin}/s/#1.${base64(packed)}`;
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
