import { encrypt, decrypt, type Credentials, type Envelope } from './protocol';
export type VaultRecord<T> = { id: string; space: string; updated: number; envelope: Envelope; value?: T };
let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('scuole-milano-shared', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Il browser non consente di salvare le bozze cifrate. Tieni aperta la pagina ed esporta una copia degli appunti.'));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('vault', mode), request = action(tx.objectStore('vault'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || new Error('Non siamo riusciti a salvare la bozza su questo dispositivo. Tieni aperta la pagina ed esporta una copia degli appunti.'));
    tx.onabort = () => reject(tx.error || new Error('Non siamo riusciti a salvare la bozza su questo dispositivo. Tieni aperta la pagina ed esporta una copia degli appunti.'));
  });
}
export async function writeVault(id: string, c: Credentials, value: unknown) {
  const record: VaultRecord<never> = { id, space: c.id, updated: Date.now(), envelope: await encrypt(value, c, 1) };
  await transaction('readwrite', store => store.put(record));
}
export async function readVault<T>(id: string, c: Credentials): Promise<T | null> {
  const record = await transaction<VaultRecord<T> | undefined>('readonly', store => store.get(id));
  return record ? await decrypt(record.envelope, c) as T : null;
}
export async function drafts(c: Credentials): Promise<Array<{ id: string; updated: number }>> {
  const records = await transaction<VaultRecord<unknown>[]>('readonly', store => store.getAll());
  return records.filter(r => r.space === c.id).map(({ id, updated }) => ({ id, updated }));
}
export async function removeVault(id: string) { await transaction('readwrite', store => store.delete(id)); }
