import { decrypt, encrypt, random, validEnvelope, type Credentials, type Remote, type Envelope } from './protocol';
import { equal, merge, validateDocument, type Conflict, type SharedDocument } from './document';
import { readVault, writeVault } from './vault';
export type Snapshot = { base: SharedDocument; local: SharedDocument; revision: number; expiresAt: number; pending: { envelope: Envelope; document: SharedDocument } | null; conflicts?: Conflict[] };
export type SyncStatus = 'saved' | 'saving' | 'offline' | 'conflict' | 'unavailable' | 'storage-error';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function request(c: Credentials, method = 'GET', envelope?: Envelope, revision?: number): Promise<Remote> {
  const response = await fetch(`/api/spaces/${c.id}`, {
    method, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Authorization: `Bearer ${c.access}`, ...(envelope ? { 'Content-Type': 'application/json', 'X-Operation-Id': envelope.operation } : {}), ...(revision ? { 'If-Match': String(revision) } : {}) },
    body: envelope ? JSON.stringify(envelope) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  let result: unknown;
  try { result = await response.json(); } catch { throw new ApiError(response.status, 'Il servizio di condivisione non è disponibile. Puoi continuare a usare la copia su questo dispositivo e riprovare più tardi.'); }
  if (!response.ok && response.status !== 409) throw new ApiError(response.status, (result as { error?: string }).error || 'Il servizio non è disponibile. Riprova più tardi.');
  if (method === 'DELETE') { if (!response.ok) throw new ApiError(response.status, 'Lo spazio è cambiato: sincronizza e conferma di nuovo.'); return result as Remote; }
  if (!validEnvelope(result) || !Number.isFinite((result as Remote).expiresAt)) throw new ApiError(response.status, 'Non siamo riusciti a leggere la risposta del servizio. Riprova più tardi.');
  return result as Remote; // On 409 the authoritative version is merged, never overwritten.
}
export async function decode(remote: Remote, c: Credentials): Promise<SharedDocument> {
  try { return validateDocument(await decrypt(remote, c)); } catch { throw new Error('Non siamo riusciti ad aprire gli appunti protetti. Controlla che il link sia completo e corretto.'); }
}
export class SharedClient {
  state: Snapshot;
  conflicts: Conflict[] = [];
  status: SyncStatus = 'saved';
  stopped = false;
  canSync: () => boolean = () => true;
  private running = false;
  pendingWrites = 0;
  private writes: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(public credentials: Credentials, public vaultId: string, state: Snapshot, private changed: () => void) { this.state = structuredClone(state); this.conflicts = this.state.conflicts || []; if (this.conflicts.length) this.status = 'conflict'; }
  static async restore(c: Credentials, vaultId: string, changed: () => void): Promise<SharedClient | null> {
    const snapshot = await readVault<Snapshot>(vaultId, c);
    if (!snapshot) return null;
    snapshot.base = validateDocument(snapshot.base); snapshot.local = validateDocument(snapshot.local);
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1) throw new Error('Non siamo riusciti a leggere questa bozza perché il suo formato non è valido.');
    return new SharedClient(c, vaultId, snapshot, changed);
  }
  static async open(c: Credentials, vaultId: string, changed: () => void): Promise<SharedClient> {
    const remote = await request(c), document = await decode(remote, c);
    return new SharedClient(c, vaultId, { base: document, local: document, revision: remote.revision, expiresAt: remote.expiresAt, pending: null }, changed);
  }
  private notify(status?: SyncStatus) { if (status) this.status = status; this.changed(); }
  async persist(): Promise<void> {
    const snapshot = structuredClone(this.state);
    const write = this.writes.catch(() => {}).then(() => writeVault(this.vaultId, this.credentials, snapshot));
    this.writes = write;
    this.pendingWrites++;
    try { await write; } catch (error) { this.notify('storage-error'); throw error; } finally { this.pendingWrites--; }
  }
  set(document: SharedDocument) {
    this.state.local = validateDocument(document);
    for (const conflict of this.conflicts) conflict.local = this.state.local.entries[conflict.school]?.[conflict.field] || '';
    this.state.conflicts = this.conflicts;
    this.notify(this.conflicts.length ? 'conflict' : 'saving');
    void this.persist().then(() => this.schedule()).catch(() => {});
  }
  schedule() {
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(() => { void this.sync(); }, 800);
  }
  async sync() {
    if (this.running || this.stopped || this.conflicts.length || !this.canSync()) return;
    this.running = true;
    try {
      const remote = await request(this.credentials);
      await this.receive(remote);
      if (this.conflicts.length || this.stopped) return;
      if (!equal(this.state.local, this.state.base)) {
        this.notify('saving');
        const document = structuredClone(this.state.local);
        const envelope = await encrypt(document, this.credentials, this.state.revision + 1, random(16));
        this.state.pending = { document, envelope };
        await this.persist(); // Never send a modification before preserving its recovery copy.
        const accepted = await request(this.credentials, 'PUT', envelope);
        await this.receive(accepted);
      }
      this.notify(equal(this.state.local, this.state.base) ? 'saved' : 'saving');
      if (!equal(this.state.local, this.state.base)) this.schedule();
    } catch (error) {
      if (this.status !== 'storage-error') this.notify(error instanceof ApiError && error.status === 404 ? 'unavailable' : 'offline');
    } finally { this.running = false; }
  }
  private async receive(remote: Remote) {
    if (remote.revision < this.state.revision) throw new Error('La versione ricevuta dal servizio è precedente a quella su questo dispositivo. Riprova a sincronizzare lo spazio.');
    const document = await decode(remote, this.credentials);
    const base = this.state.pending?.envelope.operation === remote.operation ? this.state.pending.document : this.state.base;
    const result = merge(base, this.state.local, document);
    this.state = { base: document, local: result.document, revision: remote.revision, expiresAt: remote.expiresAt, pending: null };
    this.conflicts = result.conflicts;
    this.state.conflicts = this.conflicts;
    if (this.conflicts.length) {
      await this.persist();
      this.notify('conflict');
    } else { await this.persist(); this.notify(); }
  }
  resolve(choices: string[]) {
    if (choices.length !== this.conflicts.length) throw new Error('Scegli quale versione conservare per ogni modifica prima di salvare.');
    const document = structuredClone(this.state.local);
    this.conflicts.forEach((conflict, i) => { document.entries[conflict.school][conflict.field] = choices[i]; });
    this.state.local = validateDocument(document);
    this.conflicts = [];
    this.state.conflicts = [];
    this.set(document);
  }
  stop() { this.stopped = true; clearTimeout(this.timer); }
}
