import { normalizeArea } from './search-area.ts';
import type { AddressMatch } from './proximity.ts';

export const SEARCH_SESSION_KEY = 'scuole-vicine-search-session-v1';
export const SEARCH_SESSION_TTL = 60 * 60 * 1000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type SearchSession = {
  version: 1; savedAt: number; url: string; openedPath: string;
  mode: 'address' | 'name'; query: string; stage: '' | 'nursery' | 'preschool';
  radius: string; municipality: string; management: string; service: string;
  sort: 'name' | 'distance' | 'details'; onlySaved: boolean; origin: AddressMatch | null;
  expandedFacts: string[]; view: 'list' | 'map'; shown: number; count: number; selectedId: string | null; scrollY: number;
  mapView: { lat: number; lng: number; zoom: number } | null;
};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const short = (v: unknown, max = 512): v is string => typeof v === 'string' && v.length <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const between = (v: unknown, min: number, max: number): v is number => finite(v) && v >= min && v <= max;

/** A return URL carries public catalogue filters; addresses and coordinates stay in the tab. */
export function publicSearchUrl(value: string): string {
  const parsed = new URL(value, 'https://search.invalid');
  if (parsed.origin !== 'https://search.invalid' || parsed.pathname !== '/') throw new Error('Invalid search URL');
  const clean = new URLSearchParams();
  for (const key of ['fascia', 'servizio', 'tipo', 'raggio', 'area', 'municipio', 'gestione', 'salvate', 'ordine']) {
    const item = parsed.searchParams.get(key);
    if (item && item.length <= 200) clean.set(key, item);
  }
  if (clean.get('tipo') === 'nome') {
    const name = parsed.searchParams.get('q');
    if (name && name.length <= 512) clean.set('q', name);
  }
  return clean.size ? `/?${clean}` : '/';
}
export function validateSearchSession(value: unknown, now = Date.now()): SearchSession | null {
  if (!record(value) || value.version !== 1 || !finite(value.savedAt) || now < value.savedAt || now - value.savedAt > SEARCH_SESSION_TTL) return null;
  if (!short(value.url, 2000) || !short(value.openedPath, 300) || !/^\/scuole\/[a-z0-9-]+\/$/.test(value.openedPath)) return null;
  if (!['address', 'name'].includes(String(value.mode)) || !['', 'nursery', 'preschool'].includes(String(value.stage)) || !short(value.query)) return null;
  if (!short(value.radius) || !/^(?:[1-9]|10)$/.test(value.radius) || !short(value.municipality) || (value.municipality!=='' && normalizeArea(value.municipality)==='')) return null;
  if (!short(value.management, 80) || !short(value.service, 120) || !['name', 'distance', 'details'].includes(String(value.sort)) || typeof value.onlySaved !== 'boolean') return null;
  if (!['list', 'map'].includes(String(value.view)) || !between(value.shown, 12, 2000) || !Number.isInteger(value.shown) || !between(value.count, 0, 2000) || !Number.isInteger(value.count) || !between(value.scrollY, 0, 2000000)) return null;
  if (!Array.isArray(value.expandedFacts) || value.expandedFacts.length > 6000 || value.expandedFacts.some(item=>!short(item,250))) return null;
  if (value.selectedId !== null && !short(value.selectedId, 200)) return null;
  if (value.origin !== null) {
    const origin = value.origin;
    if (!record(origin) || !between(origin.lat, 45.3, 45.7) || !between(origin.lng, 8.9, 9.5) || !short(origin.label) || !(origin.houseNumber === null || short(origin.houseNumber, 30)) || !(origin.street === null || short(origin.street))) return null;
  }
  if (value.sort === 'distance' && !value.origin) return null;
  if (value.mapView !== null && (!record(value.mapView) || !between(value.mapView.lat, -85, 85) || !between(value.mapView.lng, -180, 180) || !between(value.mapView.zoom, 1, 20))) return null;
  try { return { ...value, url: publicSearchUrl(value.url) } as SearchSession; } catch { return null; }
}
export function readSearchSession(storage: StorageLike | null, now = Date.now()): SearchSession | null {
  try {
    const raw = storage?.getItem(SEARCH_SESSION_KEY);
    if (!raw || raw.length > 2000000) return null;
    const result = validateSearchSession(JSON.parse(raw), now);
    if (!result) storage?.removeItem(SEARCH_SESSION_KEY);
    return result;
  } catch { return null; }
}
export function writeSearchSession(storage: StorageLike | null, state: SearchSession): boolean {
  try {
    const safe = validateSearchSession(state);
    if (!safe || !storage) return false;
    storage.setItem(SEARCH_SESSION_KEY, JSON.stringify(safe));
    return true;
  } catch { return false; }
}
export function tabSearchStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; }
}
