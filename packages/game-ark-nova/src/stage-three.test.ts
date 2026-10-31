import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, MAP_0, mapCells, placementError, buildingCells, buildCommands,
  housingError, buildingUsedSpace, releaseHousing, specialSpace, projectRequirementError, projectRewardsFor,
  DECK_PROJECTS, BONUS_TILES, type ArkSession, type ArkCommand, type ArkPlayer, type Building
} from './index.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `stage3-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.code}: ${outcome.error.message}`);
  return outcome.session;
}
function fixture(map: 'A' | '0' = 'A'): ArkSession {
  let session = createSession(arkGame, { map }, 42);
  while (session.state.pending) {
    const pending = session.state.pending;
    session = submit(session, { type: 'resolve', choiceId: pending.id, options: pending.options.slice(0, pending.min).map(option => option.id) });
  }
  return session;
}
function moveCard(session: ArkSession, player: ArkPlayer, id: string, zone: 'hand' | 'animals' | 'sponsors' = 'hand') {
  session.state.deck = session.state.deck.filter(card => card !== id);
  session.state.discard = session.state.discard.filter(card => card !== id);
  session.state.market = session.state.market.map(card => card === id ? null : card);
  session.state.activeProjects = session.state.activeProjects.filter(project => project.id !== id);
  for (const candidate of session.state.players) {
    candidate.hand = candidate.hand.filter(card => card !== id);
    candidate.animals = candidate.animals.filter(card => card !== id);
    candidate.sponsors = candidate.sponsors.filter(card => card !== id);
    for (const building of candidate.buildings) building.animals = building.animals.filter(card => card !== id);
  }
  player[zone].push(id);
}
function settle(session: ArkSession): ArkSession {
  let count = 0;
  while (session.state.pending) {
    const actor = arkActor(session.state);
    session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    if (++count > 30) throw new Error('选择链未结束。');
  }
  return session;
}
function projectCommand(target: string, reward = 'money-12', releaseAnimal = '', source: 'board' | 'hand' | 'market' = 'hand', tier = 2): ArkCommand {
  return { type: 'association', task: 'project', target, source, tier, reward, rewardFirst: false, releaseAnimal };
}

