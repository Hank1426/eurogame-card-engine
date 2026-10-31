import { z } from 'zod';
import type { CoreState, GameEvent, QueueItem, Session } from '@eurogame/engine-core';
import type { Building, BuildingKind } from './board.js';
import type { ArkAction } from './index.js';

export const arkConfigSchema = z.object({
  map: z.literal('A').default('A'),
  playerCount: z.literal(2).default(2),
  pool: z.literal('first-playable-v1').default('first-playable-v1')
}).strict();
export type ArkConfig = z.infer<typeof arkConfigSchema>;
export const arkCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('begin'), action: z.enum(['animals', 'build', 'cards', 'association', 'sponsors']), spendX: z.number().int().min(0).max(5).default(0) }).strict(),
  z.object({ type: z.literal('take-x'), action: z.enum(['animals', 'build', 'cards', 'association', 'sponsors']) }).strict(),
  z.object({ type: z.literal('build'), kind: z.enum(['enclosure-1', 'enclosure-2', 'enclosure-3', 'enclosure-4', 'enclosure-5', 'kiosk', 'pavilion', 'petting']), q: z.number().int(), r: z.number().int(), rotation: z.number().int().min(0).max(5), flip: z.boolean() }).strict(),
  z.object({ type: z.literal('draw'), source: z.enum(['deck', 'market']), card: z.string().default('') }).strict(),
  z.object({ type: z.literal('snap'), card: z.string() }).strict(),
  z.object({ type: z.literal('animal'), card: z.string(), source: z.enum(['hand', 'market']), building: z.string() }).strict(),
  z.object({ type: z.literal('sponsor'), card: z.string(), source: z.enum(['hand', 'market']) }).strict(),
  z.object({ type: z.literal('income') }).strict(),
  z.object({ type: z.literal('association'), task: z.enum(['reputation', 'partner', 'university', 'project']), target: z.string(), tier: z.number().int().min(0).max(2).default(0), reward: z.string().default('money-12'), rewardFirst: z.boolean().default(false) }).strict(),
  z.object({ type: z.literal('donate') }).strict(),
  z.object({ type: z.literal('finish') }).strict(),
  z.object({ type: z.literal('resolve'), choiceId: z.string(), options: z.array(z.string()).max(20) }).strict()
]);
export type ArkCommand = z.infer<typeof arkCommandSchema>;
export interface ArkPlayer {
  id: string;
  name: string;
  money: number;
  appeal: number;
  conservation: number;
  reputation: number;
  x: number;
  row: ArkAction[];
  upgrades: ArkAction[];
  hand: string[];
  animals: string[];
  sponsors: string[];
  buried: { host: string; card: string }[];
  finals: string[];
  buildings: Building[];
  partners: string[];
  universities: string[];
  workers: number;
  usedWorkers: Record<string, number>;
  projectRewards: string[];
  coveredRewards: string[];
  mapCompleted: boolean;
}
export type ArkEffect =
  | { type: 'gain'; resource: 'money' | 'appeal' | 'conservation' | 'reputation' | 'x'; amount: number }
  | { type: 'draw'; count: number }
  | { type: 'setup' }
  | { type: 'setup-complete' }
  | { type: 'discard'; count: number; reason: string }
  | { type: 'upgrade'; workerOption: boolean }
  | { type: 'set-upgrade'; action: ArkAction }
  | { type: 'worker' }
  | { type: 'clever' }
  | { type: 'move-action'; action: ArkAction }
  | { type: 'sell' | 'pouch'; count: number; host: string }
  | { type: 'remove-hand'; card: string; mode: 'discard' | 'sell' | 'pouch'; host: string }
  | { type: 'hunt' | 'perception' | 'scavenge'; count: number }
  | { type: 'keep-revealed'; card: string }
  | { type: 'discard-revealed' }
  | { type: 'snap'; count: number; refill: boolean; range: boolean }
  | { type: 'take-market'; card: string }
  | { type: 'refill' }
  | { type: 'final-choice' }
  | { type: 'continue' }
  | { type: 'end-turn' }
  | { type: 'break-start' }
  | { type: 'break-income' }
  | { type: 'break-complete' }
  | { type: 'score' }
  | { type: 'offer-free-build'; kind: BuildingKind }
  | { type: 'place-free-build'; command: Extract<ArkCommand, { type: 'build' }> }
  | { type: 'milestone'; point: 5 | 8 };
export interface ArkChoiceOption {
  id: string;
  label: string;
  card: string | null;
  effects: QueueItem<ArkEffect>[];
}
export interface ArkChoice {
  id: string;
  actor: string;
  prompt: string;
  kind: 'normal' | 'setup' | 'final';
  min: number;
  max: number;
  options: ArkChoiceOption[];
}
export interface ArkActionContext {
  action: ArkAction;
  strength: number;
  upgraded: boolean;
  remaining: number;
  played: number;
  built: BuildingKind[];
  tasks: string[];
  donated: boolean;
  after: QueueItem<ArkEffect>[];
}
export interface ArkState extends CoreState {
  stage: 'setup' | 'turn' | 'action' | 'break' | 'scoring' | 'finished';
  activePlayer: string;
  players: ArkPlayer[];
  deck: string[];
  discard: string[];
  revealed: string[];
  market: (string | null)[];
  finalDeck: string[];
  finalDiscard: string[];
  projects: { id: string; blocked: number; claimed: (string | null)[] }[];
  partnerSupply: string[];
  universitySupply: string[];
  donations: number;
  breakProgress: number;
  breaks: number;
  turns: number;
  finalReduced: boolean;
  finalTurns: number | null;
  endingTrigger: string | null;
  context: ArkActionContext | null;
  queue: QueueItem<ArkEffect>[];
  pending: ArkChoice | null;
  choiceSequence: number;
  buildingSequence: number;
  claimedMilestones: string[];
}
export interface ArkView {
  revision: number;
  phase: ArkState['phase'];
  stage: ArkState['stage'];
  activePlayer: string;
  actor: string;
  players: (ArkPlayer & { handCount: number; finalCount: number })[];
  market: (string | null)[];
  deckCount: number;
  discardCount: number;
  projects: ArkState['projects'];
  partnerSupply: string[];
  universitySupply: string[];
  donations: number;
  breakProgress: number;
  breaks: number;
  turns: number;
  finalTurns: number | null;
  context: ArkActionContext | null;
  pending: Omit<ArkChoice, 'options'> & { options: Omit<ArkChoiceOption, 'effects'>[] } | null;
}
export type ArkSession = Session<ArkState, ArkConfig, ArkCommand>;
export type ArkEvent = GameEvent;
