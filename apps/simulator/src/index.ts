import { applyCommand, createSession, exportArchive, fingerprint, nextRandom } from '@eurogame/engine-core';
import { demoGame, currentActor } from '@eurogame/game-demo';
import { chooseDemoCommand } from '@eurogame/game-demo/ai';

export { createEndgameScenario } from '@eurogame/game-demo';

export type Strategy = 'random' | 'heuristic';
export interface SimulationResult {
  seed: number;
  strategy: Strategy;
  status: 'finished' | 'truncated' | 'failed';
  decisions: number;
  stateHash: string;
  result: ReturnType<typeof demoGame.getResult>;
  error: string | null;
  archive: string;
}
export function simulate(seed: number, maxDecisions = 1_500, strategy: Strategy = 'random', playerCount = 2): SimulationResult {
  let session = createSession(demoGame, { playerCount }, seed);
  let botRng = (seed ^ 0xabcdef01) >>> 0;
  let failure: string | null = null;
  for (let index = 0; index < maxDecisions && session.state.phase !== 'finished'; index += 1) {
    const actor = currentActor(session.state);
    const decision = demoGame.getDecision(session.state, actor);
    if (!decision?.options.length) {
      failure = '对局未结束但不存在合法操作。';
      break;
    }
    const random = nextRandom(botRng);
    botRng = random.rng;
    const command = strategy === 'heuristic'
      ? chooseDemoCommand(demoGame.getPlayerView(session.state, actor), decision)
      : decision.options[Math.floor(random.value * decision.options.length)]!.command;
    const result = applyCommand(demoGame, session, {
      id: `simulation-${index}`, actor, revision: session.state.revision, command
    });
    if (!result.ok) {
      failure = `${result.error.code}: ${result.error.message}`;
      break;
    }
    session = result.session;
  }
  return {
    seed, strategy, status: failure ? 'failed' : session.state.phase === 'finished' ? 'finished' : 'truncated',
    decisions: session.commands.length, stateHash: fingerprint(session.state), result: demoGame.getResult(session.state),
    error: failure, archive: exportArchive(session)
  };
}


