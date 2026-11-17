import type { AddressMatch } from './proximity';
import { parseCivicAddress, matchesCivicAddress } from './civic-address.ts';

export const ADDRESS_CACHE_KEY = 'scuole-milano-address-cache-v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
const FRESH_AGE = 5 * 60 * 1000;
const LIMIT = 50;
type Entry = { query: string; matches: AddressMatch[]; savedAt: number };
type CacheStorage = Pick<Storage, 'getItem' | 'setItem'>;
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bmilano?\b/g, '').trim().replace(/\s+/g, ' ');
const validMatch = (value: any): value is AddressMatch => value && typeof value.label === 'string' && value.label.length <= 1000 && Number.isFinite(value.lat) && Number.isFinite(value.lng) && value.lat >= 45.35 && value.lat <= 45.62 && value.lng >= 8.95 && value.lng <= 9.45 && (value.houseNumber === null || typeof value.houseNumber === 'string') && (value.street === null || typeof value.street === 'string');

/** Bounded, expiring browser cache. Memory fallback also works with storage blocked. */
export class AddressSuggestionCache {
  private entries: Entry[] = [];
  private storage: CacheStorage | null;
  private now: () => number;
  constructor(storage: CacheStorage | null, now: () => number = Date.now) {
    this.storage = storage; this.now = now;
    try {
      const data: unknown = JSON.parse(storage?.getItem(ADDRESS_CACHE_KEY) || '[]');
      if (Array.isArray(data)) this.entries = data.filter((entry): entry is Entry => entry && typeof entry.query === 'string' && entry.query.length <= 500 && Number.isFinite(entry.savedAt) && entry.savedAt <= this.now() && entry.savedAt > this.now() - MAX_AGE && Array.isArray(entry.matches) && entry.matches.length > 0 && entry.matches.length <= 5 && entry.matches.every(validMatch)).slice(-LIMIT);
      this.persist();
    } catch { /* Browser storage is optional. */ }
  }
  get(query: string): { matches: AddressMatch[]; exact: boolean; fresh: boolean } {
    const key = normalize(query), now = this.now(), civic = parseCivicAddress(query);
    const before = this.entries.length;
    this.entries = this.entries.filter(entry => now - entry.savedAt < MAX_AGE);
    if (before !== this.entries.length) this.persist();
    const exact = this.entries.find(entry => entry.query === key);
    const exactMatches=exact?.matches.filter(match=>!civic || matchesCivicAddress(match,civic));
    if (exact && exactMatches?.length) return { matches: exactMatches, exact: true, fresh: now - exact.savedAt < FRESH_AGE };
    if (key.length < 3) return { matches: [], exact: false, fresh: false };
    const words = key.split(' ');
    const matches: AddressMatch[] = [];
    for (const entry of [...this.entries].reverse()) for (const match of entry.matches) {
      if(civic && !matchesCivicAddress(match,civic))continue;
      const label = normalize(match.label);
      // A civic number must match a whole token: 1 must not silently suggest 12.
      if (words.every(word => /^\d+[a-z]?$/.test(word) ? label.split(' ').includes(word) : label.includes(word)) && !matches.some(other => other.label === match.label)) matches.push(match);
      if (matches.length === 5) return { matches, exact: false, fresh: false };
    }
    return { matches, exact: false, fresh: false };
  }
  set(query: string, matches: AddressMatch[]) {
    if (!matches.length || !matches.every(validMatch)) return;
    const key = normalize(query), now = this.now();
    this.entries = this.entries.filter(entry => entry.query !== key && now - entry.savedAt < MAX_AGE);
    this.entries.push({ query: key, matches: matches.slice(0, 5), savedAt: now });
    this.entries = this.entries.slice(-LIMIT);
    this.persist();
  }
  private persist() {
    try { this.storage?.setItem(ADDRESS_CACHE_KEY, JSON.stringify(this.entries)); } catch { /* Keep the in-memory cache. */ }
  }
}
