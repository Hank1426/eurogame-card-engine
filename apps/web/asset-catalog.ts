import { z } from 'zod';
import { ASSET_SOURCE } from './asset-definitions.js';

export const assetFileSchema = z.object({
  id: z.string(), alias: z.string(), kind: z.enum(['animal', 'sponsor', 'atlas']),
  label: z.string(), file: z.string().regex(/^[\w/ .()'-]+\.(jpg|png|webp)$/i),
  src: z.string().regex(/^\/__ark_reference__\/[^?#]+(?:\?v=[a-f0-9]+)?$/),
  width: z.number().int().positive().max(20_000), height: z.number().int().positive().max(20_000),
  bytes: z.number().int().positive().max(100_000_000), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  usage: z.literal('local-reference-only'), variant: z.enum(['original', 'placeholder'])
}).strict();
export const assetCatalogSchema = z.object({
  formatVersion: z.literal(1), revision: z.string(), referenceAvailable: z.boolean(),
  source: z.object({ repository: z.string(), usage: z.literal('local-reference-only'), license: z.string(), notice: z.string() }).strict(),
  files: z.array(assetFileSchema).max(1500), issues: z.array(z.string()).max(2000)
}).strict().superRefine((catalog, context) => {
  if (new Set(catalog.files.map(file => file.id)).size !== catalog.files.length || new Set(catalog.files.map(file => file.alias)).size !== catalog.files.length) context.addIssue({ code: 'custom', message: '资产 ID 或别名重复。' });
});
export type AssetFile = z.infer<typeof assetFileSchema>;
export type AssetCatalog = z.infer<typeof assetCatalogSchema>;
export const BUILTIN_CATALOG: AssetCatalog = {
  formatVersion: 1, revision: 'builtin-1', referenceAvailable: false, source: ASSET_SOURCE,
  files: [], issues: []
};
export function catalogUrls(catalog: AssetCatalog): Record<string, string> {
  return Object.fromEntries(catalog.files.map(file => [file.alias, file.src]));
}