describe('阶段三一 · 地图 0 与特殊馆', () => {
  it('地图 0 空白开始，边界首建、独立地形与机灵奖励', () => {
    const session = fixture('0');
    expect(session.state.players[0]!.buildings).toEqual([]);
    expect(MAP_0).toHaveLength(58);
    expect(mapCells('0')).toBe(MAP_0);
    expect(MAP_0.filter(cell => cell.terrain === 'rock')).toHaveLength(9);
    expect(MAP_0.filter(cell => cell.terrain === 'water')).toHaveLength(10);
    expect(MAP_0.find(cell => cell.column === 5 && cell.row === 3)?.reward).toBe('clever');
    expect(placementError([], 'enclosure-1', [{ q: 4, r: 1 }], false, '0')).toContain('边界');
    expect(placementError([], 'enclosure-1', [{ q: 0, r: 2 }], false, '0')).toBeNull();
    expect(projectRewardsFor(session.state.players[0]!)).toContain('worker');
    expect(projectRewardsFor(session.state.players[0]!)).not.toContain('income-5');
  });
  it('三种特殊馆形状和升级门槛正确，各种每人仅一座', () => {
    const session = fixture();
    const player = session.state.players[0]!;
    expect(buildingCells('petting', { q: 0, r: 0 }, 0, false)).toEqual([{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }]);
    expect(buildCommands(session.state, player, 5, false).some(command => command.kind === 'aviary' || command.kind === 'reptile-house')).toBe(false);
    const commands = buildCommands(session.state, player, 5, true, [], Infinity);
    expect(commands.some(command => command.kind === 'aviary')).toBe(true);
    expect(commands.some(command => command.kind === 'reptile-house')).toBe(true);
    const command = commands.find(command => command.kind === 'aviary')!;
    const cells = buildingCells('aviary', command, command.rotation, command.flip);
    expect(placementError(player.buildings, 'aviary', cells, false)).toContain('II');
    player.buildings.push({ id: 'existing', kind: 'aviary', cells: [], animals: [] });
    expect(placementError(player.buildings, 'aviary', cells, true)).toContain('只能有一个');
  });
  it('特殊馆按卡面空间数累计，零空间动物仍须满足地形', () => {
    const hall: Building = { id: 'reptiles', kind: 'reptile-house', cells: [{ q: 1, r: 2 }, { q: 2, r: 2 }, { q: 2, r: 1 }, { q: 3, r: 1 }, { q: 3, r: 0 }], animals: [], occupancy: 5 };
    expect(specialSpace('486', 'reptile-house')).toBe(0);
    expect(specialSpace('495', 'aviary')).toBe(1);
    expect(housingError(hall, '486')).toBeNull();
    expect(housingError(hall, '472')).toContain('容量不足');
    expect(housingError(hall, '495')).toContain('不允许');
    expect(housingError({ ...hall, cells: [{ q: 0, r: 2 }], occupancy: 0 }, '486')).toContain('岩石');
    expect(buildingUsedSpace(hall)).toBe(5);
  });
  it('建馆后逐只转移、恢复最小标准饲养区，不重复给动物收益', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    moveCard(session, player, '498', 'animals');
    player.buildings[1]!.animals = ['498'];
    player.buildings[1]!.occupancy = 1;
    player.appeal = 4;
    player.upgrades = ['build'];
    player.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    const build = buildCommands(session.state, player, 5, true, [], Infinity).find(command => command.kind === 'aviary')!;
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, build);
    while (session.state.pending && !session.state.pending.prompt.includes('仅此一次')) {
      const actor = arkActor(session.state);
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
    expect(session.state.pending?.prompt).toContain('仅此一次');
    expect(session.state.players[0]!.money).toBeGreaterThanOrEqual(15);
    const transfer = session.state.pending!.options.find(option => option.id.startsWith('transfer-498'))!;
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: [transfer.id] });
    session = settle(session);
    expect(session.state.players[0]!.appeal).toBe(4);
    expect(buildingUsedSpace(session.state.players[0]!.buildings[1]!)).toBe(0);
    const hall = session.state.players[0]!.buildings.find(building => building.kind === 'aviary')!;
    expect(buildingUsedSpace(hall)).toBe(1);
    expect(hall.animals).toContain('498');
    expect(session.state.turns).toBe(1);
  });
  it('放归优先移除特殊馆标记，不按历史动物绑定释放标准饲养区', () => {
    const player = fixture().state.players[0]!;
    player.animals = ['495'];
    player.buildings[1]!.animals = ['495'];
    player.buildings[1]!.occupancy = 1;
    player.buildings.push({ id: 'aviary', kind: 'aviary', cells: [], animals: [], occupancy: 3 });
    releaseHousing(player, '495');
    expect(buildingUsedSpace(player.buildings[1]!)).toBe(1);
    expect(buildingUsedSpace(player.buildings[2]!)).toBe(2);
  });
});

