import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, zooCard, tagsOf, availableWorkers, cardActionTable,
  type ArkSession, type ArkCommand, type ArkPlayer
} from './index.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `rules-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.message}`);
  return outcome.session;
}
function fixture(): ArkSession {
  let session = createSession(arkGame, {}, 42);
  for (let index = 0; index < 2; index += 1) {
    const choice = session.state.pending!;
    session = submit(session, { type: 'resolve', choiceId: choice.id, options: choice.options.slice(0, 4).map(option => option.id) });
  }
  return session;
}
function giveCard(session: ArkSession, player: ArkPlayer, id: string, destination: 'hand' | 'sponsors' | 'animals' = 'hand') {
  session.state.deck = session.state.deck.filter(card => card !== id);
  session.state.discard = session.state.discard.filter(card => card !== id);
  session.state.market = session.state.market.map(card => card === id ? null : card);
  for (const candidate of session.state.players) {
    candidate.hand = candidate.hand.filter(card => card !== id);
    candidate.sponsors = candidate.sponsors.filter(card => card !== id);
    candidate.animals = candidate.animals.filter(card => card !== id);
    candidate.buried = candidate.buried.filter(buried => buried.card !== id);
    candidate.buildings.forEach(building => { building.animals = building.animals.filter(card => card !== id); });
  }
  player[destination].push(id);
  if (destination === 'animals') player.buildings[1]!.animals.push(id);
}
function settleChoices(session: ArkSession): ArkSession {
  let count = 0;
  while (session.state.pending) {
    const actor = arkActor(session.state);
    session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    if (++count > 20) throw new Error('选择未能结束。');
  }
  return session;
}
function reject(session: ArkSession, command: ArkCommand, message: string) {
  const before = exportArchive(session);
  const outcome = applyCommand(arkGame, session, { id: 'invalid', actor: arkActor(session.state), revision: session.state.revision, command });
  expect(outcome).toMatchObject({ ok: false });
  if (!outcome.ok) expect(outcome.error.message).toContain(message);
  expect(exportArchive(session)).toBe(before);
}
describe('阶段二 · 动物、费用和卡牌时序', () => {
  it('先付费用，逐只完成即时效果，行动后再移动槽位与执行机灵', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '405');
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    session = submit(session, { type: 'animal', card: '405', source: 'hand', building: 'initial-enclosure' });
    expect(session.state.players[0]!.money).toBe(17);
    expect(session.state.players[0]!.row.at(-1)).toBe('animals');
    expect(session.state.context?.remaining).toBe(1);
    session = submit(session, { type: 'finish' });
    expect(session.state.pending?.prompt).toContain('机灵');
    expect(session.state.players[0]!.row[0]).toBe('animals');
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: ['cards'] });
    expect(session.state.players[0]!.row.slice(0, 2)).toEqual(['cards', 'animals']);
    expect(session.state.turns).toBe(1);
  });
  it('第一只动物的跳跃资金可用于第二只，但不能预支当前动物收益', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '413');
    giveCard(session, player, '404');
    player.money = 16;
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    player.buildings.push({ id: 'second', kind: 'enclosure-2', cells: [{ q: 0, r: 1 }, { q: 0, r: 2 }], animals: [] });
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    session = submit(session, { type: 'animal', card: '413', source: 'hand', building: 'initial-enclosure' });
    expect(session.state.players[0]!.money).toBe(9);
    expect(session.state.breakProgress).toBe(3);
    expect(session.state.context?.remaining).toBe(1);
    session = submit(session, { type: 'animal', card: '404', source: 'hand', building: 'second' });
    session = settleChoices(session);
    expect(session.state.players[0]!.money).toBe(0);
    expect(session.state.players[0]!.animals).toContain('404');
    expect(session.state.turns).toBe(1);
  });
  it('合作动物园减费与科学条件生效，地形数必须是不同格子', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '468');
    player.universities.push('science');
    player.partners.push('americas');
    player.money = 12;
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    expect(tagsOf(player).science).toBe(2);
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    session = submit(session, { type: 'animal', card: '468', source: 'hand', building: 'initial-enclosure' });
    expect(session.state.players[0]!.money).toBe(0);
    expect(session.state.players[0]!.conservation).toBe(1);
    expect(session.state.players[0]!.reputation).toBe(2);
    expect(session.state.context?.remaining).toBe(1);
  });
  it('动物 II 强度 5 的开场声望可立即扩大本次展示牌访问范围', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    session.state.discard.push(...player.hand.splice(0));
    for (const [id, position] of [['220', 0], ['405', 1]] as const) {
      giveCard(session, player, id);
      player.hand.splice(player.hand.indexOf(id), 1);
      const existing = session.state.market[position];
      if (existing) session.state.discard.push(existing);
      session.state.market[position] = id;
    }
    player.reputation = 2;
    player.upgrades = ['animals'];
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    expect(session.state.players[0]!.reputation).toBe(3);
    session = submit(session, { type: 'animal', card: '405', source: 'market', building: 'initial-enclosure' });
    expect(session.state.players[0]!.money).toBe(15);
    expect(session.state.market[1]).toBeNull();
  });
  it('牌区费用不足和已经占用的饲养区拒绝执行且保持状态', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '405');
    giveCard(session, player, '404');
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    session.state.players[0]!.money = 7;
    reject(session, { type: 'animal', card: '405', source: 'hand', building: 'initial-enclosure' }, '费用不足');
    session.state.players[0]!.money = 25;
    session = submit(session, { type: 'animal', card: '405', source: 'hand', building: 'initial-enclosure' });
    reject(session, { type: 'animal', card: '404', source: 'hand', building: 'initial-enclosure' }, '闲置');
  });
  it('升级卡牌抓取展示牌时保留空位，全部抓弃完成才补牌', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.row = ['animals', 'build', 'sponsors', 'association', 'cards'];
    player.upgrades = ['cards'];
    const initial = [...session.state.market];
    session = submit(session, { type: 'begin', action: 'cards', spendX: 0 });
    session = submit(session, { type: 'draw', source: 'market', card: initial[0]! });
    expect(session.state.market[0]).toBeNull();
    expect(session.state.market[1]).toBe(initial[1]);
    reject(session, { type: 'finish' }, '必须完成');
    for (let index = 0; index < cardActionTable(5, true).draw - 1; index += 1) session = submit(session, { type: 'draw', source: 'deck', card: '' });
    expect(session.state.pending?.prompt).toContain('弃除 1');
    expect(session.state.market[0]).toBeNull();
    session = settleChoices(session);
    expect(session.state.market.slice(0, 5)).toEqual(initial.slice(1));
    expect(session.state.market.filter(Boolean)).toHaveLength(6);
  });
});
describe('阶段二 · 协会、收入和升级', () => {
  it('第二次同类协会任务消耗两名事务员，第三次不能再做', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    player.upgrades = ['association'];
    player.workers = 3;
    player.usedWorkers = { reputation: 1 };
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false });
    expect(availableWorkers(session.state.players[0]!)).toBe(0);
    expect(session.state.players[0]!.usedWorkers.reputation).toBe(3);
    reject(session, { type: 'association', task: 'partner', target: 'africa', tier: 0, reward: 'money-12', rewardFirst: false }, '事务员不足');
  });
  it('声望 5 的升级不会追溯改变正在进行的协会行动', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.reputation = 4;
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false });
    expect(session.state.pending?.prompt).toContain('升级');
    expect(session.state.context?.upgraded).toBe(false);
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: ['association'] });
    expect(session.state.players[0]!.upgrades).toContain('association');
    expect(session.state.context).toBeNull();
    expect(session.state.activePlayer).toBe('p2');
  });
  it('捐赠要求升级、任务先执行、每次最多一次，双人费用为 2/5/7/10/12', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.upgrades = ['association'];
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    reject(session, { type: 'donate' }, '捐赠要求');
    session = submit(session, { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false });
    session = submit(session, { type: 'donate' });
    expect(session.state.players[0]!.money).toBe(23);
    expect(session.state.players[0]!.conservation).toBe(1);
    expect(session.state.donations).toBe(1);
    reject(session, { type: 'donate' }, '每次仅一次');
  });
  it('项目图标、双人封锁与边缘奖励先后顺序可验证', () => {
    for (const rewardFirst of [false, true]) {
      let session = fixture();
      const player = session.state.players[0]!;
      giveCard(session, player, '405', 'animals');
      giveCard(session, player, '239', 'sponsors');
      player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
      session.state.projects[0] = { id: '110', blocked: 0, claimed: [null, null, null] };
      session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
      reject(session, { type: 'association', task: 'project', target: '110', tier: 0, reward: 'income-cp', rewardFirst }, '封锁');
      session = submit(session, { type: 'association', task: 'project', target: '110', tier: 2, reward: 'income-cp', rewardFirst });
      expect(session.state.players[0]!.conservation).toBe(rewardFirst ? 3 : 2);
      expect(session.state.pending?.prompt).toContain('升级');
      session = settleChoices(session);
      expect(session.state.players[0]!.conservation).toBe(3);
      expect(session.state.players[0]!.projectRewards).toContain('income-cp');
      expect(session.state.projects[0]!.claimed[2]).toBe('p1');
    }
  });
  it('免费两格边缘奖励不扣费，并仍执行合法建造与覆盖奖励', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '405', 'animals');
    giveCard(session, player, '239', 'sponsors');
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session.state.projects[0] = { id: '110', blocked: 0, claimed: [null, null, null] };
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, { type: 'association', task: 'project', target: '110', tier: 2, reward: 'free-2', rewardFirst: true });
    expect(session.state.pending?.prompt).toContain('免费建造');
    const selected = session.state.pending!.options[0]!.id;
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: [selected] });
    session = settleChoices(session);
    expect(session.state.players[0]!.buildings).toHaveLength(3);
    expect(session.state.players[0]!.money).toBeGreaterThanOrEqual(25);
  });
  it('动物学家在任何动物园出现对应图标时收入，包括自身图标', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '239');
    player.row = ['animals', 'build', 'cards', 'association', 'sponsors'];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = submit(session, { type: 'sponsor', card: '239', source: 'hand' });
    expect(session.state.players[0]!.money).toBe(28);
    expect(session.state.players[0]!.sponsors).toContain('239');
  });
});
describe('阶段二 · 休息与终局交叉', () => {
  it('休息先处理双方弃牌，再恢复工人、补市场、支付收入与重置进度', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    giveCard(session, player, '220', 'sponsors');
    player.usedWorkers = { reputation: 1 };
    session.state.breakProgress = 8;
    const initialMoney = player.money;
    const originalMarket = [...session.state.market];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    const income = session.state.context!.strength;
    session = submit(session, { type: 'income' });
    expect(session.state.stage).toBe('break');
    expect(session.state.pending?.prompt).toContain('休息手牌上限');
    expect(availableWorkers(session.state.players[0]!)).toBe(0);
    session = settleChoices(session);
    expect(session.state.players[0]!.money).toBe(initialMoney + income + 5 + 3);
    expect(session.state.players.every(candidate => candidate.hand.length <= 3)).toBe(true);
    expect(availableWorkers(session.state.players[0]!)).toBe(1);
    expect(session.state.breakProgress).toBe(0);
    expect(session.state.breaks).toBe(1);
    expect(session.state.discard).toEqual(expect.arrayContaining(originalMarket.slice(0, 2)));
  });
  it('回合结束触发交叉后只有另一位玩家多一个回合', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.appeal = 111; player.conservation = 1;
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'pavilion', q: 0, r: 2, rotation: 0, flip: false });
    expect(session.state.finalTurns).toBe(1);
    expect(session.state.activePlayer).toBe('p2');
    session = submit(session, { type: 'take-x', action: 'cards' });
    session = settleChoices(session);
    expect(session.state.phase).toBe('finished');
    expect(session.state.turns).toBe(2);
    expect(arkGame.getResult(session.state)!.scores[0]!.points).toBeGreaterThanOrEqual(100);
  });
  it('休息收入触发交叉时双方各再行动一次', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.appeal = 111; player.conservation = 1; player.projectRewards = ['income-cp'];
    player.supportedProjects = ['test-fixture'];
    session.state.breakProgress = 8;
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = submit(session, { type: 'income' });
    session = settleChoices(session);
    expect(session.state.finalTurns).toBe(2);
    expect(session.state.activePlayer).toBe('p2');
    session = submit(session, { type: 'take-x', action: 'cards' });
    expect(session.state.finalTurns).toBe(1);
    expect(session.state.activePlayer).toBe('p1');
    session = submit(session, { type: 'take-x', action: 'cards' });
    session = settleChoices(session);
    expect(session.state.phase).toBe('finished');
    expect(session.state.turns).toBe(3);
  });
  it('入池卡牌没有非有限地形数或未知能力', () => {
    expect(zooCard('486').price).toBe(4);
    expect(zooCard('407').water).toBe(2);
    expect(() => zooCard('464')).toThrow('不在已实现');
  });
});
