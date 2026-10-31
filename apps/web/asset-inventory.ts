import { access, readdir, readFile, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { ATLASES, ASSET_SOURCE, validateSpriteDefinitions } from './asset-definitions.js';
import { assetCatalogSchema, assetFileSchema, type AssetFile, type AssetCatalog } from './asset-catalog.js';

export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const data = Buffer.from(bytes);
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    const type = data.toString('ascii', 12, 16);
    if (type === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
    if (type === 'VP8 ' && data[23] === 157 && data[24] === 1 && data[25] === 42) return { width: data.readUInt16LE(26) & 16383, height: data.readUInt16LE(28) & 16383 };
    if (type === 'VP8L' && data[20] === 47) {
      const bits = data.readUInt32LE(21);
      return { width: (bits & 16383) + 1, height: ((bits >>> 14) & 16383) + 1 };
    }
  }
  if (data[0] === 255 && data[1] === 216) {
    let offset = 2;
    while (offset + 8 < data.length) {
      if (data[offset] !== 255) throw new Error('JPEG 标记无效。');
      while (data[offset] === 255) offset += 1;
      const marker = data[offset++]!;
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) throw new Error('JPEG 长度无效。');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
      offset += length;
    }
  }
  throw new Error('无法识别图片尺寸。');
}
export function selectCardFiles(files: string[], prefix: 'A' | 'S'): { id: string; file: string; variant: 'original' | 'placeholder' }[] {
  const ranked = [...files].filter(file => new RegExp(`^${prefix}\\d{3}_[^/\\\\]+\\.(jpg|png|webp)$`, 'i').test(file))
    .sort((left, right) => Number(/placeholder/i.test(left)) - Number(/placeholder/i.test(right)) || left.localeCompare(right, 'en'));
  const chosen = new Map<string, { id: string; file: string; variant: 'original' | 'placeholder' }>();
  for (const file of ranked) {
    const id = file.slice(1, 4);
    if (!chosen.has(id)) chosen.set(id, { id, file, variant: /placeholder/i.test(file) ? 'placeholder' : 'original' });
  }
  return [...chosen.values()].sort((left, right) => left.id.localeCompare(right.id));
}
export async function buildAssetCatalog(root: string): Promise<AssetCatalog> {
  const issues = validateSpriteDefinitions();
  const available = await access(root).then(() => true).catch(() => false);
  const candidates: { id: string; alias: string; kind: AssetFile['kind']; label: string; file: string; variant: AssetFile['variant'] }[] = ATLASES.map(atlas => ({
    id: atlas.id, alias: atlas.alias, kind: 'atlas', label: atlas.label, file: atlas.file, variant: 'original'
  }));
  for (const [folder, prefix, kind] of [['animals', 'A', 'animal'], ['sponsors', 'S', 'sponsor']] as const) {
    const files = await readdir(resolve(root, folder)).catch(() => [] as string[]);
    candidates.push(...selectCardFiles(files, prefix).map(file => ({
      id: `card.${file.id}`, alias: file.id, kind, label: file.file.replace(/\.[^.]+$/, '').slice(5).replaceAll('_', ' '),
      file: `${folder}/${file.file}`, variant: file.variant
    })));
  }
  const entries: AssetFile[] = [];
  if (available) for (let index = 0; index < candidates.length; index += 8) {
    const batch = await Promise.all(candidates.slice(index, index + 8).map(async candidate => {
      try {
        const absolute = await realpath(resolve(root, candidate.file));
        const local = relative(await realpath(root), absolute);
        if (isAbsolute(local) || local.startsWith('..')) throw new Error('资产路径越出参考目录。');
        const bytes = await readFile(absolute);
        const size = imageDimensions(bytes);
        const expected = ATLASES.find(atlas => atlas.id === candidate.id);
        if (expected && (size.width !== expected.width || size.height !== expected.height)) throw new Error(`图集尺寸应为 ${expected.width}×${expected.height}，实际为 ${size.width}×${size.height}。`);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const src = `/__ark_reference__/${candidate.file.split('/').map(encodeURIComponent).join('/')}?v=${sha256.slice(0, 16)}`;
        return assetFileSchema.parse({ ...candidate, ...size, src, bytes: bytes.length, sha256, usage: 'local-reference-only' });
      } catch (error) {
        issues.push(`${candidate.id}: ${error instanceof Error ? error.message : '读取失败'}`);
        return null;
      }
    }));
    entries.push(...batch.filter((entry): entry is AssetFile => entry !== null));
  }
  const files = entries.sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const revision = createHash('sha256').update(JSON.stringify(files.map(file => [file.id, file.sha256]))).digest('hex').slice(0, 20);
  return assetCatalogSchema.parse({ formatVersion: 1, revision, referenceAvailable: available, source: ASSET_SOURCE, files, issues });
}
