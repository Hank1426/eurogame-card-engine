import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, canFlock, housingError, buildingUsedSpace, zooCard,
  buildCommands, buildingCells, type ArkCommand, type ArkSession
} from './index.js';
import { ZOO_CARDS, UNIQUE_BUILDINGS, uniqueKind, requirementError, projectById, mapCells } from './index.js';
import { uniqueCommands, tagsOf } from './rules.js';
import { connectedSpaces, newSponsorFinalPoints } from './sponsor-metrics.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `library-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.message}`);
  return outcome.session;
}
function fixture(): ArkSession {
  let session = createSession(arkGame, {}, 42);
  while (session.state.pending) {
    const pending = session.state.pending;
    session = submit(session, { type: 'resolve', choiceId: pending.id, options: pending.options.slice(0, pending.min).map(option => option.id) });
  }
  return session;
}
function give(session: ArkSession, id: string, zone: 'hand' | 'animals' | 'sponsors' = 'hand', player = session.state.players[0]!) {
  session.state.deck = session.state.deck.filter(card => card !== id);
  session.state.discard = session.state.discard.filter(card => card !== id);
  session.state.market = session.state.market.map(card => card === id ? null : card);
  for (const candidate of session.state.players) {
    for (const existing of ['hand', 'animals', 'sponsors'] as const) candidate[existing] = candidate[existing].filter(card => card !== id);
    candidate.buried = candidate.buried.filter(card => card.card !== id);
    for (const building of candidate.buildings) building.animals = building.animals.filter(card => card !== id);
  }
  player[zone].push(id);
}
function resolve(session: ArkSession, ids: string[]): ArkSession { return submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: ids }); }
function settle(session: ArkSession): ArkSession {
  for (let count = 0; session.state.pending; count += 1) {
    if (count > 100) throw new Error('选择未结束。');
    const actor = arkActor(session.state);
    session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  }
  return session;
}
function prepareAnimal(id: string): ArkSession {
  const session = fixture();
  const player = session.state.players[0]!;
  give(session, id);
  player.money = 200;
  player.upgrades = ['animals', 'cards', 'build', 'association', 'sponsors'];
  player.partners = ['africa', 'asia', 'australia', 'americas'];
  player.universities = ['science', 'reputation'];
  player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
  for (const existing of ['455', '460', '465']) if (existing !== id) give(session, existing, 'animals');
  const commands = buildCommands(session.state, player, 5, true, [], Infinity);
  const command = commands.find(command => command.kind === 'enclosure-5' && !housingError({ id: 'animal-home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] }, id))!;
  if (!command) throw new Error(`动物 ${id} 没有合法安置位置。`);
  player.buildings.push({ id: 'animal-home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] });
  return session;
}
function prepareSponsor(id: string): ArkSession {
  const session = fixture();
  const player = session.state.players[0]!;
  player.money = 200; player.reputation = 6; player.x = 5;
  player.upgrades = ['animals', 'cards', 'build', 'association', 'sponsors'];
  player.universities = ['science', 'reputation'];
  player.partners = ['asia', 'africa'];
  player.row = ['animals', 'cards', 'build', 'association', 'sponsors'];
  for (const existing of ['223', '414', '455', '460', '465', '486', '495', '436']) if (existing !== id) give(session, existing, existing === '223' ? 'sponsors' : 'animals');
  give(session, id);
  return session;
}
function play(session: ArkSession, id: string, building = 'animal-home'): ArkSession {
  session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
  return submit(session, { type: 'animal', card: id, source: 'hand', building });
}
describe('基础牌库 · 群居与终局目标', () => {
  it.each(ZOO_CARDS.filter(card => card.kind === 'animal').map(card => card.id))('动物 %s 按卡面检查支付并完成真实能力结算', id => {
    const initial = fixture();
    const player = initial.state.players[0]!;
    give(initial, id);
    for (const prerequisite of ['401', '402', '406', '436', '433', '452', '455', '459', '460', '465', '469', '471', '472', '494', '495', '496', '489', '448', '486', '414', '413']) if (prerequisite !== id) give(initial, prerequisite, 'animals');
    player.money = 200;
    player.upgrades = ['animals', 'cards', 'build', 'association', 'sponsors'];
    player.partners = ['africa', 'asia', 'australia', 'americas', 'europe'];
    player.universities = ['science', 'reputation'];
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    const commands = buildCommands(initial.state, player, 5, true, [], Infinity);
    const command = commands.find(command => (zooCard(id).tags.includes('pet') ? command.kind === 'petting' : command.kind === 'enclosure-5') &&
      !housingError({ id: 'animal-home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] }, id))!;
    expect(command, `卡牌 ${id} 的合法饲养区`).toBeDefined();
    player.buildings.push({ id: 'animal-home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] });
    let session = play(initial, id);
    session = settle(session);
    expect(session.state.players[0]!.animals).toContain(id);
    expect(session.state.players[0]!.money).toBeLessThan(200);
    arkGame.assertInvariants(session.state);
  });
  it.each(['429', '438', '439', '442', '443', '447'])('%s 可共享已有食草动物而不占用新饲养区', id => {
    const initial = prepareAnimal(id);
    give(initial, '436', 'animals');
    give(initial, '401', 'animals');
    give(initial, '448', 'animals');
    const player = initial.state.players[0]!;
    player.buildings[1]!.animals = ['436']; player.buildings[1]!.occupancy = 1;
    expect(canFlock(player, id)).toBe(true);
    let session = play(initial, id, 'flock');
    session = settle(session);
    expect(session.state.players[0]!.animals).toContain(id);
    expect(buildingUsedSpace(session.state.players[0]!.buildings.find(building => building.id === 'animal-home')!)).toBe(0);
  });
  it('没有合适的食草动物不能空放群居，选择标准区仍正常翻面', () => {
    let session = prepareAnimal('438');
    expect(canFlock(session.state.players[0]!, '438')).toBe(false);
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    const before = exportArchive(session);
    const outcome = applyCommand(arkGame, session, { id: 'invalid-flock', actor: 'p1', revision: session.state.revision, command: { type: 'animal', card: '438', source: 'hand', building: 'flock' } });
    expect(outcome.ok).toBe(false);
    expect(exportArchive(session)).toBe(before);
    session = submit(session, { type: 'animal', card: '438', source: 'hand', building: 'animal-home' });
    expect(buildingUsedSpace(session.state.players[0]!.buildings.find(building => building.id === 'animal-home')!)).toBe(1);
  });
  it.each(['426', '431'])('%s 坚韧添加一张可共同计分的终局卡', id => {
    let session = play(prepareAnimal(id), id);
    expect(session.state.pending?.prompt).toContain('坚韧');
    expect(session.state.finalRevealed).toHaveLength(2);
    const chosen = session.state.pending!.options[0]!.id;
    session = resolve(session, [chosen]);
    expect(session.state.players[0]!.finals).toHaveLength(3);
    expect(session.state.players[0]!.finals).toContain(chosen);
    expect(session.state.finalRevealed).toEqual([]);
    expect(session.state.finalDiscard).toHaveLength(1);
  });
  it('达到十保护时只弃一张目标，坚韧的额外目标保留', () => {
    let session = play(prepareAnimal('426'), '426');
    session = resolve(session, [session.state.pending!.options[0]!.id]);
    session = submit(session, { type: 'finish' });
    session.state.players[1]!.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session.state.players[1]!.upgrades.push('association');
    session.state.players[1]!.conservation = 9;
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false });
    session = submit(session, { type: 'donate' });
    while (session.state.pending && session.state.pending.actor !== 'p1') session = resolve(session, [session.state.pending.options[0]!.id]);
    expect(session.state.pending?.kind).toBe('final');
    const discard = session.state.players[0]!.finals[0]!;
    session = resolve(session, [discard]);
    expect(session.state.players[0]!.finals).toHaveLength(2);
    expect(session.state.players[0]!.finals).not.toContain(discard);
    expect(session.state.finalDeck).toContain(discard);
  });
});

describe('基础牌库 · 基础项目入手与免费鸟禽馆', () => {
  it.each(['427', '432', '451'])('%s 获得未入场基础项目并可通过协会打出', id => {
    let session = play(prepareAnimal(id), id);
    while (session.state.pending && !/主张|支配/.test(session.state.pending.prompt)) session = resolve(session, session.state.pending.options.slice(0, session.state.pending.min).map(option => option.id));
    if (session.state.pending) {
      expect(session.state.pending.prompt).toMatch(/主张|支配/);
      const project = session.state.pending.options[0]!.id;
      session = resolve(session, [project]);
      expect(session.state.players[0]!.hand).toContain(project);
      expect(session.state.baseReserve).not.toContain(project);
      expect(zooCard(project).kind).toBe('project');
    } else expect(session.state.projects.some(project => project.id === '108')).toBe(true);
    arkGame.assertInvariants(session.state);
  });
  it('开屏允许未升级建造免费鸟禽馆，但仍禁止覆盖建造 II 格', () => {
    let session = prepareAnimal('514');
    give(session, '448', 'animals');
    session.state.players[0]!.upgrades = ['animals', 'cards'];
    session = play(session, '514');
    expect(session.state.pending?.prompt).toContain('免费建造鸟禽馆');
    const player = session.state.players[0]!;
    const positions = arkGame.getPlayerView(session.state, 'p1').pending!.options.map(option => option.placement).filter(Boolean);
    expect(positions.length).toBeGreaterThan(0);
    const upgraded = new Set(['7,2', '8,1']);
    for (const position of positions) expect(buildingCells(position!.kind, position!, position!.rotation, position!.flip).some(cell => upgraded.has(`${cell.q},${cell.r}`))).toBe(false);
    const money = player.money;
    session = resolve(session, [session.state.pending!.options[0]!.id]);
    session = settle(session);
    expect(session.state.players[0]!.buildings.some(building => building.kind === 'aviary')).toBe(true);
    expect(session.state.players[0]!.money).toBeGreaterThanOrEqual(money);
  });
});

describe('基础牌库 · 同回合额外行动', () => {
  it.each([['409', 'association'], ['430', 'sponsors'], ['453', 'cards'], ['515', 'build']] as const)('%s 的额外 %s 行动在动物归位后执行', (id, action) => {
    let session = play(prepareAnimal(id), id);
    expect(session.state.pending).toBeNull();
    session = submit(session, { type: 'finish' });
    expect(session.state.pending?.prompt).toContain('额外');
    expect(session.state.players[0]!.row[0]).toBe('animals');
    const option = session.state.pending!.options.find(option => option.id === `extra-${action}-0`)!;
    expect(option).toBeDefined();
    session = resolve(session, [option.id]);
    expect(session.state.context?.action).toBe(action);
    expect(session.state.turns).toBe(0);
    expect(session.state.activePlayer).toBe('p1');
    expect(arkGame.getPlayerView(session.state, 'p2').context?.continuation).toEqual([]);
    for (let step = 0; step < 100 && session.state.turns === 0; step += 1) {
      const actor = arkActor(session.state);
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
    expect(session.state.turns).toBe(1);
  });
  it.each(['505', '509'])('%s 决心可执行替代 X，休息等待额外行动全部结束', id => {
    let session = play(prepareAnimal(id), id);
    session.state.breakProgress = 9;
    session = submit(session, { type: 'finish' });
    expect(session.state.pending?.prompt).toContain('决心');
    expect(session.state.breaks).toBe(0);
    session = resolve(session, ['extra-x-cards']);
    session = settle(session);
    expect(session.state.breaks).toBe(1);
    expect(session.state.turns).toBe(1);
    expect(session.state.players[0]!.row[0]).toBe('cards');
  });
  it('正常命令记录中的额外行动选择可以导出并恢复', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      let session = createSession(arkGame, {}, seed);
      for (let step = 0; step < 1500 && session.state.phase !== 'finished'; step += 1) {
      if (session.state.pending?.prompt.includes('额外') || session.state.pending?.prompt.includes('决心')) {
        expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
        return;
      }
      const actor = arkActor(session.state);
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
      }
    }
    throw new Error('没有找到可恢复的额外行动场景。');
  });
});

describe('基础牌库 · 赞助商与独有建筑', () => {
  it.each(ZOO_CARDS.filter(card => card.kind === 'sponsor').map(card => card.id))('赞助商 %s 在满足条件时可实际入场并完整结算', id => {
    let session = prepareSponsor(id);
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 1 });
    session = submit(session, { type: 'sponsor', card: id, source: 'hand' });
    session = settle(session);
    expect(session.state.players[0]!.sponsors).toContain(id);
    const kind = uniqueKind(id);
    if (kind) expect(session.state.players[0]!.buildings.filter(building => building.kind === kind)).toHaveLength(1);
    expect(session.state.requiredBuildings).toEqual([]);
    arkGame.assertInvariants(session.state);
  });
  it('十五种独有建筑的面积、地形与边界限制不能用普通建造绕过', () => {
    expect(Object.keys(UNIQUE_BUILDINGS)).toHaveLength(15);
    const session = prepareSponsor('254');
    const player = session.state.players[0]!;
    expect(uniqueCommands(session.state, player, '254').length).toBeGreaterThan(0);
    for (const id of ['245', '246']) {
      const commands = uniqueCommands(session.state, player, id);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every(command => command.flip === false)).toBe(true);
    }
  });
  it('独有建筑无合法位置时拒绝打牌，资金、牌区、随机数均不变', () => {
    let session = prepareSponsor('246');
    const player = session.state.players[0]!;
    const occupied = new Set(player.buildings.flatMap(building => building.cells).map(cell => `${cell.q},${cell.r}`));
    for (const cell of mapCells('A').filter(cell => cell.terrain === 'land' && !occupied.has(`${cell.q},${cell.r}`))) player.buildings.push({ id: `filled-${cell.q}-${cell.r}`, kind: 'enclosure-1', cells: [{ q: cell.q, r: cell.r }], animals: [] });
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 1 });
    const before = exportArchive(session);
    const invalid = applyCommand(arkGame, session, { id: 'no-unique-space', actor: 'p1', revision: session.state.revision, command: { type: 'sponsor', card: '246', source: 'hand' } });
    expect(invalid.ok).toBe(false);
    expect(exportArchive(session)).toBe(before);
  });
  it('工程师额外建筑正常付费且每行动最多一次，不消耗原行动强度', () => {
    let session = fixture();
    give(session, '217', 'sponsors');
    session.state.players[0]!.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 0, r: 2, rotation: 0, flip: false });
    expect(session.state.pending?.prompt).toContain('工程师');
    expect(session.state.players[0]!.money).toBe(23);
    session = resolve(session, [session.state.pending!.options[0]!.id]);
    session = settle(session);
    expect(session.state.players[0]!.money).toBe(21);
    expect(session.state.turns).toBe(1);
    expect(session.state.players[0]!.buildings).toHaveLength(4);
  });
  it('综合研究员允许跨地形建造并忽略安置地形，但面积仍检查', () => {
    let session = fixture();
    give(session, '219', 'sponsors');
    session.state.players[0]!.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 1, r: 5, rotation: 0, flip: false });
    expect(session.state.players[0]!.buildings.some(building => building.cells.some(cell => cell.q === 1 && cell.r === 5))).toBe(true);
    expect(housingError({ id: 'small', kind: 'enclosure-1', cells: [{ q: 0, r: 2 }], animals: [] }, '444', 'A', true)).toContain('足够大');
    expect(housingError({ id: 'large', kind: 'enclosure-3', cells: [{ q: 0, r: 2 }, { q: 1, r: 2 }, { q: 2, r: 2 }], animals: [] }, '444', 'A', true)).toBeNull();
  });
  it('大型动物计划仅豁免一个前置图标，不豁免多项或饲养区', () => {
    const player = fixture().state.players[0]!;
    player.sponsors = ['263'];
    expect(requirementError(player, '421')).toBeNull();
    expect(requirementError(player, '402')).not.toBeNull();
    expect(housingError({ id: 'five', kind: 'enclosure-5', cells: [{ q: 0, r: 2 }], animals: [] }, '421')).not.toBeNull();
  });
  it('通配标记支持基础项目时只消耗一个，并给出真实项目收益', () => {
    let session = fixture();
    give(session, '215', 'sponsors');
    session.state.players[0]!.sponsorTokens = { '215': 2 };
    if (!session.state.projects.some(project => project.id === '103')) {
      session.state.baseReserve.push(session.state.projects[0]!.id);
      session.state.projects[0] = { id: '103', blocked: 0, claimed: [null, null, null] };
      session.state.baseReserve = session.state.baseReserve.filter(id => id !== '103');
    }
    session.state.projects.find(project => project.id === '103')!.blocked = 0;
    session.state.players[0]!.partners = ['africa'];
    session.state.players[0]!.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, { type: 'association', task: 'project', target: '103', tier: 2, reward: 'money-12', rewardFirst: false, wildcard: '215' });
    session = settle(session);
    expect(session.state.players[0]!.sponsorTokens!['215']).toBe(1);
    expect(session.state.players[0]!.conservation).toBe(projectById('103').points[2]);
  });
  it('本地海鸟和蜥蜴的终局按孤立地形计分，不把已覆盖格当孤立', () => {
    const player = fixture().state.players[0]!;
    expect(newSponsorFinalPoints(player, '258')).toBe(Math.floor(connectedSpaces(player, 'water', true) / 2));
    expect(newSponsorFinalPoints(player, '259')).toBe(Math.floor(connectedSpaces(player, 'rock', true) / 2));
    expect(tagsOf(player)).toEqual({});
  });
  it('两张繁育计划可各用一个通配标记，同一张不能一次使用两个', () => {
    let session = fixture();
    give(session, '215', 'sponsors'); give(session, '218', 'sponsors');
    session.state.players[0]!.sponsorTokens = { '215': 2, '218': 2 };
    if (!session.state.projects.some(project => project.id === '103')) {
      session.state.baseReserve.push(session.state.projects[0]!.id);
      session.state.projects[0] = { id: '103', blocked: 0, claimed: [null, null, null] };
      session.state.baseReserve = session.state.baseReserve.filter(id => id !== '103');
    }
    session.state.projects.find(project => project.id === '103')!.blocked = 0;
    session.state.players[0]!.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    const command = { type: 'association' as const, task: 'project' as const, target: '103', tier: 2, reward: 'money-12', rewardFirst: false };
    expect(() => arkGame.parseCommand({ ...command, wildcards: ['215', '215'] })).toThrow();
    session = settle(submit(session, { ...command, wildcards: ['215', '218'] }));
    expect(session.state.players[0]!.sponsorTokens).toEqual({ '215': 1, '218': 1 });
  });
  it('小型动物计划按正常费用额外安置，且可独立放弃拿展示牌', () => {
    let session = fixture();
    give(session, '228', 'sponsors');
    give(session, '486');
    give(session, '487');
    const player = session.state.players[0]!;
    player.money = 50;
    player.row = ['build', 'animals', 'cards', 'association', 'sponsors'];
    player.buildings.push({ id: 'extra-small', kind: 'enclosure-1', cells: [{ q: 2, r: 3 }], animals: [] });
    session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
    session = submit(session, { type: 'animal', card: '486', source: 'hand', building: 'initial-enclosure' });
    expect(session.state.pending?.prompt).toContain('小型动物计划');
    const option = session.state.pending!.options.find(option => option.effects.some(item => item.effect.type === 'play-bonus-animal' && item.effect.card === '487'))!;
    session = resolve(session, [option.id]);
    expect(session.state.players[0]!.animals).toEqual(['486', '487']);
    expect(session.state.players[0]!.money).toBe(38);
    if (session.state.pending?.prompt.includes('展示区')) session = resolve(session, []);
    session = settle(session);
    expect(session.state.turns).toBe(1);
  });
  it('考古学家复制尚未覆盖的奖励且不把来源格标记为已覆盖', () => {
    let session = fixture();
    give(session, '221', 'sponsors');
    const player = session.state.players[0]!;
    player.buildings.push({ id: 'path', kind: 'enclosure-2', cells: [{ q: 0, r: 1 }, { q: 0, r: 2 }], animals: [] });
    player.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 0, r: 0, rotation: 0, flip: false });
    expect(session.state.pending?.prompt).toContain('考古学家');
    session = resolve(session, ['archaeology-4-1']);
    expect(session.state.players[0]!.x).toBe(1);
    expect(session.state.players[0]!.coveredRewards).toContain('0,0');
    expect(session.state.players[0]!.coveredRewards).not.toContain('4,1');
  });
  it('重复放归需要迁徙记录，第二次支持同项目获得额外保护', () => {
    let session = fixture();
    give(session, '224', 'sponsors');
    give(session, '118');
    give(session, '405', 'animals');
    give(session, '404', 'animals');
    const player = session.state.players[0]!;
    player.appeal = 10;
    player.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = settle(submit(session, { type: 'association', task: 'project', target: '118', source: 'hand', tier: 2, reward: 'money-12', rewardFirst: false, releaseAnimal: '405' }));
    expect(session.state.players[0]!.conservation).toBe(4);
    session.state.activePlayer = 'p1'; session.state.context = null; session.state.stage = 'turn';
    session.state.players[0]!.usedWorkers = {};
    session.state.players[0]!.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    give(session, '413', 'animals');
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = settle(submit(session, { type: 'association', task: 'project', target: '118', source: 'board', tier: 1, reward: 'x-3', rewardFirst: false, releaseAnimal: '413' }));
    expect(session.state.players[0]!.supportedProjects).toEqual(['118', '118']);
    expect(session.state.players[0]!.conservation).toBe(9);
  });
  it('特别任务的方向约束在付费前生效，三格动物不受限制', () => {
    const session = prepareSponsor('227');
    const player = session.state.players[0]!;
    give(session, '227', 'sponsors');
    player.animalFocus = 'small';
    expect(requirementError(player, '401')).toContain('方向冲突');
    expect(requirementError(player, '413')).toBeNull();
    player.animalFocus = 'large';
    expect(requirementError(player, '405')).toContain('方向冲突');
    expect(requirementError(player, '413')).toBeNull();
  });
});
