import { AddressSuggestionCache } from './address-cache.ts';
import { parseCivicAddress, matchesCivicAddress } from './civic-address.ts';
export type Coordinates = { lat: number; lng: number };
export type AddressMatch = Coordinates & { label: string; houseNumber: string | null; street: string | null };

/** Great-circle distance in km, rather than a walking/driving route. */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(to.lat - from.lat), dLng = radians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
}
export function radiusKm(value: string): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : 2;
}
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

let cache: AddressSuggestionCache | undefined;
function addressCache() {
  if (!cache) {
    let storage: Storage | null = null;
    try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* Use memory. */ }
    cache = new AddressSuggestionCache(storage);
  }
  return cache;
}
export function cachedAddressSuggestions(address: string) { return addressCache().get(address); }
let lastRequest = 0;
let retryAfter = 0;
const REQUEST_INTERVAL_MS = 250;
function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export async function findAddress(address: string, signal: AbortSignal): Promise<AddressMatch[]> {
  const cached = cachedAddressSuggestions(address);
  if (cached.exact && cached.fresh) return cached.matches;
  const matches = await requestAddress(address, signal);
  signal.throwIfAborted();
  if (matches.length) addressCache().set(address, matches);
  return matches;
}

async function requestAddress(address: string, signal: AbortSignal): Promise<AddressMatch[]> {
  // Photon public demo: user-triggered requests only, cached locally and throttled.
  const delay = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequest), retryAfter - Date.now());
  if (delay) await pause(delay, signal);
  signal.throwIfAborted();
  lastRequest = Date.now();
  const civic = parseCivicAddress(address);
  const url = new URL(civic ? 'https://photon.komoot.io/structured' : 'https://photon.komoot.io/api/');
  const params = new URLSearchParams({ lat: '45.4642', lon: '9.19', bbox: '8.95,45.35,9.45,45.62', limit: '5', countrycode: 'IT' });
  if (civic) { params.set('street',civic.street);params.set('housenumber',civic.houseNumber);params.set('city','Milano'); }
  else params.set('q', /milano|milan\b/i.test(address) ? address.trim() : `${address.trim()}, Milano`);
  url.search=params.toString();
  const response = await fetch(url, { signal, referrerPolicy: 'strict-origin-when-cross-origin' });
  if (response.status === 429) {
    const value = response.headers.get('Retry-After');
    const seconds = value === null ? NaN : Number(value);
    const requested = Number.isFinite(seconds) ? seconds * 1000 : value ? Date.parse(value) - Date.now() : 2000;
    retryAfter = Date.now() + Math.max(1000, Math.min(60000, Number.isFinite(requested) ? requested : 2000));
  }
  if (!response.ok) throw new Error('Il servizio indirizzi non è disponibile. Riprova tra poco.');
  const data: unknown = await response.json();
  const matches = parseAddressMatches(data);
  return civic ? matches.filter(match=>matchesCivicAddress(match,civic)) : matches;
}

export function parseAddressMatches(data: unknown): AddressMatch[] {
  if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features)) throw new Error('Non siamo riusciti a leggere la risposta del servizio indirizzi. Riprova.');
  const matches: AddressMatch[] = [];
  // Prefer an address node to a shop/museum at the same civic number.
  const priority=(item:any)=>Number(item?.properties?.osm_key==='place' && item?.properties?.osm_value==='house');
  for (const item of [...data.features].sort((a,b)=>priority(b)-priority(a))) {
    const coords = item?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2 || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') continue;
    const [lng, lat] = coords;
    const p = item?.properties;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 45.35 || lat > 45.62 || lng < 8.95 || lng > 9.45 || !p || p.countrycode !== 'IT' || !['milano','milan'].includes(String(p.city).toLowerCase())) continue;
    const houseNumber = typeof p.housenumber === 'string' ? p.housenumber : null;
    const street = typeof p.street === 'string' && p.street.trim() ? p.street.trim() : !houseNumber && typeof p.name === 'string' ? p.name : null;
    const label = [[street,houseNumber].filter(Boolean).join(' ') || p.name, p.postcode, 'Milano'].filter(v=>typeof v==='string' && v.trim()).join(', ');
    if (!label || matches.some(match => match.label === label)) continue;
    matches.push({ lat, lng, label, houseNumber, street });
  }
  return matches;
}
