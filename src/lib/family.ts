import { schools, getSchool } from './catalog-client';

export const FAMILY_STORAGE_KEY = 'scuole-milano-family-v1';
export const FAMILY_STATUSES = {
  'da-valutare': 'Da valutare',
  'da-contattare': 'Da contattare',
  'visita-prenotata': 'Visita prenotata',
  visitata: 'Visitata',
  esclusa: 'Esclusa',
} as const;
export type FamilyStatus = keyof typeof FAMILY_STATUSES;
export type FamilyEntry = {
  status: FamilyStatus;
  note: string;
  questions: string;
  parentA: string;
  parentB: string;
};
export type FamilyState = {
  version: 1;
  saved: string[];
  compare: string[];
  entries: Record<string, FamilyEntry>;
};
export type FamilyImportPreview = {
  state: FamilyState;
  schoolCount: number;
  noteCount: number;
  ignoredCount: number;
  exportedAt: string | null;
};

const emptyState = (): FamilyState => ({ version: 1, saved: [], compare: [], entries: {} });
const emptyEntry = (): FamilyEntry => ({ status: 'da-valutare', note: '', questions: '', parentA: '', parentB: '' });
let memory: FamilyState = emptyState();
let storageAvailable = true;
type FamilyAdapter = { load: () => FamilyState; save: (state: FamilyState) => void };
let sharedAdapter: FamilyAdapter | null = null;
export function setFamilyAdapter(adapter: FamilyAdapter | null) {
  sharedAdapter = adapter;
  memory = emptyState();
  storageAvailable = true;
  emit(loadFamily(), true);
}
export function localFamilyCopy(): FamilyState {
  const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
  return raw ? validateState(JSON.parse(raw), true).state : emptyState();
}
export function isSharedFamily(): boolean { return sharedAdapter !== null; }
export function validateFamilyState(value: unknown): FamilyState { return validateState(value, true).state; }


function notify(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('family:notice', { detail: { message } }));
}

function emit(state: FamilyState, persisted: boolean) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('family:change', { detail: { state, persisted } }));
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && !!getSchool(value);
}

function validateState(value: unknown, strict = false): { state: FamilyState; ignoredCount: number } {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.saved) || !Array.isArray(value.compare) || !record(value.entries)) {
    throw new Error('Non possiamo importare questo file perché il formato non è compatibile con lo spazio famiglia.');
  }
  if (value.saved.length > 2000 || value.compare.length > 2000 || Object.keys(value.entries).length > 2000) {
    throw new Error('Il file contiene più elementi di quanti possiamo importare in una volta.');
  }
  let ignoredCount = 0;
  const ids = (values: unknown[]) => [...new Set(values.filter(id => {
    if (validId(id)) return true;
    ignoredCount++;
    return false;
  }).map(id => getSchool(id as string)!.id))];
  const state = emptyState();
  state.saved = ids(value.saved);
  state.compare = ids(value.compare).slice(0, 3);
  for (const [id, raw] of Object.entries(value.entries)) {
    if (!validId(id)) { ignoredCount++; continue; }
    if (!record(raw)) { if (strict) throw new Error('Non possiamo leggere gli appunti di una delle scuole presenti nel file.'); continue; }
    const entry = emptyEntry();
    if (typeof raw.status === 'string' && Object.hasOwn(FAMILY_STATUSES, raw.status)) entry.status = raw.status as FamilyStatus;
    else if (raw.status !== undefined && strict) throw new Error('Il file contiene uno stato visita che non possiamo riconoscere.');
    for (const key of ['note', 'questions', 'parentA', 'parentB'] as const) {
      const text = raw[key];
      const limit = key === 'parentA' || key === 'parentB' ? 1000 : 10000;
      if (text === undefined) continue;
      if (typeof text !== 'string' || text.length > limit) {
        if (strict) throw new Error('Nel file ci sono appunti che non possiamo leggere oppure che superano la lunghezza consentita.');
        continue;
      }
      entry[key] = text;
    }
    state.entries[getSchool(id)!.id] = entry;
  }
  return { state, ignoredCount };
}

