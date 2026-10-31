import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, zooCard, buildCommands, buildingCells, housingError, type ArkSession, type ArkCommand } from './index.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `interaction-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.message}`);
  return outcome.session;
}
function resolve(session: ArkSession, options: string[]) { return submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options }); }
function fixture(): ArkSession {
  let session = createSession(arkGame, {}, 42);
  while (session.state.pending) session = resolve(session, session.state.pending.options.slice(0, session.state.pending.min).map(option => option.id));
  return session;
}
function give(session: ArkSession, id: string, zone: 'hand' | 'animals' | 'sponsors' = 'hand', player = session.state.players[0]!) {
  session.state.deck = session.state.deck.filter(card => card !== id);
  session.state.discard = session.state.discard.filter(card => card !== id);
  session.state.market = session.state.market.map(card => card === id ? null : card);
  for (const other of session.state.players) for (const existing of ['hand', 'animals', 'sponsors'] as const) other[existing] = other[existing].filter(card => card !== id);
  player[zone].push(id);
}
function prepare(id: string): ArkSession {
  const session = fixture();
  const player = session.state.players[0]!;
  give(session, id);
  for (const prerequisite of ['486', '487', '488', '455', '460']) if (prerequisite !== id) give(session, prerequisite, 'animals');
  player.money = 100; player.appeal = 6;
  player.upgrades = ['animals', 'build', 'cards'];
  player.universities = ['science'];
  player.partners = ['africa', 'australia', 'americas', 'europe'];
  player.row = ['build', 'cards', 'association', 'sponsors', 'animals'];
  session.state.players[1]!.appeal = 8;
  session.state.players[1]!.conservation = 1;
  const command = buildCommands(session.state, player, 5, true, [], Infinity).find(command => command.kind === 'enclosure-5' && !housingError({ id: 'home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] }, id))!;
  player.buildings.push({ id: 'home', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] });
  return session;
}
function play(session: ArkSession, id: string): ArkSession {
  session = submit(session, { type: 'begin', action: 'animals', spendX: 0 });
  return submit(session, { type: 'animal', card: id, source: 'hand', building: 'home' });
}
describe('互动动物 · 时序、标记和信息边界', () => {
  it.each([['A', 86], ['1', 59]] as const)('地图 %s 种子 %i 的 AI 不再反复支付不足并撤销', (map, seed) => {
    let session = createSession(arkGame, { map }, seed);
    for (let count = 0; count < 1500 && session.state.phase !== 'finished'; count += 1) {
      const actor = arkActor(session.state);
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
    expect(session.state.phase).toBe('finished');
    expect(session.commands.filter(command => command.command.type === 'resolve' && command.command.options.includes('undo-turn')).length).toBeLessThan(3);
    expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
  });
  it.each(['449', '470', '492'])('%s 毒液按收益前后选择目标，标记只加在最低槽卡且不重复', id => {
    const initial = prepare(id);
    let first = play(initial, id);
    expect(first.state.pending!.options.map(option => option.id)).toEqual(['attack-first', 'rewards-first']);
    first = resolve(first, ['attack-first']);
    expect(first.state.venom.p2).toEqual(initial.state.players[1]!.row.slice(0, id === '449' ? 1 : 2));
    const later = resolve(play(initial, id), ['rewards-first']);
    expect(later.state.venom.p2 ?? []).toEqual([]);
    expect(later.state.players[0]!.appeal).toBe(6 + zooCard(id).appeal);
  });
  it.each(['474', '482', '483'])('%s 缠绕按领先轨道数作用于最高槽，最高值两轨可产生两枚', id => {
    let session = prepare(id);
    session = resolve(play(session, id), ['attack-first']);
    expect(session.state.constriction.p2).toEqual(session.state.players[1]!.row.slice(3));
    session = submit(session, { type: 'finish' });
    const action = session.state.players[1]!.row[4]!;
    if (action === 'build' || action === 'sponsors' || action === 'cards' || action === 'association') {
      const result = arkGame.validateCommand(session.state, 'p2', { type: 'begin', action, spendX: 0 });
      if (!result) {
        session = submit(session, { type: 'begin', action, spendX: 0 });
        expect(session.state.context?.strength).toBe(3);
      }
    }
  });
  it('检疫实验室与低于五魅力的对手免疫毒液和缠绕', () => {
    for (const immune of [true, false]) {
      let session = prepare('470');
      if (immune) give(session, '225', 'sponsors', session.state.players[1]!);
      else session.state.players[1]!.appeal = 4;
      session = resolve(play(session, '470'), ['attack-first']);
      expect(session.state.venom.p2 ?? []).toEqual([]);
    }
  });
  it('执行中毒行动或替代 X 可移除标记，未移除回合末支付两资金', () => {
    let session = fixture();
    session.state.venom.p1 = ['animals'];
    const before = session.state.players[0]!.money;
    session = submit(session, { type: 'take-x', action: 'animals' });
    expect(session.state.venom.p1).toEqual([]);
    expect(session.state.players[0]!.money).toBe(before);
    let paid = fixture();
    paid.state.venom.p1 = ['animals'];
    paid = submit(paid, { type: 'take-x', action: 'cards' });
    expect(paid.state.players[0]!.money).toBe(23);
    expect(paid.state.venom.p1).toEqual(['animals']);
  });
  it('毒液费用不足可撤销整个回合并重选，原随机数和牌区恢复', () => {
    let session = fixture();
    session.state.venom.p1 = ['animals'];
    session.state.players[0]!.money = 1;
    const rng = session.state.rng;
    const hand = [...session.state.players[0]!.hand];
    session = submit(session, { type: 'take-x', action: 'cards' });
    expect(session.state.pending?.prompt).toContain('撤销整个回合');
    session = resolve(session, ['undo-turn']);
    expect(session.state.players[0]!.x).toBe(0);
    expect(session.state.players[0]!.money).toBe(1);
    expect(session.state.players[0]!.hand).toEqual(hand);
    expect(session.state.rng).toBe(rng);
    expect(session.state.activePlayer).toBe('p1');
    expect(session.state.turns).toBe(0);
    session = submit(session, { type: 'take-x', action: 'animals' });
    expect(session.state.turns).toBe(1);
  });
  it('缠绕卡移到低槽后强度不足不能使用，但可替代拿 X 并移除', () => {
    let session = fixture();
    const action = session.state.players[0]!.row[0]!;
    session.state.constriction.p1 = [action];
    expect(arkGame.validateCommand(session.state, 'p1', { type: 'begin', action, spendX: 0 })?.message).toContain('强度不足');
    session = submit(session, { type: 'take-x', action });
    expect(session.state.constriction.p1).toEqual([]);
  });
  it.each(['456', '458', '463'])('%s 偷窃由受影响玩家选择，随机手牌只向相关玩家显示', id => {
    let session = play(prepare(id), id);
    session = resolve(session, ['attack-first']);
    expect(session.state.pending?.actor).toBe('p2');
    const before = session.state.players[1]!.hand.length;
    const rng = session.state.rng;
    expect(arkGame.getPlayerView(session.state, 'p1').pending!.options).toEqual([]);
    session = resolve(session, ['card']);
    expect(session.state.players[1]!.hand).toHaveLength(before - 1);
    expect(session.state.rng).not.toBe(rng);
    expect(session.events.find(event => event.type === 'cards.private' && event.message.startsWith('偷窃卡牌'))?.audience).toEqual(['p1', 'p2']);
    if (id === '458') {
      expect(session.state.pending?.actor).toBe('p2');
      const money = session.state.players[1]!.money;
      session = resolve(session, ['money']);
      expect(session.state.players[1]!.money).toBe(money - 5);
    }
  });
  it('对手既无手牌又不足五资金时转移其全部剩余资金', () => {
    let session = prepare('456');
    session.state.discard.push(...session.state.players[1]!.hand.splice(0));
    session.state.players[1]!.money = 2;
    session = resolve(play(session, '456'), ['attack-first']);
    expect(session.state.pending!.options).toHaveLength(1);
    session = resolve(session, ['money']);
    expect(session.state.players[1]!.money).toBe(0);
  });
  it.each(['475', '485'])('%s 催眠执行对手行动卡对应等级，完成后移动对手卡且不消耗其双重', id => {
    let session = prepare(id);
    session.state.players[1]!.row = ['sponsors', 'cards', 'build', 'animals', 'association'];
    session.state.players[1]!.upgrades = ['sponsors'];
    session.state.players[1]!.doubleTokens = ['sponsors'];
    session = resolve(play(session, id), ['attack-first']);
    session = submit(session, { type: 'finish' });
    expect(session.state.pending?.prompt).toContain('催眠');
    session = resolve(session, ['hypnosis-sponsors-0']);
    expect(session.state.context?.upgraded).toBe(true);
    expect(session.state.context?.strength).toBe(1);
    expect(session.state.context?.cardOwner).toBe('p2');
    const ownRow = [...session.state.players[0]!.row];
    session = submit(session, { type: 'income' });
    expect(session.state.players[0]!.row).toEqual(ownRow);
    expect(session.state.players[1]!.doubleTokens).toEqual(['sponsors']);
    expect(session.state.turns).toBe(1);
  });
  it('正常互动局从中途选择恢复并完整重放', () => {
    for (let seed = 0; seed < 8; seed += 1) {
      let session = createSession(arkGame, {}, seed);
      for (let count = 0; count < 1500 && session.state.phase !== 'finished'; count += 1) {
        if (session.state.pending?.prompt.includes('互动效果')) {
          expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
          return;
        }
        const actor = arkActor(session.state);
        session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
      }
    }
    throw new Error('未找到正常互动局。');
  });
});
