import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin, ViteDevServer } from 'vite';
import { buildAssetCatalog } from './asset-inventory.js';
import { catalogUrls } from './asset-catalog.js';

export function localReferenceAssets(): Plugin {
  const root = resolve(import.meta.dirname, '../../references/Next-Ark-Nova-Cards/public/img');
  let cached: ReturnType<typeof buildAssetCatalog> | null = null;
  const catalog = () => cached ??= buildAssetCatalog(root);
  const configure = (server: Pick<ViteDevServer, 'middlewares'> & Partial<Pick<ViteDevServer, 'watcher'>>) => {
    if (server.watcher) {
      server.watcher.add(root);
      const invalidate = (path: string) => { if (relative(root, path).startsWith('..') === false) cached = null; };
      server.watcher.on('add', invalidate).on('change', invalidate).on('unlink', invalidate);
    }
    server.middlewares.use('/__ark_reference__', async (request, response) => {
      try {
        const path = decodeURIComponent((request.url ?? '').split('?')[0]!);
        const query = new URL(request.url ?? '', 'http://localhost').searchParams;
        if (path === '/catalog.json' && query.get('refresh') === '1') cached = null;
        const registry = await catalog();
        if (path === '/manifest.json' || path === '/catalog.json') {
          response.setHeader('Content-Type', 'application/json');
          response.setHeader('Cache-Control', 'private, no-cache');
          response.setHeader('ETag', `"${registry.revision}"`);
          if (request.headers['if-none-match'] === `"${registry.revision}"`) { response.statusCode = 304; response.end(); return; }
          response.end(JSON.stringify(path === '/manifest.json' ? catalogUrls(registry) : registry));
          return;
        }
        const local = relative(root, resolve(root, `.${path}`)).replaceAll('\\', '/');
        const entry = registry.files.find(entry => entry.file === local);
        if (isAbsolute(local) || local.startsWith('..') || !entry) {
          response.statusCode = 404; response.end(); return;
        }
        const file = await realpath(resolve(root, local));
        const actual = relative(await realpath(root), file);
        if (isAbsolute(actual) || actual.startsWith('..')) { response.statusCode = 404; response.end(); return; }
        const bytes = await readFile(file);
        if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) { cached = null; response.statusCode = 410; response.end(); return; }
        response.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'image/jpeg');
        const version = query.get('v');
        if (version && version !== entry.sha256.slice(0, 16)) { response.statusCode = 410; response.end(); return; }
        response.setHeader('Cache-Control', version === entry.sha256.slice(0, 16) ? 'private, max-age=31536000, immutable' : 'private, no-cache');
        response.end(bytes);
      } catch {
        response.statusCode = 404; response.end();
      }
    });
  };
  return { name: 'local-reference-assets', configureServer: configure, configurePreviewServer: configure };
}
