import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { demoGame } from '@eurogame/game-demo';
import { simulate, type Strategy, type SimulationResult } from './index.js';

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '20' },
    'max-decisions': { type: 'string', default: '1500' },
    strategy: { type: 'string', default: 'random' },
    players: { type: 'string', default: '2' },
    output: { type: 'string', default: '.artifacts/simulation' }
  }
});
const count = Number(values.seeds);
const limit = Number(values['max-decisions']);
const playerCount = Number(values.players);
if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 4) throw new Error('players 必须为 2、3 或 4。');
if (!Number.isInteger(count) || count < 1 || count > 10_000 || !Number.isInteger(limit) || limit < 1 || limit > 10_000) throw new Error('seeds 与 max-decisions 必须在 1–10,000 之间。');
if (!['random', 'heuristic'].includes(values.strategy!)) throw new Error('strategy 必须为 random 或 heuristic。');
const output = resolve(values.output!);
await mkdir(output, { recursive: true });
const results: Omit<SimulationResult, 'archive'>[] = [];
for (let seed = 0; seed < count; seed += 1) {
  const result = simulate(seed, limit, values.strategy as Strategy, playerCount);
  const { archive, ...summary } = result;
  results.push(summary);
  if (result.status !== 'finished') {
    await writeFile(resolve(output, `seed-${seed}.replay.json`), archive);
    await writeFile(resolve(output, `seed-${seed}.report.json`), JSON.stringify(summary, null, 2));
  }
}
const summary = {
  manifest: demoGame.manifest,
  strategy: values.strategy, players: playerCount, seeds: count,
  finished: results.filter(result => result.status === 'finished').length,
  truncated: results.filter(result => result.status === 'truncated').length,
  failed: results.filter(result => result.status === 'failed').length,
  wins: Object.fromEntries(Array.from({ length: playerCount }, (_, index) => `p${index + 1}`).map(player => [player, results.filter(result => result.result?.winners.length === 1 && result.result.winners[0] === player).length])),
  ties: results.filter(result => (result.result?.winners.length ?? 0) > 1).length,
  results
};
await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, results: `${output}/summary.json` }, null, 2));
if (summary.failed) process.exitCode = 1;
