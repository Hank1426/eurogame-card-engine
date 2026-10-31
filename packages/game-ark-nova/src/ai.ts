import type { Decision } from '@eurogame/engine-core';
import { useAction } from './index.js';
import { BASE_PROJECTS, zooCard } from './cards.js';
import { buildingCells } from './board.js';
import { cardActionTable } from './foundation.js';
import { finalCardPoints, housingError, projectMetric, requirementError, tagsOf } from './rules.js';
import type { ArkCommand, ArkPlayer, ArkView } from './types.js';

function cardValue(player: ArkPlayer, id: string): number {
  const card = zooCard(id);
  if (card.kind === 'sponsor') {
    if (id === '220') return 12;
    if (id === '229' || id === '230') return 10;
    if (id === '203') return 9;
    return 5 + (card.tags.includes('science') ? 2 : 0);
  }
  const value = card.appeal + card.conservation * 4 + card.reputation +
    (card.size <= 3 ? 3 : 0) + (card.price <= 12 ? 2 : 0) -
    card.requirements.length * 1.1 - (card.tags.includes('pet') && !player.buildings.some(building => building.kind === 'petting') ? 3 : 0);
  return requirementError(player, id) ? value * 0.2 : value;
}
function affordable(player: ArkPlayer, id: string): boolean {
  const card = zooCard(id);
  const cost = Math.max(0, card.price - card.tags.filter(tag => player.partners.includes(tag)).length * 3 -
    (card.size <= 2 && player.sponsors.includes('229') ? 3 : 0) - (card.size >= 4 && player.sponsors.includes('230') ? 4 : 0));
  return player.money >= cost;
}
function desiredAnimals(player: ArkPlayer): string[] {
  return player.hand.filter(id => zooCard(id).kind === 'animal' && !requirementError(player, id));
}
export function chooseArkCommand(view: ArkView, decision: Decision<ArkCommand>): ArkCommand {
  const player = view.players.find(candidate => candidate.id === decision.actor);
  if (!player || view.actor !== decision.actor || player.hand.length !== player.handCount) throw new Error('AI 需要自己的可见信息与当前决策。');
  const pending = view.pending;
  if (pending) {
    let ranked = [...pending.options];
    const discard = pending.prompt.includes('弃除') && pending.kind !== 'final';
    ranked.sort((left, right) => {
      const value = (candidate: typeof left): number => {
        if (candidate.card && pending.kind === 'final') return finalCardPoints(view, player, candidate.card);
        if (candidate.card) return (discard ? -1 : 1) * cardValue(player, candidate.card);
        if (candidate.id === 'worker') return player.workers < 2 ? 20 : 5;
        if (['animals', 'cards', 'build', 'association', 'sponsors'].includes(candidate.id)) {
          if (pending.prompt.includes('机灵')) {
            const weights: Record<string, number> = { animals: 5, build: 4, association: 4, cards: 2, sponsors: player.money < 10 ? 5 : 2 };
            const row = useAction(player.row, candidate.id as typeof player.row[number]);
            return row.reduce((total, action, index) => total + (weights[action] ?? 0) * index, 0);
          }
          return { animals: 16, cards: 14, build: 12, association: 10, sponsors: 8 }[candidate.id as 'animals'];
        }
        if (candidate.id.endsWith('money-10')) return player.money < 20 ? 12 : 7;
        if (candidate.id.endsWith('x-3')) return player.x < 2 ? 8 : 3;
        if (candidate.id === 'money-5') return 5;
        if (candidate.id.endsWith('draw-3')) return player.hand.length < 3 ? 9 : 3;
        if (candidate.id.endsWith('reputation-2')) return player.reputation < 5 ? 10 : 6;
        if (candidate.id === 'deck') return 5;
        return 0;
      };
      return value(right) - value(left);
    });
    if (pending.prompt.includes('日光浴') || pending.prompt.includes('育儿袋')) {
      ranked = ranked.filter(option => option.card && (cardValue(player, option.card) < 7 || player.hand.length > 5));
    }
    return { type: 'resolve', choiceId: pending.id, options: ranked.slice(0, Math.max(pending.min, Math.min(pending.max, ranked.length))).map(option => option.id) };
  }
  const desired = desiredAnimals(player);
  const missingHousing = desired.filter(id => !player.buildings.some(building => !housingError(building, id)));
  function score(command: ArkCommand): number {
    if (command.type === 'begin') {
      const strength = player!.row.indexOf(command.action) + 1 + command.spendX;
      let value: number;
      if (command.action === 'animals') value = 55;
      else if (command.action === 'association') {
        const project = view.projects.some(current => {
          const spec = BASE_PROJECTS.find(project => project.id === current.id)!;
          return !current.claimed.includes(player!.id) && spec.thresholds.some((need, tier) => tier !== current.blocked && !current.claimed[tier] && projectMetric(player!, spec.tag) >= need);
        });
        value = project && strength >= (player!.sponsors.includes('203') ? 4 : 5) ? 80 : player!.universities.length < 2 && strength >= 4 ? 28 :
          player!.partners.length < 2 && strength >= 3 ? 24 : 12;
      } else if (command.action === 'build') {
        value = missingHousing.filter(id => affordable(player!, id) && (zooCard(id).tags.includes('pet') ? 3 : zooCard(id).size) <= strength)
          .reduce((maximum, id) => Math.max(maximum, 34 + cardValue(player!, id)), 0);
        if (player!.money < 2) value = 0;
      } else if (command.action === 'cards') {
        const table = cardActionTable(strength, player!.upgrades.includes('cards'));
        const net = table.draw - table.discard;
        value = !desired.length ? (net > 0 ? 23 + net * 3 : 3) : player!.hand.length < 2 ? (net > 0 ? 18 + net * 3 : 2) : 2;
      } else {
        const sponsors = player!.hand.filter(id => zooCard(id).kind === 'sponsor' && zooCard(id).strength <= strength + Number(player!.upgrades.includes('sponsors')) && !requirementError(player!, id));
        const playValue = sponsors.reduce((maximum, id) => Math.max(maximum, 18 + cardValue(player!, id) * 1.5), 0);
        value = Math.max(playValue, player!.money < 10 ? 32 + strength : player!.money < 20 ? 12 + strength : 1);
      }
      return value - command.spendX * 2;
    }
    if (command.type === 'animal') return 50 + cardValue(player!, command.card);
    if (command.type === 'build') {
      const cells = buildingCells(command.kind, command, command.rotation, command.flip);
      const matches = desired.filter(id => affordable(player!, id) && !housingError({ id: 'draft', kind: command.kind, cells, animals: [] }, id));
      const matchValue = matches.reduce((maximum, id) => Math.max(maximum, cardValue(player!, id)), 0);
      return matchValue > 0 ? 25 + matchValue - cells.length * 0.5 : command.kind === 'pavilion' ? 1 : -2;
    }
    if (command.type === 'association') {
      if (command.task === 'project') {
        const points = BASE_PROJECTS.find(project => project.id === command.target)!.points[command.tier]!;
        const reward = command.reward === 'income-cp' ? 10 : command.reward === 'income-5' ? 8 : command.reward === 'money-12' ? 6 : 3;
        return points * 10 + reward;
      }
      if (command.task === 'university') return 20 + (command.target === 'science' && (tagsOf(player!).science ?? 0) < 2 ? 8 : command.target === 'reputation' && player!.reputation < 5 ? 7 : 3);
      if (command.task === 'partner') return 15 + player!.hand.filter(id => zooCard(id).tags.includes(command.target)).length * 2;
      return 10;
    }
    if (command.type === 'donate') return 25;
    if (command.type === 'sponsor') return 12 + cardValue(player!, command.card);
    if (command.type === 'income') return player!.money < 15 ? 28 : 2;
    if (command.type === 'draw') return command.source === 'deck' ? 7 : cardValue(player!, command.card);
    if (command.type === 'snap') return cardValue(player!, command.card) + 1;
    if (command.type === 'take-x') return command.action === player!.row[0] ? 0 : -1;
    if (command.type === 'finish') return 0;
    return -5;
  }
  if (!decision.options.length) throw new Error('未结束的对局没有合法操作。');
  let selected = decision.options[0]!;
  let best = score(selected.command);
  for (const option of decision.options.slice(1)) {
    const value = score(option.command);
    if (value > best) { selected = option; best = value; }
  }
  return structuredClone(selected.command);
}
