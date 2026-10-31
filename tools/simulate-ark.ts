import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { applyCommand, createSession, exportArchive, importArchive, fingerprint } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand } from '@eurogame/game-ark-nova';

const { values } = parseArgs({ options: {
  seeds: { type: 'string', default: '10' },
  'max-decisions': { type: 'string', default: '1500' },
  output: { type: 'string', default: '.artifacts/ark-simulation' },
  map: { type: 'string', default: 'A' }
} });
const seeds = Number(values.seeds);
const limit = Number(values['max-decisions']);
if (values.map !== 'A' && values.map !== '0') throw new Error('map 必须为 A 或 0。');
const map = values.map;
if (!Number.isInteger(seeds) || seeds < 1 || seeds > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error('种子数量或步数上限不正确。');
const output = resolve(values.output!);
await mkdir(output, { recursive: true });
const results: { seed: number; status: string; decisions: number; turns: number; breaks: number; hash: string; error: string | null; result: ReturnType<typeof arkGame.getResult> }[] = [];
for (let seed = 0; seed < seeds; seed += 1) {
  let session = createSession(arkGame, { map }, seed);
  let failure: string | null = null;
  for (let index = 0; index < limit && session.state.phase !== 'finished'; index += 1) {
    try {
      const actor = arkActor(session.state);
      const decision = arkGame.getDecision(session.state, actor);
      if (!decision) throw new Error('对局未结束，但没有可执行决策。');
      const command = chooseArkCommand(arkGame.getPlayerView(session.state, actor), decision);
      const outcome = applyCommand(arkGame, session, { id: `ark-simulation-${index}`, actor, revision: session.state.revision, command });
      if (!outcome.ok) throw new Error(`${JSON.stringify(command)}: ${outcome.error.code}: ${outcome.error.message}`);
      session = outcome.session;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      break;
    }
  }
  const archive = exportArchive(session);
  try {
    if (fingerprint(importArchive(arkGame, archive).state) !== fingerprint(session.state)) throw new Error('回放状态不一致。');
  } catch (error) { failure = error instanceof Error ? error.message : String(error); }
  const result = {
    seed, status: failure ? 'failed' : session.state.phase === 'finished' ? 'finished' : 'truncated',
    decisions: session.commands.length, turns: session.state.turns, breaks: session.state.breaks,
    hash: fingerprint(session.state), error: failure, result: arkGame.getResult(session.state)
  };
  results.push(result);
  if (result.status !== 'finished' || seed === 0) {
    await writeFile(resolve(output, `seed-${seed}.replay.json`), archive);
    await writeFile(resolve(output, `seed-${seed}.report.json`), JSON.stringify(result, null, 2));
  }
  if ((seed + 1) % 5 === 0) console.log(`已验证 ${seed + 1}/${seeds} 个种子。`);
}
const summary = {
  manifest: arkGame.manifest, map, seeds,
  finished: results.filter(result => result.status === 'finished').length,
  truncated: results.filter(result => result.status === 'truncated').length,
  failed: results.filter(result => result.status === 'failed').length,
  results
};
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, results: `${output}/summary.json` }, null, 2));
if (summary.failed || summary.truncated) process.exitCode = 1;
