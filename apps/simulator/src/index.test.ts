import { expect, it } from 'vitest';
import { simulate, createEndgameScenario } from './index.js';

it('两种策略的固定种子整局都能自然结束', () => {
  for (const strategy of ['random', 'heuristic'] as const) {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(simulate(seed, 1500, strategy).status).toBe('finished');
    }
  }
  expect(simulate(42)).toEqual(simulate(42));
  for (const playerCount of [3, 4]) {
    expect(simulate(42, 1500, 'heuristic', playerCount).status).toBe('finished');
  }
});
it('限制步数得到截断状态，终局场景保留一个正常回合', () => {
  expect(simulate(42, 1).status).toBe('truncated');
  expect(createEndgameScenario().state.completedTurns).toBe(11);
});
