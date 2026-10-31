import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import {
  arkGame, arkActor, chooseArkCommand, MAP_IDS, MAP_INFO, MAP_1, MAP_2, mapCells, housingCapacity,
  housingError, nextToLandmark, buildingCells, buildCommands, buildingUsedSpace, freedEnclosures,
  placementError, projectRewardsFor, zooCard, ZOO_CARDS, tagsOf, type MapId, type ArkSession,
  type ArkCommand, type Building
} from './index.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `stage4-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.message}`);
  return outcome.session;
}
function fixture(map: MapId = 'A'): ArkSession {
  let session = createSession(arkGame, { map }, 42);
  while (session.state.pending) {
    const pending = session.state.pending;
    session = submit(session, { type: 'resolve', choiceId: pending.id, options: pending.options.slice(0, pending.min).map(option => option.id) });
  }
  return session;
}
function give(session: ArkSession, id: string, zone: 'hand' | 'animals' | 'sponsors' = 'hand', actor = 'p1') {
  session.state.deck = session.state.deck.filter(card => card !== id);
  session.state.discard = session.state.discard.filter(card => card !== id);
  session.state.market = session.state.market.map(card => card === id ? null : card);
  for (const player of session.state.players) {
    for (const existing of ['hand', 'animals', 'sponsors'] as const) player[existing] = player[existing].filter(card => card !== id);
    player.buried = player.buried.filter(card => card.card !== id);
    for (const building of player.buildings) building.animals = building.animals.filter(card => card !== id);
  }
  session.state.players.find(player => player.id === actor)![zone].push(id);
}
function resolve(session: ArkSession, options: string[]): ArkSession {
  return submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options });
}
function settle(session: ArkSession): ArkSession {
  let count = 0;
  while (session.state.pending) {
    const actor = arkActor(session.state);
    session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    if (++count > 100) throw new Error('选择链未结束。');
  }
  return session;
}
function readyAnimal(id: string, map: MapId = 'A'): ArkSession {
  const session = fixture(map);
  const player = session.state.players[0]!;
  give(session, id);
  player.money = 100;
  player.upgrades = ['animals', 'build', 'association'];
  player.partners = ['asia', 'europe', 'australia', 'americas'];
  player.universities = ['science'];
  player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
  for (const tagCard of ['414', '455', '460', '465']) if (tagCard !== id) give(session, tagCard, 'animals');
  const command = buildCommands(session.state, player, 5, true, [], Infinity).find(command =>
    command.kind === 'enclosure-5' && !housingError({ id: 'housing', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] }, id, map));
  if (!command) throw new Error(`未找到 ${id} 的合法饲养区。`);
  player.buildings.push({ id: 'housing', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] });
  return session;
}
function playAnimal(session: ArkSession, id: string, building = 'housing'): ArkSession {
  session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
  return submit(session, { type: 'animal', card: id, source: 'hand', building });
}
function readySponsor(id: string): ArkSession {
  const session = fixture();
  const player = session.state.players[0]!;
  give(session, id);
  player.money = 100;
  player.upgrades = ['sponsors'];
  player.row = ['animals', 'build', 'cards', 'association', 'sponsors'];
  return session;
}
function playSponsor(session: ArkSession, id: string): ArkSession {
  session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
  return settle(submit(session, { type: 'sponsor', card: id, source: 'hand' }));
}

