import { applyCommand, createSession } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, type ArkSession, type ArkCommand } from '@eurogame/game-ark-nova';

export function arkSubmit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `checkpoint-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.session;
}
export function preparedArk(seed: number, keep: string[] = []): ArkSession {
  let session = createSession(arkGame, {}, seed);
  const hand = session.state.players[0]!.hand;
  const selected = [...keep, ...hand.filter(id => !keep.includes(id))].slice(0, 4);
  session = arkSubmit(session, { type: 'resolve', choiceId: session.state.pending!.id, options: selected });
  const actor = arkActor(session.state);
  session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  return session;
}
export function naturalCheckpoint(predicate: (session: ArkSession) => boolean, seeds = [0, 1, 2, 3]): ArkSession {
  for (const seed of seeds) {
    let session = createSession(arkGame, {}, seed);
    for (let step = 0; step < 1500; step += 1) {
      if (predicate(session)) return session;
      if (session.state.phase === 'finished') break;
      const actor = arkActor(session.state);
      session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
    }
  }
  throw new Error('在固定正常对局中没有找到验收场景。');
}
