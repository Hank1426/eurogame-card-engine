import { expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand } from '@eurogame/game-ark-nova';
import { placementKey, placementOptions, recommendedPlacements } from './placement-model.js';

it('对称旋转的同一块区域匹配同一放置目标，不依赖枚举朝向', () => {
  expect(placementKey({ type: 'build', kind: 'enclosure-2', q: 0, r: 2, rotation: 0, flip: false }))
    .toBe(placementKey({ type: 'build', kind: 'enclosure-2', q: 0, r: 3, rotation: 3, flip: false }));
});
it('免费建筑只向决策者公开合法参数，查看和推荐不修改存档', () => {
  let session = createSession(arkGame, {}, 0);
  for (let count = 0; count < 1500 && session.state.phase !== 'finished'; count += 1) {
    const actor = arkActor(session.state);
    const own = arkGame.getPlayerView(session.state, actor);
    const options = placementOptions(own.pending);
    if (options.length) {
      const before = exportArchive(session);
      expect(recommendedPlacements(options).length).toBeLessThanOrEqual(3);
      expect(options[0]).not.toHaveProperty('effects');
      expect(options[0]!.placement.type).toBe('build');
      const other = arkGame.getPlayerView(session.state, actor === 'p1' ? 'p2' : 'p1');
      expect(other.pending!.options).toEqual([]);
      expect(exportArchive(session)).toBe(before);
      return;
    }
    const outcome = applyCommand(arkGame, session, { id: `placement-test-${count}`, actor, revision: session.state.revision, command: chooseArkCommand(own, arkGame.getDecision(session.state, actor)!) });
    if (!outcome.ok) throw new Error(outcome.error.message);
    session = outcome.session;
  }
  throw new Error('没有找到正常对局的免费建筑选择。');
});
