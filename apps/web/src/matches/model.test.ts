import { expect, it } from 'vitest';
import { createSession, exportArchive } from '@eurogame/engine-core';
import { demoGame } from '@eurogame/game-demo';
import { arkGame } from '@eurogame/game-ark-nova';
import { gameById, restoreGame } from '../catalog/games.js';
import { makeMatch, summarizeLegacy } from './model.js';

it('对局 ID 独立于游戏种子、规则版本和分支 ID', async () => {
  const runtime = (await gameById('garden-lab').load()).create({ game: 'garden-lab', playerCount: 2, seed: 42, mode: 'ai' });
  const a = makeMatch(runtime); const b = makeMatch(runtime);
  expect(a.id).not.toBe(b.id);
  expect(a.manifest).toEqual(runtime.manifest);
  expect(a.seats.map(seat => seat.controller)).toEqual(['human', 'ai']);
  expect(JSON.parse(runtime.archive).branch.id).toBe('main');
});

it('摘要兼容双方游戏进度，未知游戏明确拒绝，旧版本仍能列出但拒绝恢复', async () => {
  const demo = exportArchive(createSession(demoGame, {}, 42));
  const ark = exportArchive(createSession(arkGame, { map: '0' }, 43));
  expect(summarizeLegacy(demo).summary.progress).toContain('轮');
  expect(summarizeLegacy(ark).summary).toMatchObject({ map: '0', seed: 43 });
  const old = JSON.parse(demo); old.manifest.rulesVersion = 'old';
  expect(summarizeLegacy(JSON.stringify(old)).manifest.rulesVersion).toBe('old');
  await expect(restoreGame(JSON.stringify(old))).rejects.toThrow('版本不兼容');
  old.manifest.gameId = 'missing';
  await expect(restoreGame(JSON.stringify(old))).rejects.toThrow('未知游戏');
});
