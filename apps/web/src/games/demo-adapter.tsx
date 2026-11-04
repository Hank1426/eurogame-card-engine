import { createSession, importArchive } from '@eurogame/engine-core';
import { demoGame, currentActor, type DemoSession } from '@eurogame/game-demo';
import { DemoPanel } from './DemoPanel.js';
import { RulesPage } from '../RulesPage.js';
import { gameRuntime } from '../catalog/runtime.js';
import type { GameAdapter } from '../catalog/types.js';

const runtime = (session: DemoSession) => gameRuntime(session, DemoPanel, session => ({
  playerCount: session.state.players.length, progress: `第 ${session.state.round} / ${session.state.roundLimit} 轮`,
  finished: session.state.phase === 'finished', seed: session.seed, decision: currentActor(session.state) === 'p1' ? 'human' : 'ai'
}));
export const demoAdapter: GameAdapter = {
  create: settings => runtime(createSession(demoGame, { playerCount: settings.playerCount, debug: false }, settings.seed)),
  restore: text => runtime(importArchive(demoGame, text)), Rules: RulesPage
};
