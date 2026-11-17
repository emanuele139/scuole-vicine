import { CONSENT_KEY, analyticsPath, makeConsent, readConsent } from '../lib/consent';
type Payload = Record<string, unknown>;
declare global { interface Window { scuoleBeforeSend?: (type: string, payload: Payload) => Payload | false; umami?: { track: (callback: (props: Payload) => Payload) => void } } }
const banner = document.querySelector<HTMLElement>('#cookie-banner')!;
const dialog = document.querySelector<HTMLDialogElement>('#privacy-preferences')!;
const analytics = document.querySelector<HTMLInputElement>('#consent-analytics')!;
const maps = document.querySelector<HTMLInputElement>('#consent-maps')!;
const status = document.querySelector<HTMLElement>('#privacy-storage-status')!;
let current = readConsent();
let opener: HTMLElement | null = null;
let loading = false;
let trackerReady = false;
let measured = false;
let expiryTimer: ReturnType<typeof setTimeout>;
const signalBlocked = () => navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
function permitted() { return ['scuolevicine.it', 'www.scuolevicine.it'].includes(location.hostname) && !!current?.analytics && current.expiresAt > Date.now() && !signalBlocked() && !!analyticsPath(location.pathname); }
window.scuoleBeforeSend = (type, payload) => {
  const path = analyticsPath(location.pathname);
  if (!permitted() || !path || type !== 'event' || payload.name || payload.data) return false;
  // Allowlist: nothing read from forms, storage, query strings, hash or referrer.
  return Object.fromEntries(Object.entries({ website: payload.website, hostname: location.hostname, language: navigator.language, screen: `${screen.width}x${screen.height}`, url: location.origin + path, title: 'Scuole Vicine', referrer: '' }).filter(([, v]) => v !== undefined));
};
function startAnalytics() {
  if (!permitted()) { measured = false; return; }
  if (measured || loading || banner.dataset.analyticsEnabled !== 'true') return;
  const track = () => {
    if (!permitted() || !window.umami || measured) return;
    measured = true;
    window.umami.track(props => ({ ...props, url: location.origin + analyticsPath(location.pathname), title: 'Scuole Vicine', referrer: '' }));
  };
  if (trackerReady) { track(); return; }
  loading = true;
  const script = document.createElement('script');
  script.id = 'umami-tracker'; script.src = banner.dataset.umamiScript!; script.defer = true;
  script.referrerPolicy = 'no-referrer';
  Object.assign(script.dataset, { websiteId: banner.dataset.umamiId, autoTrack: 'false', excludeSearch: 'true', excludeHash: 'true', doNotTrack: 'true', beforeSend: 'scuoleBeforeSend', performance: 'false', errors: 'false', fetchCredentials: 'omit' });
  script.onload = () => { loading = false; trackerReady = !!window.umami; track(); };
  script.onerror = () => { loading = false; script.remove(); };
  document.head.append(script);
}
function syncEmbeds() {
  document.querySelectorAll<HTMLElement>('[data-private-map]').forEach(container => {
    const allowed = !!current?.maps && current.expiresAt > Date.now();
    const placeholder = container.querySelector<HTMLElement>('.map-privacy-placeholder');
    if (placeholder) placeholder.hidden = allowed;
    if (!allowed) container.querySelector('iframe')?.remove();
    else if (!container.querySelector('iframe')) {
      const frame = document.createElement('iframe');
      frame.src = container.dataset.privateMap!; frame.title = container.dataset.mapTitle || 'Mappa della scuola'; frame.loading = 'lazy'; frame.referrerPolicy = 'no-referrer'; container.append(frame);
    }
  });
}
function apply() {
  clearTimeout(expiryTimer);
  const blocked = signalBlocked();
  analytics.disabled = banner.dataset.analyticsEnabled !== 'true' || blocked;
  const signals = document.querySelector<HTMLElement>('#privacy-signals-status')!;
  signals.hidden = !blocked;
  signals.textContent = blocked ? 'Il browser invia un segnale Do Not Track o Global Privacy Control. Lo rispettiamo: le statistiche restano disattivate, anche se avevi già dato il consenso.' : '';
  banner.hidden = !!current;
  syncEmbeds();
  window.dispatchEvent(new Event('privacy:change'));
  if (current) {
    const remaining = current.expiresAt - Date.now();
    if (remaining <= 0) { current = null; apply(); return; }
    expiryTimer = setTimeout(() => { current = readConsent(); apply(); }, Math.min(remaining, 2147483647));
  }
  startAnalytics();
}
function close() { dialog.close(); opener?.focus(); }
function save(a: boolean, m: boolean) {
  current = makeConsent(a && !analytics.disabled, m);
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(current)); status.textContent = ''; }
  catch { status.textContent = 'Il browser impedisce il salvataggio: useremo questa scelta solo nella pagina aperta.'; }
  apply(); banner.hidden = true;
  if (status.textContent) { if (!dialog.open) { opener = document.querySelector<HTMLElement>('[data-privacy-open]'); dialog.showModal(); } return; }
  if (dialog.open) close();
  else document.querySelector<HTMLElement>('#contenuto')?.focus({ preventScroll: true });
}
document.querySelectorAll<HTMLElement>('[data-privacy-open]').forEach(button => button.addEventListener('click', () => {
  opener = button; analytics.checked = current?.analytics === true && !analytics.disabled; maps.checked = current?.maps === true; dialog.showModal();
}));
document.querySelectorAll('[data-consent-reject]').forEach(button => button.addEventListener('click', () => save(false, false)));
document.querySelectorAll('[data-consent-accept]').forEach(button => button.addEventListener('click', () => save(true, true)));
document.querySelector('[data-consent-save]')?.addEventListener('click', () => save(analytics.checked, maps.checked));
document.querySelector('[data-privacy-close]')?.addEventListener('click', close);
dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
window.addEventListener('storage', event => { if (event.key === CONSENT_KEY || event.key === null) { current = readConsent(); apply(); } });
window.addEventListener('pageshow', () => { current = readConsent(); apply(); });
apply();
