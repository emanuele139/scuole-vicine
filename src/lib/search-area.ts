/** The catalogue covers Milano and the 23 municipalities sharing its boundary. */
export const neighbouringComuni = [
  ['arese','Arese'],['assago','Assago'],['baranzate','Baranzate'],['bollate','Bollate'],['bresso','Bresso'],['buccinasco','Buccinasco'],['cesano-boscone','Cesano Boscone'],['cologno-monzese','Cologno Monzese'],['cormano','Cormano'],['corsico','Corsico'],['cusago','Cusago'],['novate-milanese','Novate Milanese'],['opera','Opera'],['pero','Pero'],['peschiera-borromeo','Peschiera Borromeo'],['rho','Rho'],['rozzano','Rozzano'],['san-donato-milanese','San Donato Milanese'],['segrate','Segrate'],['sesto-san-giovanni','Sesto San Giovanni'],['settimo-milanese','Settimo Milanese'],['trezzano-sul-naviglio','Trezzano sul Naviglio'],['vimodrone','Vimodrone'],
] as const;
export const comuni = [['milano','Milano'],...neighbouringComuni] as const;
export function normalizeArea(value: string): string {
  if (/^[1-9]$/.test(value) || value==='unknown') return `municipio-${value}`;
  return value==='' || comuni.some(([slug])=>slug===value) || /^municipio-(?:[1-9]|unknown)$/.test(value) ? value : '';
}
export function areaLabel(area: string): string {
  area=normalizeArea(area);
  if (!area) return 'Area di Milano';
  if (area==='milano') return 'Comune di Milano';
  if (area==='municipio-unknown') return 'Milano · Municipio da verificare';
  if (area.startsWith('municipio-')) return `Milano · Municipio ${area.slice(10)}`;
  return comuni.find(([slug])=>slug===area)?.[1] || 'Area di Milano';
}
export function areaComune(area: string): string | null {
  area=normalizeArea(area);
  if (area.startsWith('municipio-')) return 'Milano';
  return comuni.find(([slug])=>slug===area)?.[1] || null;
}
export function matchesSearchArea(school: {comuneSlug?: string; municipality: number|null}, area: string): boolean {
  area=normalizeArea(area);
  if (!area) return true;
  const comune=school.comuneSlug || 'milano';
  if (area.startsWith('municipio-')) return comune==='milano' && (area==='municipio-unknown' ? school.municipality===null : school.municipality===Number(area.slice(10)));
  return comune===area;
}
/** An explicit supported municipality in the address takes precedence over the area selector. */
export function addressContext(address: string, fallback: string|null='Milano'): {address:string; comune:string|null} {
  const cleaned=address.trim().replace(/,?\s*(?:Italia|Italy)\s*$/i,'').trim();
  for (const [,name] of [...comuni].sort((a,b)=>b[1].length-a[1].length)) {
    const pattern=new RegExp(`(?:,\\s*|\\s+)${name.replace(/ /g,'\\s+')}\\s*$`,'i');
    if(pattern.test(cleaned) && !/^(?:via|viale|corso|piazza|piazzale|largo|vicolo)\s*$/i.test(cleaned.replace(pattern,''))) return {address:cleaned.replace(pattern,'').replace(/,?\s*\d{5}\s*$/,'').trim(),comune:name};
  }
  // English spelling is returned by some providers and retained in old sessions.
  if (/(?:,\s*|\s+)Milan\s*$/i.test(cleaned)) return {address:cleaned.replace(/(?:,\s*|\s+)Milan\s*$/i,'').trim(),comune:'Milano'};
  return {address:cleaned,comune:fallback};
}
