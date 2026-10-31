import { applyCommand, createSession } from '@eurogame/engine-core';
import { arkGame, arkActor, chooseArkCommand, buildCommands, buildingCells, housingError, zooCard, freedEnclosures, type ArkSession, type ArkCommand } from '@eurogame/game-ark-nova';

export function arkSubmit(session: ArkSession, command: ArkCommand): ArkSession {
  const outcome = applyCommand(arkGame, session, { id: `checkpoint-${session.state.revision}`, actor: arkActor(session.state), revision: session.state.revision, command });
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.session;
}
export function specialHallCheckpoint() {
  function placementFor(current: ArkSession) {
    const player = current.state.players[0]!;
    const ready = !current.state.pending && !current.state.context && current.state.activePlayer === 'p1' &&
      player.upgrades.includes('build') && player.row.indexOf('build') + 1 + player.x >= 5 && player.money >= 10 &&
      player.animals.some(id => zooCard(id).specialHousing && freedEnclosures(player, id).length > 0);
    if (!ready) return null;
    const builds = buildCommands(current.state, player, 5, true, [], Infinity);
    for (const command of builds.filter(command => command.kind === 'aviary' || command.kind === 'reptile-house')) {
      const building = { id: 'preview', kind: command.kind, cells: buildingCells(command.kind, command, command.rotation, command.flip), animals: [] };
      const animal = player.animals.find(id => zooCard(id).specialHousing?.kind === command.kind && !housingError(building, id, player.map) && freedEnclosures(player, id).length > 0);
      if (animal) return { build: command, animal, spendX: Math.max(0, 5 - (player.row.indexOf('build') + 1)) };
    }
    return null;
  }
  const session = naturalCheckpoint(current => Boolean(placementFor(current)), [0, 1, 2, 3, 4, 5, 6, 7]);
  const placement = placementFor(session);
  if (!placement) throw new Error('检查点没有可转移动物的合法特殊馆位置。');
  return { session, ...placement };
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
export function terrainCheckpoint(valid: boolean): ArkSession {
  let seed = 0;
  while (seed < 10_000) {
    const state = createSession(arkGame, {}, seed).state;
    if (state.players[0]!.hand.includes('421') && state.players[0]!.row.indexOf('build') === 4) break;
    seed += 1;
  }
  if (seed === 10_000) throw new Error('没有找到海狗与强度 5 建造的起始种子。');
  let session = preparedArk(seed, ['421']);
  session = arkSubmit(session, { type: 'begin', action: 'build', spendX: 0 });
  session = arkSubmit(session, { type: 'build', kind: 'enclosure-5', q: valid ? 2 : 3, r: valid ? 1 : 3, rotation: valid ? 1 : 3, flip: false });
  while (arkActor(session.state) !== 'p1' || session.state.pending || session.state.context) {
    const actor = arkActor(session.state);
    session = arkSubmit(session, chooseArkCommand(arkGame.getPlayerView(session.state, actor), arkGame.getDecision(session.state, actor)!));
  }
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
