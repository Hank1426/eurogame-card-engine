import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyCommand, createSession, exportArchive, importArchive } from '@eurogame/engine-core';
import { instanceIds, getCard } from '@eurogame/content';
import { demoGame, createChoiceScenario, currentActor, type DemoSession, type DemoCommand } from './index.js';
import fixedGame from '../../../tests/fixtures/garden-work-game.json';

function submit(session: DemoSession, command: DemoCommand): DemoSession {
  const result = applyCommand(demoGame, session, { id: `test-${session.state.revision}`, actor: currentActor(session.state), revision: session.state.revision, command });
  if (!result.ok) throw new Error(result.error.message);
  return result.session;
}

describe('植序工坊规则', () => {
  it('三人和四人按全部玩家行动后结算轮末，初始卡牌守恒', () => {
    for (const playerCount of [3, 4]) {
      let session = createSession(demoGame, { playerCount, rounds: 2 }, 42);
      expect(session.state.players).toHaveLength(playerCount);
      expect(session.state.deck).toHaveLength(24 - 3 * playerCount - 4);
      for (let index = 0; index < playerCount * 2; index += 1) {
        expect(currentActor(session.state)).toBe(`p${index % playerCount + 1}`);
        session = submit(session, { type: 'work' });
        expect(session.state.round).toBe(index < playerCount - 1 ? 1 : 2);
      }
      expect(session.state.phase).toBe('finished');
      expect(session.state.players.map(player => player.resources)).toEqual(Array.from({ length: playerCount }, () => ({ credits: 9, energy: 3, points: 0 })));
      expect(demoGame.getResult(session.state)?.winners).toHaveLength(playerCount);
    }
    expect(() => createSession(demoGame, { playerCount: 5 }, 42)).toThrow();
  });
  it('按独立人工推演的十二步固定记录完成六轮', () => {
    let session = createSession(demoGame, fixedGame.config, fixedGame.seed);
    for (const command of fixedGame.commands) {
      const outcome = applyCommand(demoGame, session, command);
      if (!outcome.ok) throw new Error(outcome.error.message);
      session = outcome.session;
    }
    expect(session.state).toMatchObject({
      phase: fixedGame.expected.phase, round: fixedGame.expected.round,
      completedTurns: fixedGame.expected.completedTurns
    });
    expect(session.state.players.map(player => player.resources)).toEqual([fixedGame.expected.resources, fixedGame.expected.resources]);
    expect(demoGame.getResult(session.state)?.winners).toEqual(fixedGame.expected.winners);
    expect(importArchive(demoGame, exportArchive(session))).toEqual(session);
  });
  it('支付后中断并可跨两次选择恢复，不重复支付', () => {
    let session = createChoiceScenario();
    session = submit(session, { type: 'play', source: 'hand', instanceId: 'seed-library:1' });
    expect(session.state.players[0]!.resources).toEqual({ credits: 3, energy: 1, points: 1 });
    expect(session.state.completedTurns).toBe(0);
    const saved = exportArchive(session);
    session = importArchive(demoGame, saved);
    expect(session.state.resolution.pending?.prompt).toBe('选择研究方向');
    session = submit(session, { type: 'choose', choiceId: session.state.resolution.pending!.id, optionId: 'cultivate' });
    session = importArchive(demoGame, exportArchive(session));
    expect(session.state.resolution.pending?.prompt).toBe('选择研究收获');
    session = submit(session, { type: 'choose', choiceId: session.state.resolution.pending!.id, optionId: 'publish' });
    expect(session.state.players[0]!.resources).toEqual({ credits: 3, energy: 3, points: 3 });
    expect(session.state.completedTurns).toBe(1);
    expect(currentActor(session.state)).toBe('p2');
    expect(session.state.resolution.queue).toEqual([]);
  });
  it('嵌套选择与错序选择校验', () => {
    const first = 'citizen-science:1';
    let session = createSession(demoGame, { debug: true, deckOrder: [first, ...instanceIds.filter(id => id !== first)] }, 1);
    session = submit(session, { type: 'play', source: 'hand', instanceId: first });
    const staleId = session.state.resolution.pending!.id;
    session = submit(session, { type: 'choose', choiceId: staleId, optionId: 'survey' });
    expect(session.state.resolution.pending?.prompt).toBe('选择调查奖励');
    expect(demoGame.validateCommand(session.state, 'p1', { type: 'work' })?.code).toBe('CHOICE_REQUIRED');
    expect(demoGame.validateCommand(session.state, 'p1', { type: 'choose', choiceId: staleId, optionId: 'knowledge' })?.code).toBe('INVALID_CHOICE');
    session = submit(session, { type: 'choose', choiceId: session.state.resolution.pending!.id, optionId: 'knowledge' });
    expect(session.state.players[0]!.resources.points).toBe(3);
  });
  it('支持由非行动玩家完成待处理选择', () => {
    let session = createChoiceScenario();
    session = submit(session, { type: 'play', source: 'hand', instanceId: 'seed-library:1' });
    session.state.resolution.pending!.actor = 'p2';
    expect(demoGame.getDecision(session.state, 'p1')).toBeNull();
    expect(demoGame.getDecision(session.state, 'p2')?.actor).toBe('p2');
    expect(demoGame.validateCommand(session.state, 'p1', { type: 'work' })?.code).toBe('WRONG_ACTOR');
  });
  it('隐藏手牌和牌库；返回的视图不允许修改原始资源', () => {
    const session = createSession(demoGame, {}, 42);
    const view = demoGame.getPlayerView(session.state, 'p1');
    expect(view.players[0]!.hand).toHaveLength(3);
    expect(view.players[1]!.hand).toHaveLength(0);
    expect(view).not.toHaveProperty('deck');
    expect(view).not.toHaveProperty('rng');
    view.players[0]!.resources.credits = 99;
    expect(session.state.players[0]!.resources.credits).toBe(5);
  });
  it('市场费用多 1，补牌等到所有选择完成', () => {
    const target = 'seed-library:1';
    const rest = instanceIds.filter(id => id !== target);
    const deckOrder = [...rest.slice(0, 6), target, ...rest.slice(6)];
    let session = createSession(demoGame, { debug: true, deckOrder }, 1);
    session = submit(session, { type: 'play', source: 'market', instanceId: target });
    expect(session.state.market[0]).toBeNull();
    expect(session.state.players[0]!.resources.credits).toBe(2);
    while (session.state.resolution.pending) {
      session = submit(session, { type: 'choose', choiceId: session.state.resolution.pending.id, optionId: session.state.resolution.pending.options[0]!.id });
    }
    expect(session.state.market[0]).not.toBeNull();
  });
  it('每轮收入与最后一轮收入均结算；终局不再接受行动', () => {
    const first = 'solar-canopy:1';
    let session = createSession(demoGame, { rounds: 1, debug: true, deckOrder: [first, ...instanceIds.filter(id => id !== first)] }, 1);
    session = submit(session, { type: 'play', source: 'hand', instanceId: first });
    expect(session.state.players[0]!.resources.credits).toBe(2);
    session = submit(session, { type: 'work' });
    expect(session.state.players[0]!.resources.credits).toBe(4);
    expect(demoGame.getResult(session.state)?.winners).toEqual(['p1']);
    expect(demoGame.validateCommand(session.state, 'p1', { type: 'work' })?.code).toBe('FINISHED');
  });
  it('空牌库不能研究，费用不足拒绝打出', () => {
    let session = createSession(demoGame, {}, 42);
    while (session.state.deck.length && session.state.phase === 'playing') session = submit(session, { type: 'research' });
    expect(demoGame.validateCommand(session.state, currentActor(session.state), { type: 'research' })?.code).toBe('EMPTY_DECK');
    const player = session.state.players.find(candidate => candidate.id === currentActor(session.state))!;
    player.resources.credits = 0;
    const card = player.hand.find(id => getCard(id).cost.credits > 0)!;
    expect(demoGame.validateCommand(session.state, player.id, { type: 'play', instanceId: card, source: 'hand' })?.code).toBe('INSUFFICIENT_RESOURCE');
  });
  it('随机合法操作保持不变量并可重放', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), fc.array(fc.nat(1000), { minLength: 1, maxLength: 35 }), (seed, choices) => {
      let session = createSession(demoGame, {}, seed);
      for (const choice of choices) {
        const decision = demoGame.getDecision(session.state, currentActor(session.state));
        if (!decision) break;
        session = submit(session, decision.options[choice % decision.options.length]!.command);
        demoGame.assertInvariants(session.state);
      }
      expect(importArchive(demoGame, exportArchive(session))).toEqual(session);
    }), { numRuns: 100 });
  });
});
