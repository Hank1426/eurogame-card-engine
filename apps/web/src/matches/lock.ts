export interface MatchLock { writable: boolean; release: () => void }
export async function acquireMatchLock(id: string, waitForRelease = false): Promise<MatchLock> {
  if (!navigator.locks) return { writable: false, release: () => {} };
  return new Promise((resolve, reject) => {
    const options: LockOptions = waitForRelease ? { signal: AbortSignal.timeout(2500) } : { ifAvailable: true };
    void navigator.locks.request(`eurogame-match:${id}`, options, async lock => {
      if (!lock) { resolve({ writable: false, release: () => {} }); return; }
      await new Promise<void>(release => resolve({ writable: true, release }));
    }).catch(error => { if (waitForRelease && (error?.name === 'AbortError' || error?.name === 'TimeoutError')) resolve({ writable: false, release: () => {} }); else reject(error); });
  });
}
