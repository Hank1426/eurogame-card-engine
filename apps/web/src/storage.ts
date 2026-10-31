let database: Promise<IDBDatabase> | undefined;
let writeQueue: Promise<void> = Promise.resolve();

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('eurogame-engine-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('saves');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地存储。请导出存档保留对局。'));
    request.onblocked = () => reject(new Error('本地存储被其他页面阻塞，请关闭旧页面。'));
  });
  return database;
}

export async function readSave(slot = 'current'): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('saves', 'readonly').objectStore('saves').get(slot);
    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(new Error('读取本地存档失败。'));
  });
}

export function writeSave(archive: string, slot = 'current'): Promise<void> {
  const operation = writeQueue.catch(() => undefined).then(async () => {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('saves', 'readwrite');
      transaction.objectStore('saves').put(archive, slot);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('自动保存失败，请手动导出。'));
      transaction.onabort = () => reject(new Error('自动保存已中断，请手动导出。'));
    });
  });
  writeQueue = operation;
  return operation;
}