describe('阶段四 · 独立地图与特殊规则', () => {
  it.each(['1', '2'] as const)('地图 %s 的布局、奖励、升级格和地标独立登记', map => {
    const cells = mapCells(map);
    expect(cells).toHaveLength(58);
    expect(cells.filter(cell => cell.terrain === 'rock')).toHaveLength(9);
    expect(cells.filter(cell => cell.terrain === 'water')).toHaveLength(7);
    expect(cells.filter(cell => cell.upgraded)).toHaveLength(map === '1' ? 3 : 4);
    const player = fixture(map).state.players[0]!;
    expect(player.buildings).toEqual([]);
    expect(projectRewardsFor(player)).toContain('worker');
    expect(projectRewardsFor(player)).not.toContain('draw-2');
    const landmark = MAP_INFO[map].landmark!.cell;
    expect(cells.find(cell => cell.q === landmark.q && cell.r === landmark.r)?.terrain).toBe(map === '1' ? 'rock' : 'water');
    expect(placementError([], 'enclosure-1', [landmark], true, map)).toMatch(/水域|岩石/);
  });
  it('地图奖励图标按机灵、付费赞助商和合作动物园区分', () => {
    expect(MAP_1.find(cell => cell.column === 4 && cell.row === 0)?.reward).toBe('clever');
    expect(MAP_2.find(cell => cell.column === 8 && cell.row === 5)?.reward).toBe('clever');
    expect(MAP_2.find(cell => cell.column === 1 && cell.row === 6)?.reward).toBe('paid-sponsor');
    expect(MAP_2.find(cell => cell.column === 1 && cell.row === 1)?.reward).toBe('partner');
    expect(projectRewardsFor(fixture('1').state.players[0]!)).toContain('income-sponsor');
  });
  it('观测塔只奖励与塔格共边的标准区，普通岩石与特殊馆不触发', () => {
    for (const kind of ['enclosure-1', 'aviary'] as const) {
      let session = fixture('1');
      const player = session.state.players[0]!;
      const animal = kind === 'aviary' ? '495' : '405';
      give(session, animal);
      player.money = 100;
      player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
      player.buildings = [
        { id: 'boundary', kind: 'enclosure-1', cells: [{ q: 0, r: 1 }], animals: [] },
        { id: 'path', kind: 'enclosure-1', cells: [{ q: 1, r: 1 }], animals: [] }
      ];
      const command = buildCommands(session.state, player, 5, true, [], Infinity).find(command =>
        command.kind === kind && nextToLandmark({ id: 'tower', kind, cells: buildingCells(kind, command, command.rotation, command.flip), animals: [] }, '1'))!;
      expect(command).toBeDefined();
      player.buildings.push({ id: 'tower', kind, cells: buildingCells(kind, command, command.rotation, command.flip), animals: [] });
      session = playAnimal(session, animal, 'tower');
      expect(session.state.players[0]!.appeal).toBe(zooCard(animal).appeal + (kind === 'aviary' ? 0 : 2));
    }
    expect(nextToLandmark({ id: 'rock-only', kind: 'enclosure-1', cells: [{ q: 2, r: 0 }], animals: [] }, '1')).toBe(false);
  });
  it('户外营地的 +2 只适用于与门格邻接的标准区，放归按有效容量找最小区', () => {
    const adjacent: Building = { id: 'outdoor', kind: 'enclosure-1', cells: [{ q: 6, r: 1 }], animals: [] };
    expect(housingCapacity(adjacent, '2')).toBe(3);
    expect(housingError(adjacent, '466', '2')).toBeNull();
    expect(housingError(adjacent, '466', 'A')).toContain('足够大');
    expect(housingCapacity({ ...adjacent, kind: 'aviary' }, '2')).toBe(5);
    const elsewhere = { ...adjacent, cells: [{ q: 6, r: 3 }] };
    expect(housingCapacity(elsewhere, '2')).toBe(1);
    const player = fixture('2').state.players[0]!;
    player.buildings = [
      { ...adjacent, kind: 'enclosure-2', cells: [{ q: 6, r: 1 }, { q: 6, r: 2 }], occupancy: 1 },
      { id: 'actual-three', kind: 'enclosure-3', cells: [{ q: 0, r: 2 }, { q: 0, r: 3 }, { q: 1, r: 3 }], animals: [], occupancy: 1 }
    ];
    expect(freedEnclosures(player, '466').map(building => building.id)).toEqual(['actual-three']);
  });
  it('户外营地实打一格区安置三格动物，第四工人奖励仅领取一次', () => {
    let session = fixture('2');
    const player = session.state.players[0]!;
    give(session, '466');
    player.buildings = [{ id: 'outdoor', kind: 'enclosure-1', cells: [{ q: 6, r: 1 }], animals: [] }];
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    session = playAnimal(session, '466', 'outdoor');
    expect(session.state.players[0]!.money).toBe(13);
    expect(session.state.players[0]!.animals).toContain('466');
    let worker = readyAnimal('416', '2');
    worker.state.players[0]!.workers = 3;
    worker = playAnimal(worker, '416');
    expect(worker.state.players[0]!.workers).toBe(4);
    expect(worker.state.players[0]!.conservation).toBe(1);
    expect(worker.state.players[0]!.doubleTokens).toContain('association');
    expect(MAP_INFO['2'].lastWorkerPoints).toBe(1);
  });
  it.each(['1', '2'] as const)('地图 %s 的第三所大学使用该地图的保护点奖励', map => {
    let session = fixture(map);
    const player = session.state.players[0]!;
    player.universities = ['hand', 'science'];
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = settle(submit(session, { type: 'association', task: 'university', target: 'reputation', tier: 0, reward: 'money-12', rewardFirst: false }));
    expect(session.state.players[0]!.conservation).toBe(map === '1' ? 1 : 2);
  });
  it('覆盖机灵格先完成建造和行动卡归位，再让玩家移动卡牌', () => {
    let session = fixture('1');
    const player = session.state.players[0]!;
    player.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 4, r: -2, rotation: 0, flip: false });
    expect(session.state.pending?.prompt).toContain('机灵');
    expect(session.state.players[0]!.upgrades).toEqual([]);
    expect(session.state.players[0]!.row[0]).toBe('build');
    session = resolve(session, ['cards']);
    expect(session.state.players[0]!.row.slice(0, 2)).toEqual(['cards', 'build']);
  });
  it('户外营地的付费赞助商覆盖奖励不占赞助商行动，不能预支入场收益', () => {
    let session = fixture('2');
    give(session, '220');
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 1, r: 5, rotation: 0, flip: false });
    expect(session.state.pending?.prompt).toContain('可支付');
    expect(session.state.players[0]!.money).toBe(23);
    const beforeRow = session.state.players[0]!.row.filter(action => action !== 'build');
    session = resolve(session, ['220']);
    expect(session.state.players[0]!.money).toBe(22);
    expect(session.state.players[0]!.sponsors).toContain('220');
    expect(session.state.players[0]!.row).toEqual(['build', ...beforeRow]);
  });
});

