import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';

export function localReferenceAssets(): Plugin {
  const root = resolve(import.meta.dirname, '../../references/Next-Ark-Nova-Cards/public/img');
  async function manifest(): Promise<Record<string, string>> {
    const entries: Record<string, string> = {};
    for (const folder of ['animals', 'sponsors']) {
      for (const file of await readdir(resolve(root, folder)).catch(() => [] as string[])) {
        const id = file.match(/^[AS](\d{3})_/i)?.[1];
        if (id && /\.(jpg|png|webp)$/i.test(file)) entries[id] = `/__ark_reference__/${folder}/${encodeURIComponent(file)}`;
      }
    }
    return entries;
  }
  const configure: NonNullable<Plugin['configureServer']> = server => {
    server.middlewares.use('/__ark_reference__', async (request, response) => {
      try {
        const path = decodeURIComponent((request.url ?? '').split('?')[0]!);
        if (path === '/manifest.json') {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(await manifest()));
          return;
        }
        const file = resolve(root, `.${path}`);
        const local = relative(root, file);
        if (isAbsolute(local) || local.startsWith('..') || !/^(animals|sponsors)[/\\][^/\\]+\.(jpg|png|webp)$/i.test(local)) {
          response.statusCode = 404; response.end(); return;
        }
        const bytes = await readFile(file);
        response.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'image/jpeg');
        response.setHeader('Cache-Control', 'private, max-age=3600');
        response.end(bytes);
      } catch {
        response.statusCode = 404; response.end();
      }
    });
  };
  return { name: 'local-reference-assets', configureServer: configure, configurePreviewServer: configure as NonNullable<Plugin['configurePreviewServer']> };
}