describe('阶段三二 · 二十张牌库项目', () => {
  it('20 张项目包含 10 放归、5 繁育和 5 图标项目', () => {
    expect(DECK_PROJECTS).toHaveLength(20);
    expect(DECK_PROJECTS.filter(project => project.mode === 'release')).toHaveLength(10);
    expect(DECK_PROJECTS.filter(project => project.mode === 'breed')).toHaveLength(5);
    expect(DECK_PROJECTS.filter(project => project.mode === 'collect')).toHaveLength(5);
  });
  it('放归标准面积必须与大/中/小等级精确对应', () => {
    const player = fixture().state.players[0]!;
    player.animals = ['401', '413', '405'];
    expect(projectRequirementError(player, '118', 0, '401')).toBeNull();
    expect(projectRequirementError(player, '118', 1, '401')).toContain('精确匹配');
    expect(projectRequirementError(player, '118', 1, '413')).toBeNull();
    expect(projectRequirementError(player, '118', 2, '413')).toContain('精确匹配');
    expect(projectRequirementError(player, '118', 2, '405')).toBeNull();
  });
  it('项目须打出并立即支持；放归回退印刷魅力，保留能力收益、保护和声望', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    moveCard(session, player, '118');
    moveCard(session, player, '405', 'animals');
    player.buildings[1]!.animals = ['405']; player.buildings[1]!.occupancy = 1;
    player.appeal = 8;
    player.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, projectCommand('118', 'money-12', '405'));
    session = settle(session);
    expect(session.state.players[0]!.appeal).toBe(5);
    expect(session.state.players[0]!.reputation).toBe(2);
    expect(session.state.players[0]!.conservation).toBe(3);
    expect(session.state.players[0]!.money).toBe(37);
    expect(session.state.players[0]!.animals).not.toContain('405');
    expect(session.state.discard).toContain('405');
    expect(session.state.activeProjects[0]!.id).toBe('118');
    expect(session.state.activeProjects[0]!.claimed[2]).toBe('p1');
  });
  it('从展示区打出要求协会 II、声望范围和先付档案夹费用', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    moveCard(session, player, '125');
    player.hand.splice(player.hand.indexOf('125'), 1);
    const previous = session.state.market[0];
    if (previous) session.state.discard.push(previous);
    session.state.market[0] = '125';
    moveCard(session, player, '486', 'animals');
    player.partners = ['europe']; player.upgrades = ['association']; player.x = 1;
    player.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 1 });
    session = submit(session, projectCommand('125', 'money-12', '', 'market', 0));
    session = settle(session);
    expect(session.state.players[0]!.money).toBe(36);
    expect(session.state.players[0]!.reputation).toBe(3);
    expect(session.state.market[0]).toBeNull();
    session = submit(session, { type: 'finish' });
    expect(session.state.market.filter(Boolean)).toHaveLength(6);
  });
  it('新增项目向右推移并移出第三张，基础项目不受影响', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    for (const id of ['123', '124', '125']) moveCard(session, player, id);
    for (const id of ['486']) moveCard(session, player, id, 'animals');
    for (const id of ['123', '124']) {
      player.hand.splice(player.hand.indexOf(id), 1);
      session.state.activeProjects.push({ id, blocked: -1, claimed: ['p2', null, null] });
    }
    player.partners = ['europe']; player.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
    const base = structuredClone(session.state.projects);
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = submit(session, projectCommand('125', 'money-12', '', 'hand', 0));
    session = settle(session);
    expect(session.state.activeProjects.map(project => project.id)).toEqual(['125', '123']);
    expect(session.state.discard).toContain('124');
    expect(session.state.projects).toEqual(base);
    expect(session.state.players[0]!.supportedProjects).toEqual(['125']);
  });
});

