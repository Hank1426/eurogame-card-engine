import { createHash } from 'node:crypto';
import { z } from 'zod';

export const assetPolicySchema = z.object({
  formatVersion: z.literal(1), referenceUsage: z.literal('local-reference-only'),
  referenceRoot: z.string().regex(/^references\/[a-zA-Z0-9_/-]+$/),
  publicFiles: z.array(z.object({
    path: z.string().regex(/^apps\/web\/public\/original\/[\w/.-]+\.(png|jpg|webp|svg|gif|ico)$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), provenance: z.enum(['original', 'licensed']), licenseRef: z.string().min(1)
  }).strict()),
  builtinArt: z.object({ provenance: z.literal('original'), implementation: z.string(), notice: z.string() }).strict()
}).strict();
export function isImageFile(path: string): boolean { return /\.(png|jpe?g|webp|svg|gif|ico|avif)$/i.test(path); }
export function auditPublishedImages(files: { path: string; bytes: Uint8Array }[], allowedHashes: string[]): string[] {
  const permitted = new Set(allowedHashes);
  return files.filter(file => isImageFile(file.path) && !permitted.has(createHash('sha256').update(file.bytes).digest('hex'))).map(file => `未列入公开许可清单：${file.path}`);
}
