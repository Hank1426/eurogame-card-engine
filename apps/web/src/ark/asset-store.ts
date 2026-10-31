import { useEffect, useSyncExternalStore } from 'react';
import { assetCatalogSchema, BUILTIN_CATALOG, catalogUrls, type AssetCatalog } from '../../asset-catalog.js';

type AssetStatus = 'loading' | 'ready' | 'failed';
interface AssetSnapshot {
  catalog: AssetCatalog;
  urls: Record<string, string>;
  loading: boolean;
  status: Record<string, AssetStatus>;
  error: string | null;
}
let snapshot: AssetSnapshot = { catalog: BUILTIN_CATALOG, urls: {}, loading: true, status: {}, error: null };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();
const images = new Map<string, Promise<void>>();
function publish(update: Partial<AssetSnapshot>) {
  snapshot = { ...snapshot, ...update };
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function current() { return snapshot; }
export function markAssetFailed(src: string) {
  if (snapshot.status[src] !== 'failed') publish({ status: { ...snapshot.status, [src]: 'failed' } });
}
export function preloadAsset(src: string): Promise<void> {
  if (!src) return Promise.resolve();
  const existing = images.get(src);
  if (existing) return existing;
  const loaded = new Promise<void>(resolve => {
    const image = new window.Image();
    image.decoding = 'async';
    image.onload = () => {
      publish({ status: { ...snapshot.status, [src]: 'ready' } });
      resolve();
    };
    image.onerror = () => { markAssetFailed(src); resolve(); };
    image.src = src;
  });
  images.set(src, loaded);
  return loaded;
}
export function loadArkAssets(refresh = false): Promise<void> {
  if (request && !refresh) return request;
  if (refresh) publish({ loading: true, error: null });
  request = (async () => {
    try {
      const response = await fetch(`/__ark_reference__/catalog.json${refresh ? '?refresh=1' : ''}`, { cache: 'no-cache' });
      if (!response.ok) { publish({ catalog: BUILTIN_CATALOG, urls: {}, loading: false, error: null }); return; }
      const catalog = assetCatalogSchema.parse(await response.json());
      const urls = catalogUrls(catalog);
      publish({ catalog, urls, loading: false, error: null });
      await Promise.all(['projectAtlas', 'badges', 'tiles', 'mapA'].map(alias => preloadAsset(urls[alias] ?? '')));
    } catch {
      publish({ catalog: BUILTIN_CATALOG, urls: {}, loading: false, error: '本地参考资源不可用，已切换内置图形。' });
    }
  })();
  return request;
}
export function useArkAssets(): AssetSnapshot {
  const state = useSyncExternalStore(subscribe, current, current);
  useEffect(() => { void loadArkAssets(); }, []);
  return state;
}
export function useAssetStatus(src: string | undefined): AssetStatus | undefined {
  return useSyncExternalStore(subscribe, () => src ? snapshot.status[src] : undefined, () => undefined);
}
