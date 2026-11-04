import type { ComponentType, ReactNode } from 'react';
import type { CoreState, Manifest, Session } from '@eurogame/engine-core';

export interface MatchSettings { game: string; mode: 'ai'; playerCount: number; seed: number; map?: string }
export interface GameSummary { playerCount: number; progress: string; finished: boolean; seed: number; map?: string; decision?: 'human' | 'ai' }
export interface PanelProps<S> { session: S; active: boolean; readOnly: boolean; onChange: (session: S) => void; onFork: (session: S) => void }
export interface MatchRuntime {
  gameId: string; manifest: Manifest; revision: number; summary: GameSummary; archive: string;
  render: (props: { active: boolean; readOnly: boolean; onChange: (runtime: MatchRuntime) => void; onFork: (runtime: MatchRuntime) => void }) => ReactNode;
}
export interface GameAdapter { create: (settings: MatchSettings) => MatchRuntime; restore: (archive: string) => MatchRuntime; Rules: ComponentType<{ hasMatch: boolean }> }
export interface GameDescriptor {
  id: string; name: string; category: string; description: string; status: string; symbol: string;
  playerCounts: number[]; brief: string; rulesRoute: string; tableRoute: string;
  art: 'botanical' | 'symbol';
  maps?: { id: string; name: string; description: string }[];
  load: () => Promise<GameAdapter>;
}
export type RuntimeSession = Session<CoreState, unknown, unknown>;