export function saveFamily(state: FamilyState): boolean {
  memory = validateState(state).state;
  if (sharedAdapter) {
    sharedAdapter.save(memory);
    emit(memory, true);
    return true;
  }
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(memory));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    notify('Il browser non consente il salvataggio. Le modifiche restano aperte in questa pagina: esporta una copia prima di chiuderla.');
  }
  emit(memory, storageAvailable);
  return storageAvailable;
}

function migrateLegacy(): FamilyState | null {
  const oldSaved = localStorage.getItem('paolo-schools-fav');
  const oldNotes = localStorage.getItem('paolo-schools-notes');
  if (!oldSaved && !oldNotes) return null;
  const lookup = new Map(schools.flatMap(s => [[s.id, s.id], ...(s.legacyId ? [[s.legacyId, s.id]] : [])] as [string, string][]));
  const state = emptyState();
  if (oldSaved) {
    try {
      const parsed = JSON.parse(oldSaved);
      if (Array.isArray(parsed)) state.saved = [...new Set(parsed.map(id => lookup.get(String(id))).filter(Boolean))] as string[];
    } catch { /* Keep the legacy value untouched. */ }
  }
  if (oldNotes) {
    try {
      const parsed = JSON.parse(oldNotes);
      if (record(parsed)) for (const [oldId, note] of Object.entries(parsed)) {
        const id = lookup.get(oldId);
        if (!id || typeof note !== 'string') continue;
        state.entries[id] = { ...emptyEntry(), note: note.slice(0, 10000) };
        if (note && !state.saved.includes(id)) state.saved.push(id);
      }
    } catch { /* Keep the legacy value untouched. */ }
  }
  return state;
}

export function loadFamily(): FamilyState {
  if (typeof window === 'undefined') return emptyState();
  if (sharedAdapter) return validateState(sharedAdapter.load()).state;
  if (!storageAvailable) return memory;
  try {
    const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
    if (raw) memory = validateState(JSON.parse(raw)).state;
    else {
      const migrated = migrateLegacy();
      if (migrated) saveFamily(migrated);
    }
  } catch {
    storageAvailable = false;
    notify('I dati locali non sono leggibili. Puoi continuare in questa pagina ed esportare una copia.');
  }
  return memory;
}

export function isFamilyStorageAvailable(): boolean { return storageAvailable; }

export function toggleSaved(id: string): FamilyState {
  const state = loadFamily();
  if (!validId(id)) return state;
  id = getSchool(id)!.id;
  state.saved = state.saved.includes(id) ? state.saved.filter(x => x !== id) : [...state.saved, id];
  saveFamily(state);
  return state;
}

export type SelectionRemoval = { id: string; index: number };
/** Only membership is removed: notes, visit decisions and the comparison stay intact. */
export function removeSavedSchool(id: string): SelectionRemoval | null {
  const state = loadFamily();
  const school = getSchool(id);
  if (!school) return null;
  const index = state.saved.indexOf(school.id);
  if (index < 0) return null;
  state.saved = state.saved.filter(item => item !== school.id);
  saveFamily(state);
  return { id: school.id, index };
}
/** Merge an undo into the current state, never roll back newer notes or another selection. */
export function restoreSavedSchool(removal: SelectionRemoval): FamilyState {
  const state = loadFamily();
  if (!validId(removal.id) || state.saved.includes(removal.id)) return state;
  const index = Math.max(0, Math.min(state.saved.length, Number.isInteger(removal.index) ? removal.index : state.saved.length));
  state.saved.splice(index, 0, getSchool(removal.id)!.id);
  saveFamily(state);
  return state;
}

