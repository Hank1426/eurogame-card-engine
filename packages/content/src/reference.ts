import { z } from 'zod';

export const arkReferenceSchema = z.object({
  formatVersion: z.literal(1),
  source: z.object({
    repository: z.literal('https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards'),
    commit: z.string().min(1),
    license: z.string().min(1),
    files: z.array(z.object({ path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict())
  }).strict(),
  cards: z.array(z.object({
    id: z.string().min(1), name: z.string().min(1),
    category: z.enum(['animal', 'sponsor', 'project', 'base-project', 'endgame']),
    raw: z.record(z.string(), z.unknown()),
    implementation: z.literal('unimplemented')
  }).strict()).max(500),
  locales: z.record(z.string(), z.unknown())
}).strict().superRefine((pack, context) => {
  if (new Set(pack.cards.map(card => card.id)).size !== pack.cards.length) context.addIssue({ code: 'custom', message: '参考卡牌 ID 重复。' });
});

export type ArkReference = z.infer<typeof arkReferenceSchema>;

export function referenceCardName(pack: ArkReference, card: ArkReference['cards'][number]): string {
  const locale = pack.locales['zh-CN'];
  if (locale && typeof locale === 'object' && !Array.isArray(locale)) {
    const name = (locale as Record<string, unknown>)[card.name];
    if (typeof name === 'string' && name.length) return name;
  }
  return card.name;
}
