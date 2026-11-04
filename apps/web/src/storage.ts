import type { MatchRuntime } from './catalog/types.js';
import { gameById } from './catalog/games.js';
import { summarizeLegacy, type MatchInfo } from './matches/model.js';

let database: Promise<IDBDatabase> | undefined;
let writeQueue: Promise<unknown> = Promise.resolve();
function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('eurogame-engine-lab', 2);
    request.onupgradeneeded = () => {
      for (const name of ['saves', 'matches', 'archives', 'settings']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); database = undefined; }; resolve(request.result); };
    request.onerror = () => { database = undefined; reject(new Error('无法打开本地存储，请导出文件保留对局。')); };
    request.onblocked = () => { database = undefined; reject(new Error('旧页面阻塞存储升级，请关闭旧页面后重试。')); };
  });
  return database;
}
function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error('本地存储写入失败。')); transaction.onabort = () => reject(transaction.error ?? new Error('本地存储事务已中断。')); });
}
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = writeQueue.catch(() => undefined).then(operation);
  writeQueue = next;
  return next;
}
export async function listMatches(): Promise<MatchInfo[]> {
  const db = await openDatabase();
  const all = await result(db.transaction('matches', 'readonly').objectStore('matches').getAll()) as MatchInfo[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
export async function readMatch(id: string): Promise<{ info: MatchInfo; archive: string }> {
  const db = await openDatabase();
  const transaction = db.transaction(['matches', 'archives'], 'readonly');
  const [info, archive] = await Promise.all([result(transaction.objectStore('matches').get(id)) as Promise<MatchInfo | undefined>, result(transaction.objectStore('archives').get(id)) as Promise<string | undefined>]);
  if (!info || typeof archive !== 'string') throw new Error('找不到此对局或其存档。');
  return { info, archive };
}
export function createMatch(info: MatchInfo, archive: string): Promise<void> {
  return enqueue(async () => {
    const db = await openDatabase();
    const transaction = db.transaction(['matches', 'archives', 'settings'], 'readwrite');
    const done = completed(transaction);
    transaction.objectStore('matches').add(info, info.id);
    transaction.objectStore('archives').add(archive, info.id);
    transaction.objectStore('settings').put(info.id, `last:${info.gameId}`);
    await done;
  });
}
export function saveMatch(id: string, expectedVersion: number, runtime: MatchRuntime): Promise<MatchInfo> {
  return enqueue(async () => {
    const db = await openDatabase();
    const transaction = db.transaction(['matches', 'archives'], 'readwrite');
    const done = completed(transaction);
    const info = await result(transaction.objectStore('matches').get(id)) as MatchInfo | undefined;
    if (!info || info.writeVersion !== expectedVersion || info.gameId !== runtime.gameId || runtime.revision < info.revision) {
      transaction.abort(); await done.catch(() => undefined);
      throw new Error('此对局已有更新，已停止写入；请重新载入，避免覆盖另一页面。');
    }
    const next: MatchInfo = { ...info, revision: runtime.revision, summary: runtime.summary, manifest: runtime.manifest, recovery: false, writeVersion: info.writeVersion + 1, updatedAt: Date.now() };
    transaction.objectStore('matches').put(next, id);
    transaction.objectStore('archives').put(runtime.archive, id);
    await done;
    return next;
  });
}
export function updateMatch(id: string, changes: { title?: string; archived?: boolean }): Promise<void> {
  return enqueue(async () => {
    if (changes.title !== undefined && (!changes.title.trim() || changes.title.trim().length > 80)) throw new Error('对局名称应为 1–80 个字符。');
    const db = await openDatabase();
    const transaction = db.transaction('matches', 'readwrite');
    const done = completed(transaction);
    const info = await result(transaction.objectStore('matches').get(id)) as MatchInfo | undefined;
    if (!info) { await done; throw new Error('对局不存在。'); }
    transaction.objectStore('matches').put({ ...info, ...changes, ...(changes.title !== undefined ? { title: changes.title.trim() } : {}) }, id);
    await done;
  });
}
export async function lastMatch(gameId: string): Promise<string | null> {
  const db = await openDatabase();
  const id = await result(db.transaction('settings', 'readonly').objectStore('settings').get(`last:${gameId}`));
  return typeof id === 'string' ? id : null;
}
export async function rememberMatch(gameId: string, id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('settings', 'readwrite');
  const done = completed(transaction);
  transaction.objectStore('settings').put(id, `last:${gameId}`);
  await done;
}
export async function migrateLegacy(): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['saves', 'matches', 'archives', 'settings'], 'readwrite');
  const done = completed(transaction);
  const marker = await result(transaction.objectStore('settings').get('legacy-v1-migrated'));
  if (marker) { await done; return; }
  for (const [slot, gameId] of [['current', 'garden-lab'], ['ark-current', 'ark-nova']] as const) {
    const raw = await result(transaction.objectStore('saves').get(slot));
    if (typeof raw !== 'string') continue;
    const now = Date.now();
    const id = `legacy-${slot}`;
    let meta: ReturnType<typeof summarizeLegacy> | null = null;
    try { meta = summarizeLegacy(raw); if (meta.manifest.gameId !== gameId) meta = null; } catch { /* Preserve unreadable files too. */ }
    const info: MatchInfo = { id, gameId, title: `${gameById(gameId).name} · 迁移的原对局`, createdAt: now, updatedAt: now,
      archived: false, mode: 'ai', seats: [], recovery: !meta, manifest: meta?.manifest ?? null,
      summary: meta?.summary ?? null, revision: meta?.revision ?? 0, writeVersion: 0 };
    transaction.objectStore('matches').put(info, id);
    transaction.objectStore('archives').put(raw, id);
    transaction.objectStore('settings').put(id, `last:${gameId}`);
  }
  // Old raw slots are intentionally retained; migration only adds records.
  transaction.objectStore('settings').put(true, 'legacy-v1-migrated');
  await done;
}
