import { describe, expect, it } from 'vitest';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, CARD_IDS, FINAL_CARDS, availableWorkers, type ArkSession, type ArkCommand } from './index.js';

function submit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, {
    id: `test-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command
  });
  if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.code}: ${outcome.error.message}`);
  return outcome.session;
}
function setup(seed = 42): ArkSession {
  let session = createSession(arkGame, {}, seed);
  for (let index = 0; index < 2; index += 1) {
    const pending = session.state.pending!;
    session = submit(session, { type: 'resolve', choiceId: pending.id, options: pending.options.slice(0, 4).map(option => option.id) });
  }
  return session;
}
describe('阶段一 · 双人设置与行动事务', () => {
  it('设置依次八选四，市场直到双方选完才公开', () => {
    let session = createSession(arkGame, {}, 42);
    expect(session.state.players.map(player => player.hand.length)).toEqual([8, 8]);
    expect(session.state.players.map(player => player.money)).toEqual([25, 25]);
    expect(session.state.players.map(player => player.appeal)).toEqual([0, 1]);
    expect(session.state.players.map(player => player.reputation)).toEqual([1, 1]);
    expect(session.state.market).toEqual([null, null, null, null, null, null]);
    expect(session.state.projects.map(project => project.blocked)).toEqual([0, 1, 2]);
    const pending = session.state.pending!;
    expect(applyCommand(arkGame, session, { id: 'invalid', actor: 'p1', revision: 0, command: { type: 'resolve', choiceId: pending.id, options: [pending.options[0]!.id] } })).toMatchObject({ ok: false });
    session = submit(session, { type: 'resolve', choiceId: pending.id, options: pending.options.slice(0, 4).map(option => option.id) });
    session = importArchive(arkGame, exportArchive(session));
    expect(session.state.pending?.actor).toBe('p2');
    expect(session.state.market.filter(Boolean)).toHaveLength(0);
    session = submit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: session.state.pending!.options.slice(0, 4).map(option => option.id) });
    expect(session.state.stage).toBe('turn');
    expect(session.state.market.filter(Boolean)).toHaveLength(6);
    expect(session.state.discard).toHaveLength(8);
    expect(session.state.deck.length + 8 + 8 + 6).toBe(CARD_IDS.length);
    expect(session.state.finalDeck.length + 4).toBe(FINAL_CARDS.length);
  });
  it('建造费用原子支付，旋转与非法放置不影响状态或随机数', () => {
    let session = setup();
    const originalRow = [...session.state.players[0]!.row];
    session = submit(session, { type: 'begin', action: 'build', spendX: 0 });
    const before = exportArchive(session);
    const bad: ArkCommand = { type: 'build', kind: 'enclosure-1', q: 1, r: 0, rotation: 0, flip: false };
    expect(applyCommand(arkGame, session, { id: 'bad', actor: 'p1', revision: session.state.revision, command: bad })).toMatchObject({ ok: false });
    expect(exportArchive(session)).toBe(before);
    session = submit(session, { type: 'build', kind: 'enclosure-1', q: 0, r: 2, rotation: 4, flip: true });
    expect(session.state.players[0]!.money).toBe(23);
    expect(session.state.players[0]!.buildings).toHaveLength(3);
    expect(session.state.players[0]!.row).toEqual(['build', ...originalRow.filter(action => action !== 'build')]);
    expect(session.state.activePlayer).toBe('p2');
  });
  it('玩家视图、私密日志、牌序与选择选项按座位隔离', () => {
    const session = createSession(arkGame, {}, 1);
    const view = arkGame.getPlayerView(session.state, 'p2');
    expect(view.players[0]!.hand).toEqual([]);
    expect(view.players[0]!.finals).toEqual([]);
    expect(view.pending!.options).toEqual([]);
    expect(view.pending).not.toHaveProperty('effects');
    expect(view).not.toHaveProperty('deck');
    expect(view).not.toHaveProperty('rng');
  });
  it('X 替代移动行动卡且不能超过上限', () => {
    let session = setup();
    session = submit(session, { type: 'take-x', action: 'animals' });
    expect(session.state.players[0]!.x).toBe(1);
    expect(session.state.turns).toBe(1);
    const before = exportArchive(session);
    expect(applyCommand(arkGame, session, { id: 'not-your-turn', actor: 'p1', revision: session.state.revision, command: { type: 'take-x', action: 'cards' } })).toMatchObject({ ok: false });
    expect(exportArchive(session)).toBe(before);
    expect(availableWorkers(session.state.players[0]!)).toBe(1);
  });
});

describe('阶段二 · 可玩闭环初检', () => {
  it('种子 6 不再因抓一弃一并保留不满足条件的牌而空转', () => {
    let session = createSession(arkGame, {}, 6);
    for (let count = 0; count < 1000 && session.state.phase !== 'finished'; count += 1) {
      const actor = arkActor(session.state);
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
    expect(session.state.phase).toBe('finished');
    expect(session.state.players.some(player => player.upgrades.length > 0)).toBe(true);
  });
  it('固定种子可通过合法命令自然结束，保持卡牌与地图不变量', () => {
    let session = createSession(arkGame, {}, 42);
    for (let count = 0; count < 800 && session.state.phase !== 'finished'; count += 1) {
      const actor = arkActor(session.state);
      const decision = arkGame.getDecision(session.state, actor)!;
      session = submit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), decision));
    }
    expect(session.state.phase).toBe('finished');
    expect(session.state.breaks).toBeGreaterThan(0);
    expect(session.state.players.some(player => player.animals.length > 0)).toBe(true);
    expect(importArchive(arkGame, exportArchive(session))).toEqual(session);
  });
});
