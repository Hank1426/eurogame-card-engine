import { createSession, importArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, type ArkSession } from '@eurogame/game-ark-nova';
import { ArkTable } from '../ark/ArkTable.js';
import { ArkRules } from '../ark/ArkRules.js';
import { gameRuntime } from '../catalog/runtime.js';
import type { GameAdapter, PanelProps } from '../catalog/types.js';

function Panel({ session, active, readOnly, onChange }: PanelProps<ArkSession>) {
  return <ArkTable session={session} active={active} readOnly={readOnly} onSessionChange={next => {
    const resolved = typeof next === 'function' ? next(session) : next;
    if (resolved && !readOnly && active) onChange(resolved);
  }} />;
}
const runtime = (session: ArkSession) => gameRuntime(session, Panel, session => ({
  playerCount: session.state.players.length, progress: `第 ${session.state.turns + 1} 回合 · 休息 ${session.state.breaks} 次`,
  finished: session.state.phase === 'finished', seed: session.seed, map: session.config.map, decision: arkActor(session.state) === 'p1' ? 'human' : 'ai'
}));
export const arkAdapter: GameAdapter = {
  create: settings => runtime(createSession(arkGame, { playerCount: settings.playerCount, map: settings.map ?? 'A' }, settings.seed)),
  restore: text => runtime(importArchive(arkGame, text)), Rules: ArkRules
};
