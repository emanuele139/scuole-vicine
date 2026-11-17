import { matchesCivicAddress, normalizeCivic, type CivicAddress } from './civic-address.ts';
import type { AddressMatch } from './proximity';

type Street = { name: string; aliases: string[]; numbers: [string, number, number][] };
export type MunicipalCivics = { version: 1; streets: Street[] };
type Candidate = { street: Street; houseNumber: string; lat: number; lng: number };
const indexes = new WeakMap<MunicipalCivics, Map<string, Candidate[]>>();
function index(data: MunicipalCivics) {
  let result = indexes.get(data);
  if (!result) {
    result = new Map();
    for (const street of data.streets) for (const [houseNumber, lat, lng] of street.numbers) {
      const key = normalizeCivic(houseNumber);
      const candidates = result.get(key) || [];
      candidates.push({ street, houseNumber, lat, lng });
      result.set(key, candidates);
    }
    indexes.set(data, result);
  }
  return result;
}

export function lookupMunicipalCivic(data: MunicipalCivics, requested: CivicAddress): AddressMatch[] {
  const matches: AddressMatch[] = [];
  for (const {street, houseNumber, lat, lng} of index(data).get(normalizeCivic(requested.houseNumber)) || []) {
    const name = [street.name, ...street.aliases].find(alias => matchesCivicAddress({ street: alias, houseNumber: requested.houseNumber }, requested));
    if (!name) continue;
    const match = { street: name, houseNumber, lat, lng, label: `${name} ${houseNumber}, Milano` };
    if (!matches.some(other => other.label === match.label && other.lat === lat && other.lng === lng)) matches.push(match);
  }
  return matches.slice(0, 5);
}

let dataset: Promise<MunicipalCivics | null> | undefined;
let retryAt = 0;
function loadDataset(): Promise<MunicipalCivics | null> {
  if (dataset) return dataset;
  if (Date.now() < retryAt) return Promise.resolve(null);
  dataset = (async () => {
      // Only a public static catalogue is fetched. The typed address stays in this browser.
      const response = await fetch('/dati/civici-milano.json', { referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Catalogo civici non disponibile');
      const data = await response.json();
      if (data?.version !== 1 || !Array.isArray(data.streets) || data.streets.length > 10000 || !data.streets.every((street: any) =>
        typeof street?.name === 'string' && Array.isArray(street.aliases) && street.aliases.every((alias: unknown) => typeof alias === 'string') &&
        Array.isArray(street.numbers) && street.numbers.every((row: unknown) => Array.isArray(row) && typeof row[0] === 'string' &&
          Number.isFinite(row[1]) && Number.isFinite(row[2]) && row[1] >= 45.35 && row[1] <= 45.62 && row[2] >= 8.95 && row[2] <= 9.45))) throw new Error('Catalogo civici non valido');
      return data as MunicipalCivics;
  })().catch(() => {
      retryAt = Date.now() + 30000;
      dataset = undefined;
      return null;
  });
  return dataset;
}

export function findMunicipalCivic(requested: CivicAddress, signal: AbortSignal): Promise<AddressMatch[]> {
  signal.throwIfAborted();
  // One shared download; aborting a suggestion must not cancel the next search's catalogue.
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    loadDataset().then(data => {
      signal.removeEventListener('abort', abort);
      if (!signal.aborted) resolve(data ? lookupMunicipalCivic(data, requested) : []);
    }).catch(error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}
