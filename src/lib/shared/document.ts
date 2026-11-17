export type Entry = { status: string; note: string; questions: string; parentA: string; parentB: string };
export type SharedDocument = { version: 1; saved: string[]; entries: Record<string, Entry> };
export type Conflict = { school: string; field: keyof Entry; base: string; local: string; remote: string };
export const fields = ['status', 'note', 'questions', 'parentA', 'parentB'] as const;
const statuses = ['da-valutare', 'da-contattare', 'visita-prenotata', 'visitata', 'esclusa'];
export const blankEntry = (): Entry => ({ status: 'da-valutare', note: '', questions: '', parentA: '', parentB: '' });
export function validateDocument(value: unknown): SharedDocument {
  const d = value as SharedDocument;
  if (!d || d.version !== 1 || !Array.isArray(d.saved) || !d.entries || typeof d.entries !== 'object' || Array.isArray(d.entries)) throw new Error('Non siamo riusciti a leggere il contenuto dello spazio perché il suo formato non è valido.');
  const ids = [...d.saved, ...Object.keys(d.entries)];
  if (ids.length > 4000 || ids.some(id => typeof id !== 'string' || id.length > 160 || !/^[\w-]+$/.test(id))) throw new Error('L’elenco delle scuole contiene dati che non possiamo leggere.');
  for (const entry of Object.values(d.entries)) {
    if (!entry || !statuses.includes(entry.status)) throw new Error('Una visita ha uno stato che non possiamo riconoscere.');
    for (const field of fields) {
      if (typeof entry[field] !== 'string' || entry[field].length > (field === 'parentA' || field === 'parentB' ? 1000 : 10000)) throw new Error('Un appunto contiene dati non validi oppure supera la lunghezza consentita.');
    }
  }
  if (new TextEncoder().encode(JSON.stringify(d)).length > 900_000) throw new Error('Lo spazio supera la dimensione consentita. Esporta una copia, poi riduci il testo degli appunti.');
  // Rebuild known fields only; never propagate untrusted object prototypes.
  return { version: 1, saved: [...new Set(d.saved)].sort(), entries: Object.fromEntries(Object.entries(d.entries).map(([id, e]) => [id, Object.fromEntries(fields.map(f => [f, e[f]])) as Entry])) };
}
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && equal(x[key], y[key]));
}
export function merge(base: SharedDocument, local: SharedDocument, remote: SharedDocument): { document: SharedDocument; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  const saved = new Set(remote.saved);
  for (const id of new Set([...base.saved, ...local.saved])) {
    if (base.saved.includes(id) !== local.saved.includes(id)) {
      if (local.saved.includes(id)) saved.add(id); else saved.delete(id);
    }
  }
  const entries: Record<string, Entry> = Object.create(null);
  for (const id of new Set([...Object.keys(base.entries), ...Object.keys(local.entries), ...Object.keys(remote.entries)])) {
    const b = base.entries[id] || blankEntry(), l = local.entries[id] || blankEntry(), r = remote.entries[id] || blankEntry();
    const result = blankEntry();
    for (const field of fields) {
      result[field] = l[field] === b[field] ? r[field] : l[field];
      if (l[field] !== b[field] && r[field] !== b[field] && l[field] !== r[field]) conflicts.push({ school: id, field, base: b[field], local: l[field], remote: r[field] });
    }
    entries[id] = result;
  }
  return { document: { version: 1, saved: [...saved].sort(), entries }, conflicts };
}