describe('阶段四 · 二十一张新动物及能力族', () => {
  it('新牌池为 98 动物与 32 赞助商，卡牌全部有明确能力', () => {
    expect(ZOO_CARDS.filter(card => card.kind === 'animal')).toHaveLength(98);
    expect(ZOO_CARDS.filter(card => card.kind === 'sponsor')).toHaveLength(32);
    expect(zooCard('510').specialHousing).toEqual({ kind: 'aviary', space: 1 });
    expect(zooCard('516').specialHousing).toBeUndefined();
    expect(zooCard('524').tags).toEqual(['pet']);
  });
  it.each([['408', 'association'], ['415', 'association'], ['419', 'animals'], ['428', 'sponsors'], ['466', 'cards'], ['502', 'build']] as const)('%s 调度在动物行动完成后移动 %s 至槽位 5', (id, action) => {
    let session = playAnimal(readyAnimal(id), id);
    expect(session.state.pending).toBeNull();
    expect(session.state.context?.action).toBe('animals');
    session = submit(session, { type: 'finish' });
    expect(session.state.pending?.prompt).toContain('调度');
    expect(session.state.players[0]!.row[0]).toBe('animals');
    session = resolve(session, [`boost-${action}-5`]);
    expect(session.state.players[0]!.row.at(-1)).toBe(action);
    expect(session.state.turns).toBe(1);
  });
  it.each([['416', 'association'], ['434', 'sponsors'], ['457', 'cards'], ['510', 'build'], ['516', 'build']] as const)('%s 立即向 %s 添加双重标记', (id, action) => {
    const session = settle(playAnimal(readyAnimal(id), id));
    expect(session.state.players[0]!.doubleTokens).toContain(action);
    expect(session.state.context?.action).toBe('animals');
  });
  it('挖掘逐次弃换，展示区立即补齐，中途跳过不再消耗随机数', () => {
    let session = readyAnimal('435');
    give(session, '405');
    const top = session.state.deck[0]!;
    session = playAnimal(session, '435');
    expect(session.state.pending?.prompt).toContain('挖掘');
    session = resolve(session, ['dig-hand-405']);
    expect(session.state.players[0]!.hand).toContain(top);
    expect(session.state.discard).toContain('405');
    expect(session.state.pending?.prompt).toContain('2 次');
    const market = session.state.market.find(Boolean)!;
    session = resolve(session, [`dig-market-${market}`]);
    expect(session.state.market.filter(Boolean)).toHaveLength(6);
    expect(session.state.market).not.toContain(market);
    expect(session.state.pending?.prompt).toContain('1 次');
    const rng = session.state.rng;
    session = resolve(session, []);
    expect(session.state.rng).toBe(rng);
    expect(session.state.pending).toBeNull();
    expect(session.state.context?.remaining).toBe(1);
  });
  it.each(['435', '440', '445', '446'] as const)('%s 挖掘允许立即跳过，按卡面收益支付一次', id => {
    const initial = readyAnimal(id);
    const money = initial.state.players[0]!.money;
    let session = playAnimal(initial, id);
    expect(session.state.pending?.prompt).toContain('挖掘');
    const before = exportArchive(session);
    const bad = applyCommand(arkGame, session, { id: 'bad-dig', actor: 'p1', revision: session.state.revision, command: { type: 'resolve', choiceId: session.state.pending!.id, options: ['not-an-option'] } });
    expect(bad.ok).toBe(false);
    expect(exportArchive(session)).toBe(before);
    session = resolve(session, []);
    expect(session.state.players[0]!.money).toBe(money - zooCard(id).price + zooCard(id).tags.filter(tag => initial.state.players[0]!.partners.includes(tag)).length * 3);
    expect(session.state.players[0]!.animals).toContain(id);
  });
  it('曼加利察猪仍须萌宠园，挖掘完成后才结算萌宠收益', () => {
    let session = fixture();
    give(session, '524');
    const player = session.state.players[0]!;
    player.buildings.push({ id: 'petting', kind: 'petting', cells: buildingCells('petting', { q: 1, r: 2 }, 0, false), animals: [] });
    player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
    session = playAnimal(session, '524', 'petting');
    expect(session.state.players[0]!.appeal).toBe(0);
    session = resolve(session, []);
    expect(session.state.players[0]!.appeal).toBe(3);
    expect(buildingUsedSpace(session.state.players[0]!.buildings.find(building => building.id === 'petting')!)).toBe(1);
  });
  it.each(['497', '501', '508', '511', '518'] as const)('%s 展示可选择跳过，既不建造也不扣建筑费', id => {
    let session = playAnimal(readyAnimal(id), id);
    expect(session.state.pending?.prompt).toContain('姿态');
    const money = session.state.players[0]!.money;
    const buildings = session.state.players[0]!.buildings.length;
    session = resolve(session, []);
    expect(session.state.players[0]!.money).toBe(money);
    expect(session.state.players[0]!.buildings).toHaveLength(buildings);
  });
  it('多次展示依次重算可放位置，尊重贩售亭距离和正常覆盖奖励', () => {
    let session = readyAnimal('508');
    session.state.players[0]!.buildings = session.state.players[0]!.buildings.filter(building => building.id !== 'housing');
    session = playAnimal(session, '508', 'initial-enclosure');
    const cost = session.state.players[0]!.money;
    for (const [q, r, kind] of [[0, 2, 'pavilion'], [0, 1, 'pavilion'], [0, 0, 'kiosk']] as const) {
      const option = session.state.pending!.options.find(option => option.label === `${kind === 'kiosk' ? '贩售亭' : '休憩亭'} · ${q},${r}`);
      expect(option).toBeDefined();
      session = resolve(session, [option!.id]);
    }
    expect(session.state.players[0]!.money).toBe(cost);
    expect(session.state.players[0]!.x).toBe(1);
    expect(session.state.players[0]!.buildings.filter(building => building.kind === 'pavilion')).toHaveLength(2);
  });
  it('两枚同卡双重执行三次，X 每次独立花费，全部完成后才归位和休息', () => {
    let session = fixture();
    const player = session.state.players[0]!;
    player.row = ['animals', 'build', 'cards', 'association', 'sponsors'];
    player.doubleTokens = ['sponsors', 'sponsors'];
    player.x = 2;
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 1, doubleCount: 2 });
    expect(session.state.context?.strength).toBe(6);
    session = submit(session, { type: 'income' });
    expect(session.state.breaks).toBe(0);
    expect(session.state.players[0]!.row.at(-1)).toBe('sponsors');
    session = resolve(session, ['repeat-1']);
    expect(session.state.context?.strength).toBe(6);
    session = submit(session, { type: 'income' });
    expect(session.state.breaks).toBe(0);
    session = resolve(session, ['repeat-0']);
    expect(session.state.context?.strength).toBe(5);
    session = settle(submit(session, { type: 'income' }));
    expect(session.state.turns).toBe(1);
    expect(session.state.breaks).toBe(1);
    expect(session.state.players[0]!.row[0]).toBe('sponsors');
    expect(session.state.players[0]!.money).toBe(47);
    expect(session.state.players[0]!.doubleTokens).toEqual([]);
  });
});

