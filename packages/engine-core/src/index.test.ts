import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { demoGame } from '@eurogame/game-demo';
import { applyCommand, createSession, exportArchive, importArchive, forkSessionAt, nextRandom, shuffle, fingerprint, visibleEvents } from './index.js';

describe('确定性与事务', () => {
  it('种子、内容和命令相同则状态一致', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffff_ffff }), seed => {
      const first = createSession(demoGame, {}, seed);
      const second = createSession(demoGame, {}, seed);
      expect(first).toEqual(second);
      expect(shuffle([1, 2, 3, 4, 5], seed)).toEqual(shuffle([1, 2, 3, 4, 5], seed));
      expect(nextRandom(seed).value).toBeGreaterThanOrEqual(0);
      expect(nextRandom(seed).value).toBeLessThan(1);
    }));
  });
  it('拒绝重复、过期、错误操作者与非法参数，保留原始状态', () => {
    const original = createSession(demoGame, {}, 42);
    const before = exportArchive(original);
    const command = { id: 'one', actor: 'p1', revision: 0, command: { type: 'work' } };
    const result = applyCommand(demoGame, original, command);
    expect(result.ok).toBe(true);
    expect(exportArchive(original)).toBe(before);
    if (!result.ok) return;
    expect(applyCommand(demoGame, result.session, command)).toMatchObject({ ok: false, error: { code: 'DUPLICATE_COMMAND' } });
    expect(applyCommand(demoGame, result.session, { ...command, id: 'two' })).toMatchObject({ ok: false, error: { code: 'STALE_REVISION' } });
    expect(applyCommand(demoGame, original, { ...command, actor: 'p2' })).toMatchObject({ ok: false, error: { code: 'WRONG_ACTOR' } });
    expect(applyCommand(demoGame, original, { ...command, command: { type: 'hack' } })).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(applyCommand(demoGame, original, null)).toMatchObject({ ok: false, error: { code: 'INVALID_ENVELOPE' } });
  });
  it('结算异常回滚资源、随机数和事件', () => {
    const original = createSession(demoGame, {}, 123);
    const faulty = {
      ...demoGame,
      applyCommand(state: typeof original.state) {
        state.rng = 999;
        state.players[0]!.resources.credits = 999;
        throw new Error('测试效果失败');
      }
    };
    expect(applyCommand(faulty, original, { id: 'fault', actor: 'p1', revision: 0, command: { type: 'work' } })).toMatchObject({ ok: false, error: { code: 'RESOLUTION_ERROR' } });
    expect(original).toEqual(createSession(demoGame, {}, 123));
  });
  it('存档校验版本及快照，不接受伪造状态', () => {
    const session = createSession(demoGame, {}, 42);
    expect(importArchive(demoGame, exportArchive(session))).toEqual(session);
    const archive = JSON.parse(exportArchive(session));
    archive.snapshot.players[0].resources.credits = 900;
    expect(() => importArchive(demoGame, JSON.stringify(archive))).toThrow('不一致');
    archive.manifest.rulesVersion = 'unknown';
    expect(() => importArchive(demoGame, JSON.stringify(archive))).toThrow('不兼容');
    expect(() => importArchive(demoGame, 'x'.repeat(5_000_001))).toThrow('5 MB');
  });
  it('旧双人存档缺省人数时仍可重放恢复', () => {
    const original = createSession(demoGame, {}, 42);
    const archive = JSON.parse(exportArchive(original));
    delete archive.config.playerCount;
    const restored = importArchive(demoGame, JSON.stringify(archive));
    expect(restored.config.playerCount).toBe(2);
    expect(restored.state).toEqual(original.state);
  });
  it('回退生成独立分支并保留原始命令', () => {
    const initial = createSession(demoGame, {}, 1);
    const result = applyCommand(demoGame, initial, { id: 'work', actor: 'p1', revision: 0, command: { type: 'work' } });
    if (!result.ok) throw new Error('expected success');
    const fork = forkSessionAt(demoGame, result.session, 0);
    expect(fork.state).toEqual(initial.state);
    expect(fork.branch.parent).toBe('main');
    expect(result.session.commands).toHaveLength(1);
    expect(importArchive(demoGame, exportArchive(fork))).toEqual(fork);
  });
  it('结构指纹与键顺序无关，日志按可见性过滤', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
    const events = [
      { type: 'public', message: '公开', audience: 'public' as const, revision: 0 },
      { type: 'secret', message: '私密', audience: ['p1'], revision: 0 }
    ];
    expect(visibleEvents(events, 'p2')).toHaveLength(1);
    expect(visibleEvents(events, null)).toHaveLength(1);
    expect(visibleEvents(events, 'p1')).toHaveLength(2);
  });
});
