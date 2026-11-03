import { expect, it } from 'vitest';
import { createSession } from '@eurogame/engine-core';
import { arkGame, breakIncome } from './index.js';

it('公开收入包括魅力、已占用建筑、资助、项目与非资金奖励，手牌不计入', () => {
  const player = createSession(arkGame, {}, 42).state.players[0]!;
  player.appeal = 20;
  player.animals = ['501', '502', '503', '504', '505'];
  player.sponsors = ['220', '233', '206', '209', '201'];
  player.projectRewards = ['income-5', 'income-cp', 'snap'];
  player.buildings[1]!.animals = ['501'];
  const before = structuredClone(player);
  const income = breakIncome(player);
  // 20 appeal = 17; occupied enclosure at the starting kiosk = 1;
  // government = 3; five bird icons = 9; activated project = 5.
  expect(income.money).toBe(35);
  expect(income.conservation).toBe(2);
  expect(income.x).toBe(1);
  expect(income.snap).toBe(true);
  expect(income.rangeSnap).toBe(true);
  expect(player).toEqual(before);
});

it('双方公开视图的收入一致，资金预览不依赖隐藏手牌或终局卡', () => {
  const session = createSession(arkGame, {}, 42);
  session.state.players[1]!.appeal = 0;
  session.state.players[1]!.sponsors = ['231'];
  session.state.players[1]!.animals = ['461', '462', '463'];
  const own = arkGame.getPlayerView(session.state, 'p2').players[1]!;
  const publicPlayer = arkGame.getPlayerView(session.state, 'p1').players[1]!;
  expect(publicPlayer.hand).toEqual([]);
  expect(publicPlayer.finals).toEqual([]);
  expect(breakIncome(own)).toEqual(breakIncome(publicPlayer));
  expect(breakIncome(publicPlayer).money).toBe(11);
});
