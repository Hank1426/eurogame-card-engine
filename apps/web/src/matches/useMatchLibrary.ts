import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchRuntime } from '../catalog/types.js';
import { restoreGame } from '../catalog/games.js';
import { createMatch, listMatches, migrateLegacy, readMatch, rememberMatch, saveMatch, updateMatch } from '../storage.js';
import { makeMatch, type MatchInfo } from './model.js';
import { acquireMatchLock, type MatchLock } from './lock.js';

export interface OpenMatch { info: MatchInfo; runtime: MatchRuntime; readOnly: boolean }
export function useMatchLibrary() {
  const [matches, setMatches] = useState<MatchInfo[]>([]);
  const [opened, setOpened] = useState<OpenMatch | null>(null);
  const current = useRef<OpenMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('准备好开始新对局');
  const epoch = useRef(0);
  const lock = useRef<MatchLock | null>(null);
  const versions = useRef(new Map<string, number>());
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const alive = useRef(true);
  const refresh = useCallback(async () => { const records = await listMatches(); if (alive.current) setMatches(records); }, []);
  const fail = useCallback((failure: unknown) => { if (alive.current) setError(failure instanceof Error ? failure.message : '操作失败。'); }, []);
  useEffect(() => {
    alive.current = true;
    void migrateLegacy().then(refresh).catch(fail).finally(() => { if (alive.current) setLoading(false); });
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('eurogame-match-library');
    if (channel) channel.onmessage = () => { void refresh().catch(fail); };
    const leaving = () => {
      lock.current?.release(); lock.current = null;
      if (current.current) {
        const frozen = { ...current.current, readOnly: true };
        current.current = frozen; setOpened(frozen);
      }
    };
    window.addEventListener('pagehide', leaving);
    return () => { alive.current = false; epoch.current += 1; lock.current?.release(); lock.current = null; window.removeEventListener('pagehide', leaving); channel?.close(); };
  }, [refresh, fail]);
  const announce = () => { const channel = new BroadcastChannel('eurogame-match-library'); channel.postMessage('changed'); channel.close(); };
  const open = useCallback(async (id: string, force = false) => {
    if (current.current?.info.id === id && !force) return;
    const ticket = ++epoch.current;
    setBusy(true); setError('');
    let acquired: MatchLock | null = null;
    try {
      // Let saves from the departing match finish before reading a stored revision.
      await writes.current.catch(() => undefined);
      lock.current?.release(); lock.current = null;
      const held = await acquireMatchLock(id, force);
      acquired = held;
      if (!alive.current || ticket !== epoch.current) { held.release(); return; }
      const record = await readMatch(id);
      const runtime = await restoreGame(record.archive);
      if (!alive.current || ticket !== epoch.current) { held.release(); return; }
      await rememberMatch(record.info.gameId, id);
      if (!alive.current || ticket !== epoch.current) { held.release(); return; }
      lock.current = held;
      versions.current.set(id, record.info.writeVersion);
      const next = { info: record.info, runtime, readOnly: !held.writable };
      current.current = next; setOpened(next);
      setStatus(held.writable ? '已自动保存在此浏览器' : '只读：此对局正在另一页面操作');
    } catch (failure) {
      acquired?.release();
      if (current.current && ticket === epoch.current) {
        const frozen = { ...current.current, readOnly: true };
        current.current = frozen; setOpened(frozen);
      }
      fail(failure);
    }
    finally { if (alive.current && ticket === epoch.current) setBusy(false); }
  }, [fail]);
  const create = useCallback(async (runtime: MatchRuntime, title?: string) => {
    const ticket = ++epoch.current;
    setBusy(true); setError('');
    try {
      const info = makeMatch(runtime, title);
      await createMatch(info, runtime.archive);
      await writes.current.catch(() => undefined);
      const held = await acquireMatchLock(info.id);
      if (!alive.current || ticket !== epoch.current) { held.release(); return null; }
      lock.current?.release(); lock.current = held;
      const next = { info, runtime, readOnly: !held.writable };
      versions.current.set(info.id, 0);
      current.current = next; setOpened(next); setStatus('已自动保存在此浏览器');
      await refresh(); announce();
      return info.id;
    } catch (failure) { fail(failure); return null; }
    finally { if (alive.current && ticket === epoch.current) setBusy(false); }
  }, [refresh, fail]);
  const change = useCallback((next: MatchRuntime, expected: MatchRuntime) => {
    const selected = current.current;
    if (!selected || selected.readOnly || selected.runtime !== expected || next.gameId !== selected.info.gameId) return;
    const id = selected.info.id;
    const updated = { ...selected, runtime: next };
    current.current = updated; setOpened(updated); setStatus('正在保存');
    writes.current = writes.current.catch(() => undefined).then(async () => {
      const saved = await saveMatch(id, versions.current.get(id)!, next);
      versions.current.set(id, saved.writeVersion);
      if (alive.current && current.current?.info.id === id) {
        const latest = { ...current.current, info: saved };
        current.current = latest; setOpened(latest); setStatus('已自动保存在此浏览器');
      }
      await refresh(); announce();
    }).catch(failure => {
      if (alive.current && current.current?.info.id === id) {
        const frozen = { ...current.current, readOnly: true };
        current.current = frozen; setOpened(frozen); setStatus('保存失败，当前进度可导出');
      }
      fail(failure);
    });
  }, [refresh, fail]);
  const edit = useCallback(async (id: string, changes: { title?: string; archived?: boolean }) => {
    try {
      await updateMatch(id, changes);
      if (current.current?.info.id === id) {
        const next = { ...current.current, info: { ...current.current.info, ...changes } };
        current.current = next; setOpened(next);
      }
      await refresh(); announce(); return true;
    } catch (failure) { fail(failure); return false; }
  }, [refresh, fail]);
  return { matches, opened, loading, busy, error, setError, status, refresh, open, create, change, edit };
}
