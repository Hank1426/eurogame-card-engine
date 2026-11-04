import { z } from 'zod';
import type { Manifest } from '@eurogame/engine-core';
import { gameById } from '../catalog/games.js';
import type { GameSummary, MatchRuntime } from '../catalog/types.js';

export interface MatchInfo {
  id: string; gameId: string; title: string; createdAt: number; updatedAt: number; archived: boolean;
  revision: number; writeVersion: number; manifest: Manifest | null; summary: GameSummary | null;
  mode: 'ai'; seats: { player: string; controller: 'human' | 'ai'; strategy: string | null }[];
  recovery: boolean;
}
const metadataSchema = z.object({ manifest: z.object({ gameId: z.string(), engineVersion: z.string(), rulesVersion: z.string(), contentVersion: z.string() }), seed: z.number().int().nonnegative(), snapshot: z.object({ revision: z.number().int().nonnegative(), phase: z.enum(['playing', 'finished']), players: z.array(z.unknown()).min(2), round: z.number().optional(), roundLimit: z.number().optional(), turns: z.number().optional(), breaks: z.number().optional() }).passthrough(), config: z.object({ map: z.string().optional() }).passthrough() });
export function summarizeLegacy(text: string): { manifest: Manifest; revision: number; summary: GameSummary } {
  const data = metadataSchema.parse(JSON.parse(text));
  gameById(data.manifest.gameId);
  const progress = data.snapshot.round !== undefined ? `第 ${data.snapshot.round} / ${data.snapshot.roundLimit ?? '?'} 轮` : data.snapshot.turns !== undefined ? `第 ${data.snapshot.turns + 1} 回合 · 休息 ${data.snapshot.breaks ?? 0} 次` : '等待恢复对局';
  return { manifest: data.manifest, revision: data.snapshot.revision, summary: { playerCount: data.snapshot.players.length, progress, finished: data.snapshot.phase === 'finished', seed: data.seed, ...(data.config.map ? { map: data.config.map } : {}) } };
}
export function makeMatch(runtime: MatchRuntime, title?: string): MatchInfo {
  const now = Date.now();
  return { id: crypto.randomUUID(), gameId: runtime.gameId, title: title ?? `${gameById(runtime.gameId).name}${runtime.summary.map ? ` · 地图 ${runtime.summary.map}` : ''}`,
    createdAt: now, updatedAt: now, archived: false, revision: runtime.revision, writeVersion: 0,
    manifest: runtime.manifest, summary: runtime.summary, mode: 'ai', recovery: false,
    seats: Array.from({ length: runtime.summary.playerCount }, (_, index) => ({ player: `p${index + 1}`, controller: index === 0 ? 'human' : 'ai', strategy: index === 0 ? null : 'basic-v1' })) };
}
