import { addressContext } from './search-area.ts';
import type { AddressMatch } from './proximity';
export type CivicAddress = { street: string; houseNumber: string };
export const normalizeCivic = (value: string) => value.replace(/\s/g, '').replace(/[\/-](?=[a-z])/gi, '').replace(/^0+(?=\d)/,'').toUpperCase();
export function parseCivicAddress(value: string): CivicAddress | null {
  const address=addressContext(value, null).address.replace(/[,\s]+\d{5}\s*$/,'').replace(/\b(?:n\.|civico)\s*(?=\d)/i,'').trim();
  const match=address.match(/^(.+?)[\s,]+(\d{1,4}(?:\s*(?:\/\s*\d{1,4}[a-z]?|[\/-]?\s*[a-z]))?(?:\s*-\s*\d{1,4}[a-z]?)?)$/i);
  return match ? {street:match[1].trim(),houseNumber:match[2].replace(/\s+/g,'')} : null;
}
function normalizeStreet(value: string): string[] {
  return value.toLowerCase().replace(/^v\.le\s/,'viale ').replace(/^c\.so\s/,'corso ').replace(/^p\.za\s/,'piazza ').replace(/^p\.le\s/,'piazzale ').replace(/^v\.\s/,'via ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/);
}
export function matchesCivicAddress(match: Pick<AddressMatch, 'street' | 'houseNumber'>, requested: CivicAddress): boolean {
  if(!match.street || !match.houseNumber || normalizeCivic(match.houseNumber)!==normalizeCivic(requested.houseNumber))return false;
  const wanted=normalizeStreet(requested.street), actual=normalizeStreet(match.street);
  const streetTypes=['via','viale','corso','piazza','piazzale','largo','vicolo','alzaia','galleria','passaggio','piazzetta','giardino','foro','bastioni','sottopasso','cavalcavia','parco','sito','strada','ripa'];
  if(streetTypes.includes(wanted[0]) && wanted[0]!==actual[0])return false;
  return wanted.every(word=>actual.includes(word));
}