export function toggleCompare(id: string): FamilyState {
  const state = loadFamily();
  if (!validId(id)) return state;
  id = getSchool(id)!.id;
  if (state.compare.includes(id)) state.compare = state.compare.filter(x => x !== id);
  else if (state.compare.length < 3) state.compare = [...state.compare, id];
  else { notify('Puoi confrontare fino a tre scuole. Togli una scuola per aggiungerne un’altra.'); return state; }
  saveFamily(state);
  return state;
}

export function updateSchool(id: string, patch: Partial<FamilyEntry>): FamilyState {
  const state = loadFamily();
  if (!validId(id)) return state;
  id = getSchool(id)!.id;
  state.entries[id] = { ...emptyEntry(), ...state.entries[id], ...patch };
  if (!state.saved.includes(id)) state.saved.push(id);
  saveFamily(state);
  return state;
}

export function exportFamily(): string {
  return JSON.stringify({ format: 'scuole-milano-family', version: 1, exportedAt: new Date().toISOString(), state: loadFamily() }, null, 2);
}

export function parseFamilyImport(text: string): FamilyImportPreview {
  if (text.length > 1_000_000) throw new Error('Il file è troppo grande. Il limite è 1 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Il file non è un JSON valido, cioè il formato usato per le copie degli appunti. Scegli una copia esportata dallo spazio famiglia.'); }
  if (!record(parsed) || parsed.format !== 'scuole-milano-family' || parsed.version !== 1) {
    throw new Error('Scegli un file esportato da Spazio famiglia, versione 1.');
  }
  const { state, ignoredCount } = validateState(parsed.state, true);
  if (!state.saved.length && !state.compare.length && !Object.keys(state.entries).length) {
    throw new Error('Nessuna delle scuole nel file è presente nel catalogo attuale.');
  }
  return {
    state,
    schoolCount: new Set([...state.saved, ...state.compare, ...Object.keys(state.entries)]).size,
    noteCount: Object.values(state.entries).filter(e => e.note || e.questions || e.parentA || e.parentB).length,
    ignoredCount,
    exportedAt: typeof parsed.exportedAt === 'string' && !Number.isNaN(Date.parse(parsed.exportedAt)) ? parsed.exportedAt : null,
  };
}

export function mergeFamilyImport(preview: FamilyImportPreview): FamilyState {
  const current = validateState(JSON.parse(JSON.stringify(loadFamily()))).state;
  const imported = validateState(preview.state, true).state;
  current.saved = [...new Set([...current.saved, ...imported.saved])];
  current.compare = [...new Set([...current.compare, ...imported.compare])].slice(0, 3);
  for (const [id, entry] of Object.entries(imported.entries)) {
    const existing = current.entries[id];
    if (!existing) { current.entries[id] = entry; continue; }
    const merged = { ...existing };
    for (const key of ['note', 'questions', 'parentA', 'parentB'] as const) {
      if (!entry[key] || existing[key] === entry[key]) continue;
      merged[key] = existing[key] ? `${existing[key]}\n\n— Dalla copia importata —\n${entry[key]}` : entry[key];
      const limit = key === 'parentA' || key === 'parentB' ? 1000 : 10000;
      if (merged[key].length > limit) throw new Error('L’unione supera lo spazio disponibile per un appunto. Esporta una copia e riduci il testo prima di riprovare.');
    }
    // Preserve a decision already made on this device; import a status only into an unreviewed entry.
    if (existing.status === 'da-valutare') merged.status = entry.status;
    current.entries[id] = merged;
  }
  saveFamily(current);
  return current;
}

export function selectionLink(state: FamilyState = loadFamily()): string {
  if (typeof window === 'undefined') return '';
  const url = new URL('/famiglia/', window.location.origin);
  url.searchParams.set('scuole', state.saved.join(','));
  return url.href;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (!sharedAdapter && (event.key === FAMILY_STORAGE_KEY || event.key === null)) {
      storageAvailable = true;
      memory = emptyState();
      emit(loadFamily(), storageAvailable);
    }
  });
}
