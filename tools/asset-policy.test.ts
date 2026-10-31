import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { assetPolicySchema, auditPublishedImages } from './asset-policy.js';

it('公开图片必须与审核清单的内容哈希一致，代码文件不当成美术图片', () => {
  const original = Buffer.from('<svg><path d="M0 0"/></svg>');
  const hash = createHash('sha256').update(original).digest('hex');
  expect(auditPublishedImages([{ path: 'dist/own.svg', bytes: original }, { path: 'dist/app.js', bytes: Buffer.from('application') }], [hash])).toEqual([]);
  expect(auditPublishedImages([{ path: 'dist/copied-photo.jpg', bytes: Buffer.from('private-art') }], [hash])).toHaveLength(1);
  expect(auditPublishedImages([{ path: 'dist/own.svg', bytes: Buffer.from('<svg/>') }], [hash])).toHaveLength(1);
});
it('许可清单拒绝越出原创资源目录的文件和缺失审核依据', () => {
  expect(() => assetPolicySchema.parse({
    formatVersion: 1, referenceUsage: 'local-reference-only', referenceRoot: 'references/source',
    publicFiles: [{ path: 'references/source/photo.jpg', sha256: '0'.repeat(64), provenance: 'licensed', licenseRef: '' }],
    builtinArt: { provenance: 'original', implementation: 'somewhere.tsx', notice: 'original' }
  })).toThrow();
});
