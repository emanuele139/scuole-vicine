import { getSchool } from '../catalog-client';
import { loadFamily, setFamilyAdapter, type FamilyState } from '../family';
import { credentials, encrypt, link, parseLink, validCredentials, random, type Credentials } from './protocol';
import { SharedClient, request, decode, type Snapshot } from './client';
import { validateDocument, equal, merge, type SharedDocument } from './document';
import { drafts, removeVault, readVault } from './vault';
const ACTIVE = 'scuole-milano-shared-access-v1';
let client: SharedClient | null = null;
let compare: string[] = [];
let tabId = '';
let incoming: Credentials | null = null;
let incomingClient: SharedClient | null = null;
let error = '';
function notify() {
  window.dispatchEvent(new CustomEvent('shared:change'));
  if (client) window.dispatchEvent(new CustomEvent('family:change', { detail: { state: loadFamily(), persisted: true } }));
}
export function sharedInfo() { return { client, incoming, error }; }
export function sharedLink() { if (!client) throw new Error('Non hai ancora aperto uno spazio condiviso.'); return link(client.credentials, location.origin); }
export function sharedDocument(state: FamilyState): SharedDocument { return validateDocument({ version: 1, saved: state.saved, entries: state.entries }); }
function vaultId(c: Credentials) { return `${c.id}:${tabId}`; }
async function attach(next: SharedClient) {
  await next.persist();
  localStorage.setItem(ACTIVE, JSON.stringify(next.credentials));
  client?.stop();
  client = next;
  client.canSync = () => !(document.activeElement instanceof HTMLTextAreaElement && document.activeElement.hasAttribute('data-family-field'));
  compare = [];
  try { compare = JSON.parse(localStorage.getItem(`shared-compare:${next.credentials.id}`) || '[]'); } catch { /* Optional device-only selection. */ }
  setFamilyAdapter({
    load: () => ({ ...client!.state.local, compare } as FamilyState),
    save: state => {
      compare = state.compare;
      try { localStorage.setItem(`shared-compare:${next.credentials.id}`, JSON.stringify(compare)); } catch { /* Notes use the encrypted vault. */ }
      const document = sharedDocument(state);
      // Catalog updates must not erase entries unknown to the current static build.
      for (const [id, entry] of Object.entries(client!.state.local.entries)) {
        if (!Object.hasOwn(document.entries, id)) document.entries[id] = entry;
      }
      for (const id of client!.state.local.saved) if (!getSchool(id) && !document.saved.includes(id)) document.saved.push(id);
      client!.set(document);
    },
  });
  error = '';
  notify();
  void client.sync();
}
function receiveLink() {
  const fragment = location.hash;
  if (fragment.includes('spazio=') || fragment.includes('chiave=') || fragment.includes('accesso=')) {
    incoming = parseLink(fragment);
    incomingClient = null;
    history.replaceState(null, '', location.pathname + location.search);
    error = incoming ? '' : 'Il link segreto è incompleto o non è valido. Puoi chiedere un nuovo link alla persona che lo ha condiviso.';
    if (client && incoming?.id === client.credentials.id && incoming.key === client.credentials.key && incoming.access === client.credentials.access) incoming = null;
    notify();
  }
}
export const ready = (async () => {
  if (typeof window === 'undefined') return;
  const main = document.querySelector('main');
  if (main) main.inert = true;
  receiveLink();
  window.addEventListener('hashchange', receiveLink);
  try {
    const previousTab = sessionStorage.getItem('family-shared-tab');
    tabId = random(16); // Every document gets its own vault, including duplicated browser tabs.
    sessionStorage.setItem('family-shared-tab', tabId);
    const stored: unknown = JSON.parse(localStorage.getItem(ACTIVE) || 'null');
    if (validCredentials(stored)) {
      const previous = previousTab ? await readVault<Snapshot>(`${stored.id}:${previousTab}`, stored) : null;
      let restored = previous ? new SharedClient(stored, vaultId(stored), previous, notify) : null;
      // A newly opened tab can recover the latest encrypted draft without modifying its source.
      if (!restored) {
        const records = (await drafts(stored)).sort((a, b) => b.updated - a.updated);
        if (records[0]) {
          const snapshot = await readVault<Snapshot>(records[0].id, stored);
          if (snapshot) restored = new SharedClient(stored, vaultId(stored), snapshot, notify);
        }
      }
      await attach(restored || await SharedClient.open(stored, vaultId(stored), notify));
      const received = sharedInfo().incoming;
      if (received?.id === stored.id && received.key === stored.key && received.access === stored.access) incoming = null;
    }
  } catch { error = 'Non siamo riusciti a riaprire lo spazio condiviso. La copia locale resta disponibile. Per riprovare, apri di nuovo il link segreto.'; }
  if (main) main.inert = false;
  notify();
  setInterval(() => { if (!document.hidden) void client?.sync(); }, 15000);
  document.addEventListener('focusout', () => setTimeout(() => { void client?.sync(); }, 0));
  window.addEventListener('online', () => { void client?.sync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void client?.sync(); });
  window.addEventListener('beforeunload', event => {
    if (client && (client.pendingWrites > 0 || ['saving', 'storage-error'].includes(client.status))) { event.preventDefault(); }
  });
})();
export async function createShared() {
  await ready;
  if (client) return;
  if (!crypto.subtle || !tabId) throw new Error('Per attivare lo spazio condiviso, apri il sito con una connessione sicura HTTPS e consenti al browser di salvare dati su questo dispositivo.');
  const document = sharedDocument(loadFamily());
  // Stable credentials/envelope make retrying an uncertain creation idempotent.
  const pendingKey = 'family-shared-creation';
  let pending: { credentials: Credentials; envelope: Awaited<ReturnType<typeof encrypt>>; document?: SharedDocument };
  const raw = sessionStorage.getItem(pendingKey);
  if (raw) pending = JSON.parse(raw);
  else {
    const c = credentials();
    pending = { credentials: c, envelope: await encrypt(document, c, 1) };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
  }
  const remote = await request(pending.credentials, 'POST', pending.envelope);
  const original = await decode(remote, pending.credentials);
  const result = merge(original, document, original);
  await attach(new SharedClient(pending.credentials, vaultId(pending.credentials), { base: original, local: result.document, revision: remote.revision, expiresAt: remote.expiresAt, pending: null }, notify));
  sessionStorage.removeItem(pendingKey);
}
export async function previewIncoming(): Promise<SharedDocument> {
  await ready;
  if (!incoming) throw new Error('Non abbiamo trovato un link da aprire. Controlla di aver copiato il link completo.');
  incomingClient = await SharedClient.open(incoming, vaultId(incoming), notify);
  return incomingClient.state.local;
}
export async function acceptIncoming() {
  if (!incomingClient) throw new Error('Apri prima l’anteprima del link ricevuto, poi potrai collegare lo spazio.');
  if (client && (client.status !== 'saved' || client.conflicts.length)) throw new Error('Prima di passare a un altro spazio, salva le modifiche di quello aperto e scegli quali versioni conservare, se richiesto.');
  await attach(incomingClient);
  incoming = null; incomingClient = null; notify();
}
export function dismissIncoming() { incoming = null; incomingClient = null; notify(); }
export async function leaveShared() {
  if (!client) return;
  await client.persist();
  client.stop(); client = null;
  localStorage.removeItem(ACTIVE);
  setFamilyAdapter(null); notify();
}
export async function deleteShared() {
  if (!client) return;
  if (client.status !== 'saved' || client.conflicts.length) throw new Error('Prima di eliminare lo spazio, sincronizza le modifiche e scegli quali versioni conservare, se richiesto.');
  await request(client.credentials, 'DELETE', undefined, client.state.revision);
  const records = await drafts(client.credentials);
  await leaveShared();
  for (const record of records) await removeVault(record.id);
}
export async function recoverDrafts() {
  if (!client) throw new Error('Per cercare le bozze, apri prima uno spazio condiviso.');
  const current = client;
  const records = (await drafts(current.credentials)).filter(r => r.id !== current.vaultId);
  const pending = await Promise.all(records.map(async record => {
    const snapshot = await readVault<Snapshot>(record.id, current.credentials);
    return snapshot && (!equal(snapshot.base, snapshot.local) || snapshot.conflicts?.length) ? record : null;
  }));
  return pending.filter((record): record is { id: string; updated: number } => record !== null);
}
export async function recoverDraft(id: string) {
  if (!client || client.conflicts.length) throw new Error('Per recuperare una bozza, scegli prima quali versioni conservare nelle modifiche ancora da confrontare.');
  const draft = await readVault<Snapshot>(id, client.credentials);
  if (!draft) throw new Error('Non siamo riusciti a recuperare questa bozza. Prova a riaprire l’elenco delle bozze.');
  const result = merge(validateDocument(draft.base), validateDocument(draft.local), client.state.local);
  client.state.local = result.document;
  client.conflicts = [...result.conflicts];
  for (const conflict of draft.conflicts || []) {
    const local = result.document.entries[conflict.school]?.[conflict.field];
    const remote = client.state.base.entries[conflict.school]?.[conflict.field];
    if (local !== remote && !client.conflicts.some(c => c.school === conflict.school && c.field === conflict.field)) client.conflicts.push({ ...conflict, local: local || '', remote: remote || '' });
  }
  client.state.conflicts = client.conflicts;
  client.set(result.document);
}
