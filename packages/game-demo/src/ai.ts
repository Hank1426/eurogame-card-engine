import type { Decision } from '@eurogame/engine-core';
import { getCard, type Effect, type Resource } from '@eurogame/content';
import { playCost, type DemoCommand, type DemoView, type PlayerView } from './index.js';

export const BASIC_AI_VERSION = 'basic-v1';

export function chooseDemoCommand(view: DemoView, decision: Decision<DemoCommand>): DemoCommand {
  const player = view.players.find(candidate => candidate.id === decision.actor);
  if (!player || player.hand.length !== player.handCount) throw new Error('AI 需要自己座位的玩家视图。');
  if (view.phase !== 'playing' || (view.pending?.actor ?? view.activePlayer) !== decision.actor || !decision.options.length) {
    throw new Error('AI 当前没有合法决策。');
  }
  const roundsLeft = view.roundLimit - view.round;
  function resourceValue(resource: Resource): number {
    if (resource === 'points') return 1;
    if (!roundsLeft) return 0.02;
    if (resource === 'credits') return player!.resources.credits < 6 ? 0.45 : 0.2;
    return player!.resources.energy < 2 ? 0.6 : 0.2;
  }
  function effectsValue(effects: Effect[]): number {
    return effects.reduce((total, effect) => {
      switch (effect.type) {
        case 'gain': return total + effect.amount * resourceValue(effect.resource);
        case 'registerIncome': return total + effect.amount * resourceValue(effect.resource) * (roundsLeft + 1);
        case 'draw': return total + drawValue(player!, effect.count, roundsLeft);
        case 'sequence': return total + effectsValue(effect.effects);
        case 'choice': return total + Math.max(...effect.options.map(option => effectsValue(option.effects)));
      }
    }, 0);
  }
  function score(command: DemoCommand): number {
    switch (command.type) {
      case 'play': {
        const cost = playCost(command.instanceId, command.source);
        const expense = Object.entries(cost).reduce((total, [resource, amount]) => total + amount * resourceValue(resource as Resource), 0);
        return effectsValue(getCard(command.instanceId).effects) - expense * 0.2 + 0.25;
      }
      case 'choose': {
        const option = view.pending?.options.find(candidate => candidate.id === command.optionId);
        if (!option) throw new Error('AI 选择与玩家视图不一致。');
        return effectsValue(option.effects);
      }
      case 'research': return drawValue(player!, Math.min(2, view.deckCount), roundsLeft);
      case 'work': return 2 * resourceValue('credits') + resourceValue('energy');
      case 'debug.adjust': return -Infinity;
    }
  }
  let best = decision.options[0]!;
  let bestScore = score(best.command);
  for (const option of decision.options.slice(1)) {
    const value = score(option.command);
    if (value > bestScore) {
      best = option;
      bestScore = value;
    }
  }
  return structuredClone(best.command);
}

function drawValue(player: PlayerView, count: number, roundsLeft: number): number {
  if (!roundsLeft) return 0;
  return count * (player.handCount < 2 ? 1.1 : player.handCount < 4 ? 0.55 : 0.15);
}
