import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename, sep } from 'node:path';
import { buildAssetCatalog, imageDimensions, selectCardFiles } from './asset-inventory.js';
import { ASSET_SOURCE, SPRITES, spriteStyle, validateSpriteDefinitions } from './asset-definitions.js';
import { assetCatalogSchema } from './asset-catalog.js';

function png(width: number, height: number): Buffer {
  const data = Buffer.alloc(24);
  data.set([137, 80, 78, 71, 13, 10, 26, 10]);
  data.writeUInt32BE(width, 16); data.writeUInt32BE(height, 20);
  return data;
}
describe('美术资产规格与目录', () => {
  it('所有图集区域有效，项目和图标映射来自同一份定义', () => {
    expect(validateSpriteDefinitions()).toEqual([]);
    expect(Object.keys(SPRITES).filter(id => id.startsWith('project.'))).toHaveLength(32);
    expect(spriteStyle('badge.europe')?.backgroundPosition).toBe('100% 33.33333333333333%');
    expect(spriteStyle('project.132')?.backgroundPosition).toBe('20% 100%');
    expect(spriteStyle('project.133')).toBeNull();
  });
  it('占位图不会覆盖原图，选取顺序不依赖文件系统顺序', () => {
    const files = ['S203_Veterinarian_placeholder.jpg', 'S203_Veterinarian.jpg', 'S204_ScienceMuseum.jpg', '../S205_wrong.jpg'];
    expect(selectCardFiles(files, 'S')).toEqual(selectCardFiles([...files].reverse(), 'S'));
    expect(selectCardFiles(files, 'S')[0]).toEqual({ id: '203', file: 'S203_Veterinarian.jpg', variant: 'original' });
    expect(selectCardFiles(['A401_Cheetah.jpg', 'S203_Veterinarian.jpg'], 'A')).toHaveLength(1);
  });
  it('读取 PNG 和 WebP 规格，拒绝无效的 JPEG 长度', () => {
    expect(imageDimensions(png(640, 480))).toEqual({ width: 640, height: 480 });
    const webp = Buffer.alloc(30);
    webp.write('RIFF', 0); webp.write('WEBP', 8); webp.write('VP8X', 12);
    webp.writeUIntLE(1479, 24, 3); webp.writeUIntLE(2071, 27, 3);
    expect(imageDimensions(webp)).toEqual({ width: 1480, height: 2072 });
    const jpeg = Buffer.from([255, 216, 255, 224, 255, 255, 0, 0, 0, 0, 0, 0]);
    expect(() => imageDimensions(jpeg)).toThrow('长度');
  });
  it('缺少参考目录时返回空目录，客户端可回退到内置图形', async () => {
    const root = join(tmpdir(), 'ark-assets-missing-directory', 'not-created');
    const catalog = await buildAssetCatalog(root);
    expect(catalog.referenceAvailable).toBe(false);
    expect(catalog.files).toEqual([]);
    expect(catalog.issues).toEqual([]);
  });
  it('目录以内容哈希定版本，文件替换后 URL 改变，图集尺寸错配不会悄悄裁切', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ark-assets-test-'));
    if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}`) || !basename(root).startsWith('ark-assets-test-')) throw new Error('清理目录越出测试临时目录。');
    try {
      await mkdir(join(root, 'sponsors'));
      await writeFile(join(root, 'sponsors/S203_Veterinarian.png'), png(300, 200));
      await writeFile(join(root, 'projects.jpg'), png(10, 10));
      const first = await buildAssetCatalog(root);
      expect(first.files[0]).toMatchObject({ id: 'card.203', width: 300, height: 200, variant: 'original' });
      expect(first.issues.some(issue => issue.includes('图集尺寸'))).toBe(true);
      const same = await buildAssetCatalog(root);
      expect(same.revision).toBe(first.revision);
      await writeFile(join(root, 'sponsors/S203_Veterinarian.png'), png(301, 200));
      const changed = await buildAssetCatalog(root);
      expect(changed.files[0]!.src).not.toBe(first.files[0]!.src);
      expect(changed.revision).not.toBe(first.revision);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it('目录拒绝重复 ID、外部加载地址和未知发布范围', () => {
    const file = { id: 'card.401', alias: '401', kind: 'animal', label: 'Cheetah', file: 'animals/A401_Cheetah.jpg', src: '/__ark_reference__/animals/A401_Cheetah.jpg', width: 300, height: 200, bytes: 100, sha256: '0'.repeat(64), usage: 'local-reference-only', variant: 'original' };
    const catalog = { formatVersion: 1, revision: 'sample', referenceAvailable: true, source: ASSET_SOURCE, files: [file], issues: [] };
    expect(assetCatalogSchema.parse(catalog).files).toHaveLength(1);
    expect(() => assetCatalogSchema.parse({ ...catalog, files: [file, file] })).toThrow('重复');
    expect(() => assetCatalogSchema.parse({ ...catalog, files: [{ ...file, src: 'https://example.invalid/photo.jpg' }] })).toThrow();
    expect(() => assetCatalogSchema.parse({ ...catalog, files: [{ ...file, usage: 'public' }] })).toThrow();
  });
});
