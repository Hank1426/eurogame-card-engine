import { z } from 'zod';
import { fingerprint } from '@eurogame/engine-core';
import gardenData from '../../../content/public/garden-lab.json' with { type: 'json' };
import coverageData from '../../../content/ark-nova/coverage.json' with { type: 'json' };

export { arkReferenceSchema, referenceCardName, type ArkReference } from './reference.js';

export const resourceSchema = z.enum(['credits', 'energy', 'points']);
export type Resource = z.infer<typeof resourceSchema>;
export type Effect =
  | { type: 'gain'; resource: Resource; amount: number }
  | { type: 'draw'; count: number }
  | { type: 'registerIncome'; resource: Resource; amount: number }
  | { type: 'sequence'; effects: Effect[] }
  | { type: 'choice'; prompt: string; options: { id: string; label: string; effects: Effect[] }[] };

const amountSchema = z.number().int().min(1).max(100);
export const effectSchema: z.ZodType<Effect> = z.lazy(() => z.discriminatedUnion('type', [
  z.object({ type: z.literal('gain'), resource: resourceSchema, amount: amountSchema }).strict(),
  z.object({ type: z.literal('draw'), count: z.number().int().min(1).max(8) }).strict(),
  z.object({ type: z.literal('registerIncome'), resource: resourceSchema, amount: amountSchema }).strict(),
  z.object({ type: z.literal('sequence'), effects: z.array(effectSchema).min(1).max(16) }).strict(),
  z.object({
    type: z.literal('choice'), prompt: z.string().min(1).max(200),
    options: z.array(z.object({
      id: z.string().regex(/^[a-z0-9-]+$/), label: z.string().min(1).max(200),
      effects: z.array(effectSchema).min(1).max(16)
    }).strict()).min(2).max(6).refine(options => new Set(options.map(option => option.id)).size === options.length, '选择 ID 必须唯一')
  }).strict()
]));

const costSchema = z.object({
  credits: z.number().int().min(0).max(100).default(0),
  energy: z.number().int().min(0).max(100).default(0),
  points: z.number().int().min(0).max(100).default(0)
}).strict();

export const cardSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  family: z.enum(['research', 'habitat', 'infrastructure']),
  cost: costSchema,
  description: z.string().min(1).max(500),
  effects: z.array(effectSchema).min(1).max(16)
}).strict();

export const packSchema = z.object({
  id: z.string().min(1), version: z.string().min(1), title: z.string().min(1),
  provenance: z.literal('original'), copies: z.number().int().min(1).max(4),
  cards: z.array(cardSchema).min(5).max(300)
}).strict().superRefine((pack, context) => {
  if (new Set(pack.cards.map(card => card.id)).size !== pack.cards.length) {
    context.addIssue({ code: 'custom', message: '卡牌 ID 重复。' });
  }
  if (pack.cards.length * pack.copies < 10) {
    context.addIssue({ code: 'custom', message: '牌库不足以完成初始发牌。' });
  }
});

export type Card = z.infer<typeof cardSchema>;
export const gardenPack = packSchema.parse(gardenData);
export const gardenFingerprint = fingerprint(gardenPack);
export const cardById = new Map(gardenPack.cards.map(card => [card.id, card]));
export const instanceIds = gardenPack.cards.flatMap(card => Array.from({ length: gardenPack.copies }, (_, index) => `${card.id}:${index + 1}`));

export function getCard(instanceId: string): Card {
  const card = cardById.get(instanceId.split(':')[0]!);
  if (!card) throw new Error(`未知卡牌：${instanceId}`);
  return card;
}

export const coverageSchema = z.object({
  rulesVersion: z.string(),
  implementedIds: z.record(z.string(), z.array(z.string())).default({}),
  testedCategories: z.array(z.enum(['animal', 'sponsor', 'project', 'base-project', 'endgame'])).default([]),
  status: z.enum(['not-playable', 'experimental', 'complete']),
  targets: z.array(z.object({ category: z.string(), label: z.string(), expected: z.number().int().positive() }).strict()),
  cards: z.array(z.object({
    id: z.string(), category: z.string(), source: z.string(),
    entered: z.boolean(), implemented: z.boolean(), tested: z.boolean(), reviewed: z.boolean()
  }).strict()),
  rules: z.array(z.object({
    id: z.string(), label: z.string(), source: z.string(),
    status: z.enum(['missing', 'implemented', 'tested', 'reviewed']),
    tests: z.array(z.string())
  }).strict())
}).strict();

const parsedCoverage = coverageSchema.parse(coverageData);
export const arkCoverage = {
  ...parsedCoverage,
  cards: [
    ...parsedCoverage.cards,
    ...Object.entries(parsedCoverage.implementedIds).flatMap(([category, ids]) => ids.map(id => ({
      id, category, source: '规则 V2.0 与参考快照 6f67a11；首版限定机制，待逐卡人工复核',
      entered: true, implemented: true, tested: parsedCoverage.testedCategories.includes(category as 'animal' | 'sponsor'), reviewed: false
    })))
  ]
};