describe('阶段三三 · 随机奖励与双重', () => {
  it('九选四按种子确定、无重复、共享竞争与五资金保底', () => {
    expect(BONUS_TILES).toHaveLength(9);
    const first = createSession(arkGame, {}, 42);
    const second = createSession(arkGame, {}, 42);
    expect(first.state.bonusTiles).toEqual(second.state.bonusTiles);
    expect(new Set(first.state.bonusTiles.map(tile => tile.reward)).size).toBe(4);
    expect(first.state.bonusTiles.filter(tile => tile.point === 5)).toHaveLength(2);
    expect(createSession(arkGame, {}, 43).state.bonusTiles).not.toEqual(first.state.bonusTiles);
  });
  it('九种随机奖励均通过真实保护里程碑执行，领取后不能重复领取', () => {
    for (const reward of BONUS_TILES) {
      let session = fixture();
      const player = session.state.players[0]!;
      moveCard(session, player, '220');
      player.conservation = 4;
      player.upgrades = ['association'];
      player.row = ['animals', 'cards', 'build', 'sponsors', 'association'];
      const rewards = [reward, ...BONUS_TILES.filter(candidate => candidate !== reward)].slice(0, 4);
      session.state.bonusTiles = rewards.map((name, index) => ({ point: index < 2 ? 5 : 8, reward: name, claimedBy: null }));
      session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
      session = submit(session, { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false });
      session = submit(session, { type: 'donate' });
      expect(session.state.pending!.options.some(option => option.id === 'money-5')).toBe(true);
      session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: [`5-${reward}`] });
      session = settle(session);
      expect(session.state.bonusTiles.find(tile => tile.reward === reward)?.claimedBy).toBe('p1');
      expect(session.state.claimedMilestones).toContain(`5-${reward}`);
      expect(arkGame.assertInvariants(session.state)).toBeUndefined();
      if (reward === 'sponsor-money') expect(session.state.players[0]!.sponsors).toContain('220');
      if (reward === 'double-token') expect(session.state.players[0]!.doubleTokens.length).toBe(1);
      if (reward === 'university') expect(session.state.players[0]!.universities.length).toBe(1);
      if (reward === 'partner-zoo') expect(session.state.players[0]!.partners.length).toBe(1);
      if (reward === 'free-3') expect(session.state.players[0]!.buildings.length).toBeGreaterThan(2);
    }
  });
  it('双重两次 X 分别扣除，第一次推进休息仍待整个回合结束才休息', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.row = ['animals', 'cards', 'build', 'association', 'sponsors'];
    player.x = 2; player.doubleTokens = ['sponsors'];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 1, useDouble: true });
    session = submit(session, { type: 'income' });
    expect(session.state.breakProgress).toBe(6);
    expect(session.state.turns).toBe(0);
    expect(session.state.players[0]!.money).toBe(31);
    expect(session.state.pending?.options.find(option => option.id === 'repeat-0')?.label).toContain('强度 5');
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: ['repeat-1'] });
    expect(session.state.context?.strength).toBe(6);
    expect(session.state.players[0]!.x).toBe(0);
    session = submit(session, { type: 'income' });
    expect(session.state.stage).toBe('break');
    session = settle(session);
    expect(session.state.players[0]!.money).toBe(42);
    expect(session.state.breaks).toBe(1);
    expect(session.state.players[0]!.row[0]).toBe('sponsors');
    expect(session.state.players[0]!.doubleTokens).toEqual([]);
  });
  it('双重也能获取两枚 X，休息移除未使用的标记', () => {
    let session = fixture();
    session.state.players[0]!.doubleTokens = ['build'];
    session = submit(session, { type: 'take-x', action: 'build', useDouble: true });
    expect(session.state.players[0]!.x).toBe(2);
    expect(session.state.players[0]!.doubleTokens).toEqual([]);
    session.state.players[0]!.doubleTokens = ['animals'];
    session.state.breakProgress = 8;
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = submit(session, { type: 'income' });
    session = settle(session);
    expect(session.state.players[0]!.doubleTokens).toEqual([]);
  });
  it('AI 的双地图整局都可自然完成、重放，并拒绝旧规则存档', () => {
    for (const map of ['A', '0'] as const) {
      let session = createSession(arkGame, { map }, 6);
      for (let step = 0; step < 1500 && session.state.phase !== 'finished'; step += 1) {
        const actor = arkActor(session.state);
        session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
      }
      expect(session.state.phase).toBe('finished');
      expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
      const old = JSON.parse(exportArchive(session));
      old.manifest.rulesVersion = 'base-v2-first-playable-1';
      expect(() => importArchive(arkGame, JSON.stringify(old))).toThrow('不兼容');
    }
  });
});
