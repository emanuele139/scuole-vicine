/** Version this only when purposes/providers materially change. No visitor identifier. */
export const CONSENT_KEY = 'scuole-vicine-consent-v1';
export const CONSENT_VERSION = 1;
export type Consent = { version: 1; analytics: boolean; maps: boolean; savedAt: number; expiresAt: number };
export function makeConsent(analytics: boolean, maps: boolean, now = Date.now()): Consent {
  const expiry = new Date(now); expiry.setUTCMonth(expiry.getUTCMonth() + 6);
  return { version: CONSENT_VERSION, analytics, maps, savedAt: now, expiresAt: expiry.getTime() };
}
export function parseConsent(raw: string | null, now = Date.now()): Consent | null {
  try {
    const c = JSON.parse(raw || 'null');
    if (!c || c.version !== CONSENT_VERSION || typeof c.analytics !== 'boolean' || typeof c.maps !== 'boolean' || !Number.isFinite(c.savedAt) || !Number.isFinite(c.expiresAt) || c.savedAt > now || c.expiresAt <= now || c.expiresAt !== makeConsent(c.analytics, c.maps, c.savedAt).expiresAt) return null;
    return c;
  } catch { return null; }
}
export function readConsent(): Consent | null {
  try { return parseConsent(localStorage.getItem(CONSENT_KEY)); } catch { return null; }
}
export function mapsAllowed() { return readConsent()?.maps === true; }
/** Only public editorial paths; never query strings, secret fragments or personal pages. */
export function analyticsPath(path: string): string | null {
  if (path === '/' || /^\/(?:nidi|scuole-infanzia|agenda|iscrizioni|metodo|progetto)\/$/.test(path) || /^\/municipi\/[1-9]\/$/.test(path) || /^\/(?:scuole|guide)\/[a-z0-9-]+\/$/.test(path) || path === '/guide/') return path;
  return null;
}