describe('阶段四 · 科研、大洲与地形赞助商', () => {
  it('赞助商 II 条件在支付前校验，科研机构提供双研究并触发已有赞助商', () => {
    let session = readySponsor('201');
    session.state.players[0]!.upgrades = [];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    const before = exportArchive(session);
    const bad = applyCommand(arkGame, session, { id: 'need-sponsors-ii', actor: 'p1', revision: session.state.revision, command: { type: 'sponsor', card: '201', source: 'hand' } });
    expect(bad.ok).toBe(false);
    expect(exportArchive(session)).toBe(before);
    let science = readySponsor('223');
    give(science, '202', 'sponsors');
    give(science, '204', 'sponsors');
    science = submit(science, { type: 'begin', action: 'sponsors', spendX: 0 });
    science = submit(science, { type: 'sponsor', card: '223', source: 'hand' });
    expect(science.state.pending?.prompt).toContain('多个效果');
    science = settle(science);
    expect(science.state.players[0]!.reputation).toBe(3);
    expect(science.state.players[0]!.conservation).toBe(2);
    expect(tagsOf(science.state.players[0]!).science).toBe(4);
  });
  it('科学实验室允许放弃拿牌，医学突破和实验室在休息时分别结算', () => {
    let session = readySponsor('201');
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = submit(session, { type: 'sponsor', card: '201', source: 'hand' });
    const cards = session.state.players[0]!.hand.length;
    expect(session.state.pending?.min).toBe(0);
    session = resolve(session, []);
    expect(session.state.players[0]!.hand).toHaveLength(cards);
    session = submit(session, { type: 'finish' });
    give(session, '206', 'sponsors');
    session.state.breakProgress = 8;
    session.state.players[1]!.row = ['animals', 'build', 'cards', 'association', 'sponsors'];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = settle(submit(session, { type: 'income' }));
    expect(session.state.breaks).toBe(1);
    expect(session.state.players[0]!.conservation).toBe(1);
    expect(session.state.players[0]!.hand.length).toBeLessThanOrEqual(4);
  });
  it.each(['202', '204', '208'] as const)('%s 计入自身的研究图标并正确结算即时收益', id => {
    let session = readySponsor(id);
    session.state.players[0]!.universities = ['science', 'reputation'];
    if (id === '204') {
      session.state.players[0]!.universities = ['science'];
      give(session, '223', 'sponsors');
    }
    session = playSponsor(session, id);
    const player = session.state.players[0]!;
    expect(tagsOf(player).science).toBe(id === '204' ? 5 : 4);
    if (id === '202') expect(player.reputation).toBe(2);
    if (id === '204') {
      expect(player.money).toBe(110);
      expect(player.conservation).toBe(1);
    }
    if (id === '208') {
      expect(player.money).toBe(102);
      expect(player.appeal).toBe(4);
    }
  });
  it('大学研究图标和对手新研究卡都会触发科学图书馆，资金归属于持有人', () => {
    let session = fixture();
    give(session, '208', 'sponsors');
    const player = session.state.players[0]!;
    player.row = ['animals', 'build', 'cards', 'sponsors', 'association'];
    session = submit(session, { type: 'begin', action: 'association', spendX: 0 });
    session = settle(submit(session, { type: 'association', task: 'university', target: 'science', tier: 0, reward: 'money-12', rewardFirst: false }));
    expect(session.state.players[0]!.money).toBe(29);
    give(session, '223', 'hand', 'p2');
    session.state.players[1]!.row = ['animals', 'build', 'cards', 'association', 'sponsors'];
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = settle(submit(session, { type: 'sponsor', card: '223', source: 'hand' }));
    expect(session.state.players[0]!.money).toBe(33);
  });
  it('大猩猩野外研究同时给出保护与声望，医学突破按已支持项目给魅力', () => {
    let session = readySponsor('205');
    session.state.players[0]!.universities = ['science', 'reputation'];
    session = playSponsor(session, '205');
    expect(session.state.players[0]!.conservation).toBe(1);
    expect(session.state.players[0]!.reputation).toBe(3);
    let medical = readySponsor('206');
    medical.state.players[0]!.universities = ['science', 'reputation'];
    give(medical, '223', 'sponsors');
    medical.state.players[0]!.supportedProjects = ['101', '102'];
    medical.state.players[0]!.projectRewards = ['income-5', 'income-cp'];
    medical = playSponsor(medical, '206');
    expect(medical.state.players[0]!.appeal).toBe(4);
  });
  it.each([['210', 'kiosk'], ['211', 'enclosure-1'], ['213', 'pavilion']] as const)('%s 自身大洲触发免费 %s，允许跳过且不付建筑费', (id, kind) => {
    let session = readySponsor(id);
    session = submit(session, { type: 'begin', action: 'sponsors', spendX: 0 });
    session = submit(session, { type: 'sponsor', card: id, source: 'hand' });
    session = settle(session);
    expect(session.state.players[0]!.sponsors).toContain(id);
    expect(session.state.players[0]!.money).toBe(100);
    expect(session.state.players[0]!.buildings.some(building => building.kind === kind)).toBe(true);
    expect(session.state.players[0]!.appeal).toBeGreaterThanOrEqual(1);
  });
  it('澳洲专家育儿袋归属于赞助商，非洲专家机灵等待当前行动完成', () => {
    let australia = readySponsor('212');
    give(australia, '406');
    australia = submit(australia, { type: 'begin', action: 'sponsors', spendX: 0 });
    australia = submit(australia, { type: 'sponsor', card: '212', source: 'hand' });
    australia = resolve(australia, ['printed']);
    expect(australia.state.pending?.prompt).toContain('育儿袋');
    australia = resolve(australia, ['406']);
    expect(australia.state.players[0]!.buried).toContainEqual({ host: '212', card: '406' });
    expect(australia.state.players[0]!.appeal).toBe(3);
    let africa = readySponsor('214');
    africa = playSponsor(africa, '214');
    expect(africa.state.pending).toBeNull();
    expect(africa.state.context?.action).toBe('sponsors');
    africa = submit(africa, { type: 'finish' });
    expect(africa.state.pending?.prompt).toContain('机灵');
    expect(africa.state.players[0]!.row[0]).toBe('sponsors');
  });
  it('水文与地质图标只计一次，按覆盖格数而非邻接地形数量给钱', () => {
    const water = readySponsor('241');
    const waterPlayer = water.state.players[0]!;
    give(water, '241', 'sponsors');
    give(water, '242', 'sponsors');
    expect(tagsOf(waterPlayer).water).toBe(1);
    expect(tagsOf(waterPlayer).rock).toBe(1);
    waterPlayer.row = ['animals', 'cards', 'association', 'sponsors', 'build'];
    waterPlayer.buildings.push({ id: 'path', kind: 'enclosure-1', cells: [{ q: 2, r: 3 }], animals: [] });
    const command = buildCommands(water.state, waterPlayer, 5, false, [], Infinity).find(command =>
      command.kind === 'enclosure-1' && command.q === 3 && command.r === 3)!;
    expect(command).toBeDefined();
    let result = submit(water, { type: 'begin', action: 'build', spendX: 0 });
    result = settle(submit(result, command));
    expect(result.state.players[0]!.money).toBe(99);
    let paid = readySponsor('241');
    paid = playSponsor(paid, '241');
    expect(paid.state.players[0]!.appeal).toBe(1);
    let geology = readySponsor('242');
    give(geology, '444', 'animals');
    geology = playSponsor(geology, '242');
    expect(geology.state.players[0]!.appeal).toBe(3);
  });
  it.each([3, 6])('科学实验室在 %i 个研究图标时的终局收益按规则分档', science => {
    let session = fixture();
    give(session, '201', 'sponsors');
    const player = session.state.players[0]!;
    player.universities = ['science'];
    if (science === 6) {
      player.universities.push('reputation');
      give(session, '223', 'sponsors');
    }
    for (const candidate of session.state.players) {
      session.state.finalDiscard.push(...candidate.finals);
      candidate.finals = [];
    }
    session.state.finalReduced = true;
    player.appeal = 113;
    player.conservation = 1;
    session = submit(session, { type: 'take-x', action: 'animals' });
    session = submit(session, { type: 'take-x', action: 'animals' });
    expect(session.state.phase).toBe('finished');
    expect(tagsOf(session.state.players[0]!).science).toBe(science);
    expect(session.state.players[0]!.conservation).toBe(science === 6 ? 3 : 2);
  });
  it.each([false, true])('欧洲专家终局计分使用户外营地的实际容量，邻门条件=%s', adjacent => {
    let session = fixture('2');
    give(session, '211', 'sponsors');
    const player = session.state.players[0]!;
    player.buildings = [{ q: 0, r: 2 }, { q: 0, r: 3 }, { q: 1, r: 0 }, { q: 2, r: 0 }, adjacent ? { q: 6, r: 1 } : { q: 3, r: 0 }].map((cell, index) => ({
      id: `one-${index}`, kind: 'enclosure-1', cells: [cell], animals: [], occupancy: 1
    }));
    for (const candidate of session.state.players) {
      session.state.finalDiscard.push(...candidate.finals);
      candidate.finals = [];
    }
    session.state.finalReduced = true;
    player.appeal = 113;
    player.conservation = 1;
    session = submit(session, { type: 'take-x', action: 'animals' });
    session = submit(session, { type: 'take-x', action: 'animals' });
    expect(session.state.phase).toBe('finished');
    expect(session.state.players[0]!.conservation).toBe(adjacent ? 1 : 2);
  });
});

describe('阶段四 · 版本、自然结束与回放', () => {
  it('旧阶段三存档拒绝混用新牌池，错误不改写原文件', () => {
    const session = createSession(arkGame, {}, 0);
    const old = JSON.parse(exportArchive(session));
    old.manifest.rulesVersion = 'base-v2-stage-three-1';
    const text = JSON.stringify(old);
    expect(() => importArchive(arkGame, text)).toThrow();
    expect(JSON.stringify(old)).toBe(text);
  });
  it.each(MAP_IDS)('地图 %s 正常设置自然结束，待处理选择与完整记录重放一致', map => {
    let session = createSession(arkGame, { map }, 0);
    let resumed = false;
    for (let count = 0; count < 1500 && session.state.phase !== 'finished'; count += 1) {
      const actor = arkActor(session.state);
      if (!resumed && session.state.pending && session.state.stage !== 'setup') {
        expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
        resumed = true;
      }
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
    expect(session.state.phase).toBe('finished');
    expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
    expect(resumed).toBe(true);
  });
});
