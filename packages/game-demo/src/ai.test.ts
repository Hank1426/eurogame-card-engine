import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import { instanceIds } from '@eurogame/content';
import { demoGame, currentActor, type DemoSession, type DemoCommand } from './index.js';
import { chooseDemoCommand } from './ai.js';

function submit(session: DemoSession, command: DemoCommand): DemoSession {
  const outcome = applyCommand(demoGame, session, {
    id: `ai-test-${session.state.revision}`, actor: currentActor(session.state),
    revision: session.state.revision, command
  });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.session;
}

describe('基础 AI', () => {
  it('2–4 人均可使用同一策略自然结束且重放一致', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 0; seed < 20; seed += 1) {
        let session = createSession(demoGame, { playerCount }, seed);
        for (let decisionCount = 0; decisionCount < 150 && session.state.phase !== 'finished'; decisionCount += 1) {
          const actor = currentActor(session.state);
          const view = demoGame.getPlayerView(session.state, actor);
          const decision = demoGame.getDecision(session.state, actor)!;
          const before = exportArchive(session);
          const command = chooseDemoCommand(view, decision);
          expect(chooseDemoCommand(view, decision)).toEqual(command);
          expect(exportArchive(session)).toBe(before);
          session = submit(session, command);
        }
        expect(session.state.phase).toBe('finished');
        expect(session.state.completedTurns).toBe(6 * playerCount);
        expect(importArchive(demoGame, exportArchive(session))).toEqual(session);
      }
    }
  });

  it('连续与嵌套选择自动处理，费用只支付一次', () => {
    for (const card of ['seed-library:1', 'citizen-science:1']) {
      const remaining = instanceIds.filter(id => id !== card);
      let session = createSession(demoGame, { debug: true, deckOrder: [...remaining.slice(0, 3), card, ...remaining.slice(3)] }, 42);
      session = submit(session, { type: 'work' });
      session = submit(session, { type: 'play', instanceId: card, source: 'hand' });
      if (card.startsWith('citizen')) {
        session = submit(session, { type: 'choose', choiceId: session.state.resolution.pending!.id, optionId: 'survey' });
      }
      const credits = session.state.players[1]!.resources.credits;
      let count = 0;
      while (session.state.resolution.pending) {
        session = importArchive(demoGame, exportArchive(session));
        const decision = demoGame.getDecision(session.state, 'p2')!;
        session = submit(session, chooseDemoCommand(demoGame.getPlayerView(session.state, 'p2'), decision));
        if (++count > 5) throw new Error('选择没有结束。');
      }
      expect(session.state.completedTurns).toBe(2);
      expect(session.state.players[1]!.resources.credits).toBeGreaterThanOrEqual(credits);
    }
  });

  it('不读取其他玩家手牌、牌库顺序或引擎随机数', () => {
    const first = createSession(demoGame, {}, 42);
    const actor = currentActor(first.state);
    const second = structuredClone(first);
    const swapped = second.state.players[1]!.hand[0]!;
    second.state.players[1]!.hand[0] = second.state.deck[0]!;
    second.state.deck[0] = swapped;
    second.state.rng = 99;
    expect(demoGame.getPlayerView(second.state, actor)).toEqual(demoGame.getPlayerView(first.state, actor));
    expect(chooseDemoCommand(demoGame.getPlayerView(second.state, actor), demoGame.getDecision(second.state, actor)!))
      .toEqual(chooseDemoCommand(demoGame.getPlayerView(first.state, actor), demoGame.getDecision(first.state, actor)!));
    expect(() => chooseDemoCommand(demoGame.getPlayerView(first.state, 'p2'), demoGame.getDecision(first.state, actor)!)).toThrow('自己座位');
  });
});
