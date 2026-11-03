import { ENGINE_VERSION, fingerprint, shuffle, nextRandom, type Decision, type GameModule, type QueueItem, type RuleError } from '@eurogame/engine-core';
import { hexKey, hexNeighbors } from '@eurogame/mechanisms';
import { ARK_ACTIONS, useAction } from './index.js';
import { ACTION_NAMES, animalCapacity, cardActionTable, initialActionRow, selectAction } from './foundation.js';
import { ANIMAL_TAGS, BASE_PROJECTS, DECK_PROJECTS, CARD_IDS, CONTINENTS, FINAL_CARDS, TAG_NAMES, ZOO_CARDS, zooCard, type ZooCard } from './cards.js';
import { adjacentTerrain, housingCapacity, buildingCells, BUILDING_NAMES, BUILDING_SHAPES, BUILDING_SUPPLY, MAPS, MAP_INFO, nextToLandmark, mapCells, placementError, startingBuildings, victoryScore } from './board.js';
import { animalCost, allTerrainConnected, arkActor, arkPlayer, availableWorkers, buildCommands, donationCost, finalCardPoints, handLimit, housingError, canFlock, uniqueCommands, projectById, projectMetric, projectRewardsFor, projectRequirementError, freedEnclosures, releaseHousing, buildingUsedSpace, PROJECT_REWARD_NAMES, reputationRange, requirementError, strengthFor, tagsOf, UNIVERSITY_NAMES, workerCost } from './rules.js';
import { uniqueKind, uniqueSpec } from './unique-buildings.js';
import { connectedSpaces, newSponsorFinalAppeal, newSponsorFinalPoints } from './sponsor-metrics.js';
import { breakIncome, FUNDING_TAGS as fundingTags } from './income.js';
import { BONUS_TILES, BONUS_NAMES } from './bonuses.js';
import { arkCommandSchema, arkConfigSchema, type ArkChoice, type ArkChoiceOption, type ArkCommand, type ArkConfig, type ArkEffect, type ArkEvent, type ArkPlayer, type ArkState, type ArkView } from './types.js';

export interface ArkResult {
  winners: string[];
  scores: { player: string; appeal: number; conservation: number; points: number; projects: number }[];
}
const resourceNames = { money: '资金', appeal: '魅力', conservation: '保护', reputation: '声望', x: 'X' };
const expertTags: Record<string, string> = { '236': 'primate', '237': 'reptile', '238': 'bird', '239': 'predator', '240': 'herbivore' };
const continentExperts: Record<string, string> = { '210': 'americas', '211': 'europe', '212': 'australia', '213': 'asia', '214': 'africa' };
const abilityActions: Record<string, typeof ARK_ACTIONS[number]> = { ASSOCIATION: 'association', ANIMAL: 'animals', BUILDING: 'build', CARD: 'cards', SPONSORS: 'sponsors' };

function item(actor: string, effect: ArkEffect): QueueItem<ArkEffect> { return { actor, effect }; }
function event(type: string, message: string, audience: ArkEvent['audience'] = 'public'): ArkEvent { return { type, message, audience }; }
function ruleError(message: string, code = 'ILLEGAL_ACTION'): RuleError { return { code, message }; }
function doubleUses(command: Extract<ArkCommand, { type: 'begin' | 'take-x' }>): number { return command.doubleCount ?? (command.useDouble ? 1 : 0); }
function consumeDoubles(player: ArkPlayer, action: typeof ARK_ACTIONS[number], count: number) {
  for (let index = 0; index < count; index += 1) player.doubleTokens.splice(player.doubleTokens.indexOf(action), 1);
}
function actionStrength(state: ArkState, player: ArkPlayer, action: typeof ARK_ACTIONS[number], spendX: number) {
  return strengthFor(player, action, spendX) - (state.constriction[player.id]?.includes(action) ? 2 : 0);
}
function clearActionToken(state: ArkState, owner: string, action: typeof ARK_ACTIONS[number]) {
  if (state.venom[owner]?.includes(action)) {
    state.venom[owner] = state.venom[owner]!.filter(token => token !== action);
    state.venomRemoved = true;
  }
}
function affected(state: ArkState, source: ArkPlayer, metric: 'appeal' | 'conservation'): ArkPlayer | null {
  const candidates = state.players.filter(player => !player.sponsors.includes('225') && (player.id === source.id || player.appeal >= 5) && (metric === 'appeal' ? player.appeal >= 5 : player.conservation >= 1));
  const maximum = Math.max(...candidates.map(player => player[metric]));
  const other = candidates.find(player => player.id !== source.id && player[metric] === maximum);
  return other ?? null;
}
function prepend(state: ArkState, effects: QueueItem<ArkEffect>[]) { state.queue.unshift(...effects); }
function gainItem(actor: string, resource: Extract<ArkEffect, { type: 'gain' }>['resource'], amount: number) { return item(actor, { type: 'gain', resource, amount }); }
function cardIcons(card: ZooCard): string[] { return [...card.tags.filter(tag => tag !== 'water' && tag !== 'rock'), ...Array.from({ length: card.water }, () => 'water'), ...Array.from({ length: card.rock }, () => 'rock')]; }
function registerSponsor(state: ArkState, player: ArkPlayer, id: string) {
  player.sponsors.push(id);
  if (['215', '218', '253'].includes(id)) player.sponsorTokens = { ...player.sponsorTokens, [id]: id === '253' ? 3 : 2 };
  const kind = uniqueKind(id);
  if (kind) state.requiredBuildings.push({ actor: player.id, kind });
}
function makeChoice(state: ArkState, actor: string, prompt: string, options: ArkChoiceOption[], min = 1, max = 1, kind: ArkChoice['kind'] = 'normal') {
  if (!options.length) return;
  state.choiceSequence += 1;
  state.pending = { id: `ark-choice-${state.choiceSequence}`, actor, prompt, kind, options, min: Math.min(min, options.length), max: Math.min(max, options.length) };
}
function option(id: string, label: string, effects: QueueItem<ArkEffect>[], card: string | null = null): ArkChoiceOption { return { id, label, effects, card }; }
function reshuffle(state: ArkState) {
  if (!state.deck.length && state.discard.length) {
    const shuffled = shuffle(state.discard, state.rng);
    state.deck = shuffled.values;
    state.rng = shuffled.rng;
    state.discard = [];
  }
}
function draw(state: ArkState, count: number): string[] {
  const result: string[] = [];
  for (let index = 0; index < count; index += 1) {
    reshuffle(state);
    const card = state.deck.shift();
    if (!card) break;
    result.push(card);
  }
  return result;
}
function refill(state: ArkState) {
  const cards = state.market.filter(card => card !== null);
  cards.push(...draw(state, 6 - cards.length));
  state.market = Array.from({ length: 6 }, (_, index) => cards[index] ?? null);
}
function drawToHand(state: ArkState, player: ArkPlayer, count: number, events: ArkEvent[]) {
  const cards = draw(state, count);
  player.hand.push(...cards);
  events.push(event('cards.draw', `${player.name} 抽取 ${cards.length} 张卡牌。`));
  if (cards.length) events.push(event('cards.private', cards.map(id => zooCard(id).name).join('、'), [player.id]));
}
type Trigger = Extract<ArkEffect, { type: 'trigger-order' }>['triggers'][number];
function orderedEffects(actor: string, triggers: Trigger[]): QueueItem<ArkEffect>[] {
  if (triggers.length === 0) return [];
  if (triggers.length === 1) return triggers[0]!.effects;
  return [item(actor, { type: 'trigger-order', triggers })];
}
function iconEffects(state: ArkState, player: ArkPlayer, tags: string[], immediate: QueueItem<ArkEffect>[] = []): QueueItem<ArkEffect>[] {
  const triggers: Trigger[] = immediate.length ? [{ id: 'printed', label: '结算卡面／获得组件的奖励', effects: immediate }] : [];
  const science = tags.filter(tag => tag === 'science').length;
  for (const sponsor of player.sponsors) {
    const effects: QueueItem<ArkEffect>[] = [];
    if (science && sponsor === '202') effects.push(gainItem(player.id, 'reputation', science));
    if (science && sponsor === '204') effects.push(gainItem(player.id, 'conservation', science));
    if (science && sponsor === '208') effects.push(gainItem(player.id, 'money', science * 2));
    const multiplierTags: Record<string, string> = { '243': 'herbivore', '244': 'bird', '245': 'water', '246': 'rock', '247': 'primate', '248': 'primate', '249': 'bird', '250': 'reptile', '251': 'bear', '252': 'predator', '253': 'herbivore' };
    const matches = tags.filter(tag => tag === multiplierTags[sponsor]).length;
    for (let index = 0; index < matches; index += 1) {
      if (['243', '244', '245', '246', '247', '251'].includes(sponsor)) effects.push(gainItem(player.id, 'appeal', 2));
      if (sponsor === '248') effects.push(gainItem(player.id, 'x', 1));
      if (sponsor === '249') effects.push(item(player.id, { type: 'perception', count: 2 }));
      if (sponsor === '250') effects.push(item(player.id, { type: 'sell', count: 2, host: sponsor }));
      if (sponsor === '252') effects.push(item(player.id, { type: 'hunt', count: tagsOf(player).predator ?? 0 }));
      if (sponsor === '253') effects.push(item(player.id, { type: 'okapi-sponsor' }));
    }
    if (sponsor === '262') {
      const existing = tagsOf(player);
      const count = [...new Set(tags)].filter(tag => [...CONTINENTS, ...ANIMAL_TAGS].includes(tag as typeof CONTINENTS[number]) && (existing[tag] ?? 0) === tags.filter(candidate => candidate === tag).length).length;
      if (count) effects.push(gainItem(player.id, 'appeal', count), gainItem(player.id, 'money', count * 2));
    }
    const count = tags.filter(tag => tag === continentExperts[sponsor]).length;
    for (let index = 0; index < count; index += 1) {
      if (sponsor === '210' || sponsor === '211' || sponsor === '213') effects.push(item(player.id, {
        type: 'offer-free-build', kind: sponsor === '210' ? 'kiosk' : sponsor === '211' ? 'enclosure-1' : 'pavilion'
      }));
      if (sponsor === '212') effects.push(item(player.id, { type: 'pouch', count: 1, host: sponsor }));
      if (sponsor === '214') {
        if (state.context) state.context.after.push(item(player.id, { type: 'clever' }));
        else effects.push(item(player.id, { type: 'clever' }));
      }
    }
    if (effects.length) triggers.push({ id: `sponsor-${sponsor}`, label: `${zooCard(sponsor).name}触发`, effects });
  }
  const others = state.players.filter(owner => owner.id !== player.id && owner.sponsors.includes('208') && science)
    .map(owner => gainItem(owner.id, 'money', science * 2));
  for (const owner of state.players) if (owner.id !== player.id && owner.sponsors.includes('251')) {
    const bears = tags.filter(tag => tag === 'bear').length;
    if (bears) others.push(gainItem(owner.id, 'appeal', bears * 2));
  }
  return [...orderedEffects(player.id, triggers), ...others];
}

function gain(state: ArkState, player: ArkPlayer, resource: Extract<ArkEffect, { type: 'gain' }>['resource'], amount: number, events: ArkEvent[]) {
  const before = player[resource];
  if (resource === 'x') player.x = Math.min(5, before + amount);
  else if (resource === 'reputation') {
    const cap = player.upgrades.includes('cards') ? 15 : 9;
    const total = before + amount;
    player.reputation = Math.min(cap, total);
    if (cap === 15 && total > 15) prepend(state, [gainItem(player.id, 'appeal', total - 15)]);
    const rewards: QueueItem<ArkEffect>[] = [];
    for (let threshold = before + 1; threshold <= player.reputation; threshold += 1) {
      if (threshold === 5) rewards.push(item(player.id, { type: 'upgrade', workerOption: false }));
      if (threshold === 8) rewards.push(item(player.id, { type: 'worker' }));
      if ([10, 13].includes(threshold)) rewards.push(item(player.id, { type: 'snap', count: 1, refill: false, range: true }));
      if ([11, 14].includes(threshold)) rewards.push(gainItem(player.id, 'conservation', 1));
      if ([12, 15].includes(threshold)) rewards.push(gainItem(player.id, 'x', 1));
    }
    prepend(state, rewards);
  } else player[resource] = Math.min(resource === 'appeal' ? 113 : resource === 'conservation' ? 41 : Number.MAX_SAFE_INTEGER, before + amount);
  events.push(event(`gain.${resource}`, `${player.name} ${resourceNames[resource]} +${player[resource] - before}。`));
  if (resource === 'conservation') {
    const effects: QueueItem<ArkEffect>[] = [];
    if (before < 2 && player.conservation >= 2) effects.push(item(player.id, { type: 'upgrade', workerOption: true }));
    for (const point of [5, 8] as const) if (before < point && player.conservation >= point) effects.push(item(player.id, { type: 'milestone', point }));
    if (!state.finalReduced && player.conservation >= 10) {
      state.finalReduced = true;
      effects.push(...state.players.map(candidate => item(candidate.id, { type: 'final-choice' })));
    }
    prepend(state, effects);
  }
}

function completeAction(state: ArkState, events: ArkEvent[]) {
  const context = state.context;
  if (!context) throw new Error('当前没有待完成行动。');
  const player = arkPlayer(state, state.activePlayer);
  if (context.repeatRemaining === 0 && context.action === 'animals' && player.sponsors.includes('228') && context.playedAnimals?.length && context.playedAnimals.every(id => zooCard(id).size <= 2) && !context.smallBonusUsed) {
    context.smallBonusUsed = true;
    prepend(state, [item(player.id, { type: 'small-animal-bonus' }), item(player.id, { type: 'take-small-animal' }), item(player.id, { type: 'finish-action' })]);
    return;
  }
  if (context.action === 'build' && player.sponsors.includes('217') && context.built.length && !context.engineerUsed) {
    context.engineerUsed = true;
    prepend(state, [item(player.id, { type: 'engineer' }), item(player.id, { type: 'finish-action' })]);
    return;
  }
  if (context.repeatRemaining > 0) {
    state.context = null;
    state.stage = 'turn';
    prepend(state, [item(player.id, { type: 'repeat-action' })]);
    state.repeatContext = { action: context.action, strength: context.strength - context.spentX, upgraded: context.upgraded, after: context.after, remaining: context.repeatRemaining - 1, ...(context.continuation ? { continuation: context.continuation } : {}), ...(context.playedAnimals ? { playedAnimals: context.playedAnimals } : {}) };
    events.push(event('action.repeated', `${player.name} 完成本次${ACTION_NAMES[context.action]}，还可按原强度再执行 ${context.repeatRemaining} 次。`));
    return;
  }
  const cardOwner = arkPlayer(state, context.cardOwner ?? player.id);
  cardOwner.row = useAction(cardOwner.row, context.action);
  state.constriction[cardOwner.id] = state.constriction[cardOwner.id]?.filter(action => action !== context.action) ?? [];
  events.push(event('action.completed', `${player.name} 完成${ACTION_NAMES[context.action]}，行动卡移至槽位 1。`));
  state.context = null;
  state.stage = 'turn';
  prepend(state, [...context.after, ...(context.continuation ?? [item(player.id, { type: 'venom-payment' }), item(player.id, { type: 'end-turn' })])]);
}
function detectEnd(state: ArkState, duringBreak: boolean, events: ArkEvent[]) {
  if (state.finalTurns !== null) return;
  const player = state.players.find(candidate => victoryScore(candidate.appeal, candidate.conservation) >= 100);
  if (!player) return;
  state.endingTrigger = player.id;
  state.finalTurns = duringBreak ? 2 : 1;
  events.push(event('end.triggered', `${player.name} 两条轨道相遇或交叉。${duringBreak ? '所有玩家' : '其他玩家'}再进行一个回合。`));
}
function nextTurn(state: ArkState, events: ArkEvent[]) {
  state.turnCheckpoint = null;
  state.venomRemoved = false;
  state.activePlayer = state.players.find(player => player.id !== state.activePlayer)!.id;
  if (state.finalTurns === 0) {
    state.stage = 'scoring';
    if (!state.finalReduced) {
      state.finalReduced = true;
      prepend(state, [...state.players.map(player => item(player.id, { type: 'final-choice' })), item(state.activePlayer, { type: 'score' })]);
    } else prepend(state, [item(state.activePlayer, { type: 'score' })]);
  } else {
    state.stage = 'turn';
    events.push(event('turn.started', `轮到 ${arkPlayer(state, state.activePlayer).name}。`));
  }
}
function rewardEffects(actor: string, reward: string): QueueItem<ArkEffect>[] {
  if (reward === 'free-2') return [item(actor, { type: 'offer-free-build', kind: 'enclosure-2' })];
  if (reward === 'money-12') return [gainItem(actor, 'money', 12)];
  if (reward === 'income-5') return [gainItem(actor, 'money', 5)];
  if (reward === 'income-cp') return [gainItem(actor, 'conservation', 1)];
  if (reward === 'x-3') return [gainItem(actor, 'x', 3)];
  if (reward === 'draw-2') return [item(actor, { type: 'draw', count: 2 })];
  if (reward === 'snap') return [item(actor, { type: 'snap', count: 1, refill: false, range: false })];
  if (reward === 'income-sponsor') return [item(actor, { type: 'offer-paid-sponsor' })];
  if (reward === 'worker') return [item(actor, { type: 'worker' })];
  return [];
}
function bonusEffects(actor: string, reward: string): QueueItem<ArkEffect>[] {
  if (reward === 'money-10') return [gainItem(actor, 'money', 10)];
  if (reward === 'x-3') return [gainItem(actor, 'x', 3)];
  if (reward === 'reputation-2') return [gainItem(actor, 'reputation', 2)];
  if (reward === 'free-3') return [item(actor, { type: 'offer-free-build', kind: 'enclosure-3' })];
  if (reward === 'draw-3') return [item(actor, { type: 'snap', count: 3, refill: false, range: true })];
  if (reward === 'partner-zoo') return [item(actor, { type: 'offer-partner' })];
  if (reward === 'university') return [item(actor, { type: 'offer-university' })];
  if (reward === 'double-token') return [item(actor, { type: 'offer-double' })];
  if (reward === 'sponsor-money') return [item(actor, { type: 'offer-paid-sponsor' })];
  throw new Error('未知保护轨道奖励。');
}
function takePartner(state: ArkState, player: ArkPlayer, continent: string): QueueItem<ArkEffect>[] {
  if (!state.partnerSupply.includes(continent) || player.partners.includes(continent) || player.partners.length >= (player.upgrades.includes('association') ? 4 : 2)) throw new Error('合作动物园不可领取。');
  state.partnerSupply.splice(state.partnerSupply.indexOf(continent), 1);
  player.partners.push(continent);
  const effects: QueueItem<ArkEffect>[] = player.partners.length === 2 ? [item(player.id, { type: 'upgrade', workerOption: false })] :
    player.partners.length === 3 ? [item(player.id, { type: 'worker' })] :
    player.partners.length === 4 ? [gainItem(player.id, 'conservation', 2)] : [];
  return iconEffects(state, player, [continent], effects);
}
function takeUniversity(state: ArkState, player: ArkPlayer, university: string): QueueItem<ArkEffect>[] {
  if (!state.universitySupply.includes(university) || player.universities.includes(university)) throw new Error('大学不可领取。');
  state.universitySupply.splice(state.universitySupply.indexOf(university), 1);
  player.universities.push(university);
  const effects: QueueItem<ArkEffect>[] = [];
  if (university !== 'science') effects.push(gainItem(player.id, 'reputation', university === 'hand' ? 1 : 2));
  if (player.universities.length === 2) effects.push(item(player.id, { type: 'upgrade', workerOption: false }));
  if (player.universities.length === 3) effects.push(gainItem(player.id, 'conservation', MAP_INFO[player.map].thirdUniversityPoints));
  return iconEffects(state, player, university === 'science' ? ['science', 'science'] : university === 'reputation' ? ['science'] : [], effects);
}
function sponsorEffects(player: ArkPlayer, cardId: string, state?: ArkState): QueueItem<ArkEffect>[] {
  const card = zooCard(cardId);
  const effects: QueueItem<ArkEffect>[] = [];
  const kind = uniqueKind(card.id);
  if (kind) effects.push(item(player.id, { type: 'offer-unique', kind }));
  if (card.appeal) effects.push(gainItem(player.id, 'appeal', card.appeal));
  if (card.conservation) effects.push(gainItem(player.id, 'conservation', card.conservation));
  if (card.reputation) effects.push(gainItem(player.id, 'reputation', card.reputation));
  if (card.id === '201') effects.push(item(player.id, { type: 'snap', count: 1, refill: false, range: true, optional: true }));
  if (card.id === '204') effects.push(gainItem(player.id, 'money', (tagsOf(player).science ?? 0) * 2));
  if (card.id === '206') effects.push(gainItem(player.id, 'appeal', player.supportedProjects.length * 2));
  if (card.id === '208') effects.push(gainItem(player.id, 'appeal', tagsOf(player).science ?? 0));
  if (continentExperts[card.id]) effects.push(gainItem(player.id, 'appeal', tagsOf(player)[continentExperts[card.id]!] ?? 0));
  if (card.id === '241') effects.push(gainItem(player.id, 'appeal', tagsOf(player).water ?? 0));
  if (card.id === '242') effects.push(gainItem(player.id, 'appeal', Math.floor((tagsOf(player).rock ?? 0) / 2) * 3));
  const tags = tagsOf(player);
  if (card.id === '207' || card.id === '222') {
    const points = card.id === '222' ? Math.min(3, tags.science ?? 0) : Math.floor([...CONTINENTS, ...ANIMAL_TAGS].filter(tag => (tags[tag] ?? 0) > 0).length / 2);
    effects.push(gainItem(player.id, 'conservation', points));
    if (state) effects.push(...state.players.filter(candidate => candidate.id !== player.id).map(candidate => gainItem(candidate.id, 'money', points * 2)));
  }
  if (card.id === '216') effects.push(item(player.id, { type: 'worker' }));
  if (card.id === '219') effects.push(gainItem(player.id, 'money', ((tags.water ?? 0) + (tags.rock ?? 0)) * 2));
  if (card.id === '224') effects.push(gainItem(player.id, 'x', 1));
  if (card.id === '227') effects.push(item(player.id, { type: 'focus' }));
  if (card.id === '228') effects.push(gainItem(player.id, 'money', projectMetric(player, 'animal-size-2') * 2));
  if (card.id === '254') effects.push(item(player.id, { type: 'snap', count: 1, refill: false, range: true }));
  if (card.id === '258' || card.id === '259' || card.id === '260' || card.id === '264') effects.push(gainItem(player.id, 'appeal', connectedSpaces(player, card.id === '258' ? 'water' : card.id === '259' ? 'rock' : card.id === '260' ? 'border' : 'bonus')));
  if (card.id === '262') effects.push(gainItem(player.id, 'money', [...CONTINENTS, ...ANIMAL_TAGS].filter(tag => (tags[tag] ?? 0) > 0).length * 2));
  if (card.id === '263') effects.push(item(player.id, { type: 'offer-free-build', kind: 'enclosure-5' }));
  if (fundingTags[card.id]) effects.push(gainItem(player.id, 'appeal', tagsOf(player)[fundingTags[card.id]!] ?? 0));
  if (card.id === '203') effects.push(gainItem(player.id, 'money', [0, 2, 5, 10][player.universities.length]!));
  if (card.id === '209' || card.id === '225') effects.push(gainItem(player.id, 'x', 1));
  if (card.id === '220') effects.push(gainItem(player.id, 'money', 3));
  if (card.id === '229') effects.push(gainItem(player.id, 'appeal', projectMetric(player, 'animal-size-2')));
  if (card.id === '230') effects.push(gainItem(player.id, 'appeal', 2 * projectMetric(player, 'animal-size-4')));
  if (card.id === '261') effects.push(gainItem(player.id, 'appeal', 1), gainItem(player.id, 'conservation', 1));
  if (card.id === '254') return orderedEffects(player.id, effects.map((effect, index) => ({
    id: `school-${index}`,
    label: effect.effect.type === 'offer-unique' ? '放置课外学校独有建筑' : effect.effect.type === 'gain' ? `获得 ${effect.effect.amount} ${resourceNames[effect.effect.resource]}` : '按当前声望拿取卡牌',
    effects: [effect]
  })));
  return effects;
}
function actionContext(action: typeof ARK_ACTIONS[number], strength: number, upgraded: boolean, repeatRemaining = 0): NonNullable<ArkState['context']> {
  return {
    action, strength, upgraded,
    remaining: action === 'animals' ? animalCapacity(strength, upgraded) : action === 'cards' ? cardActionTable(strength, upgraded).draw : strength + (action === 'sponsors' && upgraded ? 1 : 0),
    played: 0, built: [], tasks: [], donated: false, after: [], repeatRemaining, spentX: 0
  };
}

function placeBuilding(state: ArkState, player: ArkPlayer, command: Extract<ArkCommand, { type: 'build' }>, free: boolean, events: ArkEvent[]): QueueItem<ArkEffect>[] {
  const cells = buildingCells(command.kind, command, command.rotation, command.flip);
  if (!free) player.money -= cells.length * 2;
  state.buildingSequence += 1;
  player.buildings.push({ id: `building-${state.buildingSequence}`, kind: command.kind, cells, animals: [] });
  state.requiredBuildings = state.requiredBuildings.filter(required => required.actor !== player.id || required.kind !== command.kind);
  for (const required of state.requiredBuildings) {
    const owner = arkPlayer(state, required.actor);
    const spec = uniqueSpec(required.kind);
    if (spec && !uniqueCommands(state, owner, spec.card, 1).length) throw new Error('这次放置会堵住尚未结算的独有建筑，请先放置独有建筑或选择其他位置。');
  }
  const effects: QueueItem<ArkEffect>[] = [];
  if (command.kind === 'pavilion') effects.push(gainItem(player.id, 'appeal', 1));
  for (const cell of cells) {
    const map = mapCells(player.map).find(candidate => hexKey(candidate) === hexKey(cell))!;
    if (!map.reward || player.coveredRewards.includes(hexKey(cell))) continue;
    player.coveredRewards.push(hexKey(cell));
    const boardKeys = new Set(mapCells(player.map).map(hexKey));
    if (player.sponsors.includes('221') && hexNeighbors(cell).some(neighbor => !boardKeys.has(hexKey(neighbor)))) effects.push(item(player.id, { type: 'archaeologist' }));
    const reward = map.reward;
    if (reward.startsWith('money-')) effects.push(gainItem(player.id, 'money', Number(reward.split('-')[1])));
    else if (reward === 'x') effects.push(gainItem(player.id, 'x', 1));
    else if (reward === 'worker') effects.push(item(player.id, { type: 'worker' }));
    else if (reward === 'reputation-2') effects.push(gainItem(player.id, 'reputation', 2));
    else if (reward === 'reputation-1') effects.push(gainItem(player.id, 'reputation', 1));
    else if (reward === 'draw-2') effects.push(item(player.id, { type: 'draw', count: 2 }));
    else if (reward === 'upgrade') effects.push(item(player.id, { type: 'upgrade', workerOption: false }));
    else if (reward === 'partner') effects.push(item(player.id, { type: 'offer-partner' }));
    else if (reward === 'paid-sponsor') effects.push(item(player.id, { type: 'offer-paid-sponsor' }));
    else if (reward === 'clever') {
      if (state.context) state.context.after.push(item(player.id, { type: 'clever' }));
      else effects.push(item(player.id, { type: 'clever' }));
    }
    else effects.push(item(player.id, { type: 'snap', count: 1, refill: false, range: true }));
  }
  for (const [sponsor, terrain] of [['241', 'water'], ['242', 'rock']] as const) if (player.sponsors.includes(sponsor)) {
    const count = cells.filter(cell => adjacentTerrain([cell], terrain, player.map) > 0).length;
    if (count) effects.push(gainItem(player.id, 'money', count));
  }
  const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  if (!player.mapCompleted && mapCells(player.map).filter(cell => cell.terrain === 'land').every(cell => occupied.has(hexKey(cell)))) {
    player.mapCompleted = true;
    effects.push(gainItem(player.id, 'appeal', 7));
  }
  events.push(event('building.placed', `${player.name} ${free ? '免费' : `支付 ${cells.length * 2} 资金，`}建造${BUILDING_NAMES[command.kind]}。`));
  if (command.kind === 'aviary' || command.kind === 'reptile-house') effects.push(item(player.id, { type: 'offer-transfer', building: `building-${state.buildingSequence}` }));
  return effects;
}

function resolveEffect(state: ArkState, actor: string, effect: ArkEffect, events: ArkEvent[]) {
  const player = arkPlayer(state, actor);
  switch (effect.type) {
    case 'gain': gain(state, player, effect.resource, effect.amount, events); break;
    case 'draw': drawToHand(state, player, effect.count, events); break;
    case 'setup':
      makeChoice(state, actor, '从 8 张起始卡牌中保留 4 张', player.hand.map(id => option(id, zooCard(id).name, [], id)), 4, 4, 'setup');
      break;
    case 'setup-complete':
      state.stage = 'turn';
      refill(state);
      events.push(event('setup.completed', '双方已保留 4 张手牌，展示区翻开，对局开始。'));
      break;
    case 'discard':
      makeChoice(state, actor, `${effect.reason}：弃除 ${Math.min(effect.count, player.hand.length)} 张手牌`,
        player.hand.map(id => option(id, zooCard(id).name, [item(actor, { type: 'remove-hand', card: id, mode: 'discard', host: '' })], id)),
        Math.min(effect.count, player.hand.length), Math.min(effect.count, player.hand.length));
      break;
    case 'upgrade': {
      const options = ARK_ACTIONS.filter(action => !player.upgrades.includes(action)).map(action =>
        option(action, `升级${ACTION_NAMES[action]}至 II`, [item(actor, { type: 'set-upgrade', action })]));
      if (effect.workerOption && player.workers < 4) options.push(option('worker', '解锁一位协会事务员', [item(actor, { type: 'worker' })]));
      makeChoice(state, actor, '选择升级奖励', options);
      break;
    }
    case 'set-upgrade':
      if (!player.upgrades.includes(effect.action)) player.upgrades.push(effect.action);
      events.push(event('action.upgraded', `${player.name} 升级${ACTION_NAMES[effect.action]}至 II，下次行动生效。`));
      break;
    case 'worker':
      if (player.workers === 3 && MAP_INFO[player.map].lastWorkerPoints) prepend(state, [gainItem(actor, 'conservation', MAP_INFO[player.map].lastWorkerPoints)]);
      player.workers = Math.min(4, player.workers + 1);
      events.push(event('worker.unlocked', `${player.name} 可用事务员总数提升至 ${player.workers}。`));
      break;
    case 'clever':
      makeChoice(state, actor, '机灵：可将一张行动卡移到槽位 1',
        ARK_ACTIONS.map(action => option(action, `${ACTION_NAMES[action]} → 槽位 1`, [item(actor, { type: 'move-action', action })])), 0, 1);
      break;
    case 'move-action': player.row = useAction(player.row, effect.action); events.push(event('action.moved', `${player.name} 将${ACTION_NAMES[effect.action]}移至槽位 1。`)); break;
    case 'boost':
      makeChoice(state, actor, `调度${ACTION_NAMES[effect.action]}：行动已完成，可移到槽位 1 或 5`, [1, 5].map(slot =>
        option(`boost-${effect.action}-${slot}`, `${ACTION_NAMES[effect.action]} → 槽位 ${slot}`, [item(actor, { type: 'boost-action', action: effect.action, slot: slot as 1 | 5 })])), 0, 1);
      break;
    case 'boost-action': {
      const remaining = player.row.filter(action => action !== effect.action);
      player.row = effect.slot === 1 ? [effect.action, ...remaining] : [...remaining, effect.action];
      events.push(event('action.boosted', `${player.name} 将${ACTION_NAMES[effect.action]}移至槽位 ${effect.slot}。`));
      break;
    }
    case 'dig': {
      const continuation = effect.count > 1 ? [item(actor, { ...effect, count: effect.count - 1 })] : [];
      const options = [
        ...state.market.flatMap((id, index) => id ? [option(`dig-market-${id}`, `弃掉展示位 ${index + 1} 的${zooCard(id).name}，立即补牌`, [item(actor, { type: 'dig-card', source: 'market', card: id }), ...continuation], id)] : []),
        ...player.hand.map(id => option(`dig-hand-${id}`, `弃掉手牌${zooCard(id).name}，从牌库抽一张`, [item(actor, { type: 'dig-card', source: 'hand', card: id }), ...continuation], id))
      ];
      makeChoice(state, actor, `挖掘：还可执行 ${effect.count} 次，每次重新选择；不选则结束`, options, 0, 1);
      break;
    }
    case 'dig-card':
      if (!(effect.source === 'hand' ? player.hand : state.market).includes(effect.card)) throw new Error('挖掘目标已不在原牌区。');
      removeCard(state, player, effect.card, effect.source);
      state.discard.push(effect.card);
      if (effect.source === 'market') refill(state);
      else drawToHand(state, player, 1, events);
      events.push(event('cards.dug', `${player.name} 弃换${effect.source === 'hand' ? '一张手牌' : '一张展示牌'}。`));
      break;
    case 'trigger-order':
      makeChoice(state, actor, '多个效果同时触发：选择下一项，余下效果随后继续', effect.triggers.map(trigger =>
        option(trigger.id, trigger.label, [...trigger.effects, ...orderedEffects(actor, effect.triggers.filter(other => other.id !== trigger.id))])));
      break;
    case 'sell':
    case 'pouch':
      makeChoice(state, actor, effect.type === 'sell' ? `日光浴：可卖出最多 ${effect.count} 张手牌，每张 4 资金` : `育儿袋：可放入最多 ${effect.count} 张手牌，每张 2 魅力`,
        player.hand.map(id => option(id, zooCard(id).name, [item(actor, { type: 'remove-hand', card: id, mode: effect.type === 'sell' ? 'sell' : 'pouch', host: effect.host })], id)), 0, effect.count);
      break;
    case 'remove-hand':
      player.hand.splice(player.hand.indexOf(effect.card), 1);
      if (effect.mode === 'pouch') {
        player.buried.push({ host: effect.host, card: effect.card });
        prepend(state, [gainItem(actor, 'appeal', 2)]);
      } else {
        state.discard.push(effect.card);
        if (effect.mode === 'sell') prepend(state, [gainItem(actor, 'money', 4)]);
      }
      break;
    case 'hunt':
    case 'perception':
    case 'scavenge': {
      if (effect.type === 'scavenge') {
        const shuffled = shuffle(state.discard, state.rng);
        state.rng = shuffled.rng;
        state.discard = shuffled.values;
        state.revealed = state.discard.splice(0, effect.count);
      } else state.revealed = draw(state, effect.count);
      const cards = state.revealed.filter(id => effect.type !== 'hunt' || zooCard(id).kind === 'animal');
      const count = Math.min(effect.type === 'perception' ? Math.floor(effect.count / 2) : 1, cards.length);
      state.queue.unshift(item(actor, { type: 'discard-revealed' }));
      makeChoice(state, actor, `${effect.type === 'hunt' ? '狩猎：保留一张动物' : effect.type === 'scavenge' ? '食腐：保留一张卡牌' : `洞察：保留 ${count} 张卡牌`}`,
        cards.map(id => option(id, zooCard(id).name, [item(actor, { type: 'keep-revealed', card: id })], id)), count, count);
      break;
    }
    case 'keep-revealed':
      state.revealed.splice(state.revealed.indexOf(effect.card), 1);
      player.hand.push(effect.card);
      break;
    case 'offer-unique': {
      const spec = uniqueSpec(effect.kind);
      if (!spec) throw new Error('独有建筑定义缺失。');
      const commands = uniqueCommands(state, player, spec.card);
      if (!commands.length) throw new Error('没有独有建筑的合法位置，请先完成必要放置。');
      makeChoice(state, actor, `必须放置${spec.name}：独有建筑不可镜像，也不能跳过`, commands.map((command, index) =>
        option(`unique-${spec.card}-${index}`, `${spec.name} · ${command.q},${command.r} · ${command.rotation * 60}°`, [item(actor, { type: 'place-free-build', command })])));
      break;
    }
    case 'engineer': {
      const kinds = state.context!.built.filter(kind => kind.startsWith('enclosure') || kind === 'kiosk' || kind === 'pavilion');
      const commands = buildCommands(state, player, 5, player.upgrades.includes('build'), [], Infinity).filter(command => kinds.includes(command.kind));
      makeChoice(state, actor, '工程师：可按正常费用额外建造一座本次已建的普通建筑', commands.map((command, index) => option(`engineer-${index}`, `${BUILDING_NAMES[command.kind]} · ${command.q},${command.r} · 支付 ${BUILDING_SHAPES[command.kind].length * 2}`, [item(actor, { type: 'place-engineer', command })])), 0, 1);
      break;
    }
    case 'place-engineer':
      prepend(state, placeBuilding(state, player, effect.command, false, events));
      break;
    case 'finish-action': completeAction(state, events); break;
    case 'attack-order':
      makeChoice(state, actor, '互动效果时序：选择在卡面魅力／保护奖励之前或之后结算', [
        option('attack-first', '先结算互动，再领取卡面收益', [item(actor, { type: 'attack', ability: effect.ability, count: effect.count }), ...effect.rewards]),
        option('rewards-first', '先领取卡面收益，再结算互动', [...effect.rewards, item(actor, { type: 'attack', ability: effect.ability, count: effect.count })])
      ]);
      break;
    case 'attack': {
      if (effect.ability === 'PILFERING_1' || effect.ability === 'PILFERING_2') {
        const metrics = effect.ability === 'PILFERING_2' ? ['appeal', 'conservation'] as const : ['appeal'] as const;
        prepend(state, metrics.flatMap(metric => {
          const target = affected(state, player, metric);
          return target ? [item(actor, { type: 'pilfer', source: actor, target: target.id })] : [];
        }));
      } else if (effect.ability === 'HYPNOSIS') {
        const target = affected(state, player, 'appeal');
        if (target && target.appeal >= player.appeal) state.context!.after.push(item(actor, { type: 'hypnosis', target: target.id }));
      } else for (const target of state.players.filter(target => target.id !== actor && target.appeal >= 5 && !target.sponsors.includes('225'))) {
        const count = effect.ability === 'VENOM' ? target.appeal > player.appeal ? effect.count : 0 : Number(target.appeal > player.appeal) + Number(target.conservation > player.conservation);
        const actions = effect.ability === 'VENOM' ? target.row.slice(0, count) : target.row.slice(5 - count);
        const tokens = effect.ability === 'VENOM' ? state.venom : state.constriction;
        tokens[target.id] = [...new Set([...(tokens[target.id] ?? []), ...actions])];
        if (count) events.push(event('animal.attack', `${player.name} 对${target.name}施加${effect.ability === 'VENOM' ? '毒液' : '缠绕'} ${count}。`));
      }
      break;
    }
    case 'pilfer': {
      const target = arkPlayer(state, effect.target);
      const options: ArkChoiceOption[] = [];
      if (target.money >= 5 || !target.hand.length) options.push(option('money', `支付 ${Math.min(5, target.money)} 资金给${arkPlayer(state, effect.source).name}`, [item(effect.source, { type: 'pilfer-payment', source: effect.source, target: target.id, mode: 'money' })]));
      if (target.hand.length) options.push(option('card', '让对方随机抽取一张手牌', [item(effect.source, { type: 'pilfer-payment', source: effect.source, target: target.id, mode: 'card' })]));
      makeChoice(state, target.id, '被偷窃：由你决定支付资金或随机手牌', options);
      break;
    }
    case 'pilfer-payment': {
      const target = arkPlayer(state, effect.target);
      const source = arkPlayer(state, effect.source);
      if (effect.mode === 'money') {
        const amount = Math.min(5, target.money);
        target.money -= amount; source.money += amount;
        events.push(event('animal.pilfer', `${target.name} 向${source.name}支付 ${amount} 资金。`));
      } else {
        const random = nextRandom(state.rng); state.rng = random.rng;
        const card = target.hand.splice(Math.floor(random.value * target.hand.length), 1)[0];
        if (card) {
          source.hand.push(card);
          events.push(event('animal.pilfer', `${source.name} 随机取得${target.name}的一张手牌。`));
          events.push(event('cards.private', `偷窃卡牌：${zooCard(card).name}`, [source.id, target.id]));
        }
      }
      break;
    }
    case 'hypnosis': {
      const target = effect.target ? arkPlayer(state, effect.target) : affected(state, player, 'appeal');
      if (!target) break;
      const options: ArkChoiceOption[] = [];
      for (const action of target.row.slice(0, 3)) for (let spendX = 0; spendX <= player.x; spendX += 1) {
        const strength = actionStrength(state, target, action, spendX);
        if (strength < 1) continue;
        const context = actionContext(action, strength, target.upgrades.includes(action));
        context.cardOwner = target.id;
        const virtual = { ...state, context, pending: null, stage: 'action' as const };
        if (arkGame.getDecision(virtual, actor)?.options.some(option => option.command.type !== 'finish')) options.push(option(
          `hypnosis-${action}-${spendX}`, `催眠${ACTION_NAMES[action]} ${context.upgraded ? 'II' : 'I'} · 强度 ${strength}${spendX ? ` · ${spendX} X` : ''}`,
          [item(actor, { type: 'start-hypnosis', owner: target.id, action, spendX })]));
      }
      makeChoice(state, actor, '催眠：可使用魅力最高对手槽位 1–3 的一项行动', options, 0, 1);
      break;
    }
    case 'start-hypnosis': {
      const owner = arkPlayer(state, effect.owner);
      const strength = actionStrength(state, owner, effect.action, effect.spendX);
      const upgraded = owner.upgrades.includes(effect.action);
      const continuation = state.queue.splice(0);
      player.x -= effect.spendX;
      clearActionToken(state, owner.id, effect.action);
      state.context = { ...actionContext(effect.action, strength, upgraded), spentX: effect.spendX, continuation, cardOwner: owner.id };
      state.stage = 'action';
      if (effect.action === 'cards') state.breakProgress = Math.min(9, state.breakProgress + 2);
      if (effect.action === 'animals' && upgraded && strength >= 5) prepend(state, [gainItem(actor, 'reputation', 1)]);
      events.push(event('action.hypnosis', `${player.name} 使用${owner.name}的${ACTION_NAMES[effect.action]} ${upgraded ? 'II' : 'I'}，强度 ${strength}。`));
      break;
    }
    case 'venom-payment':
      if (!state.venomRemoved && state.venom[actor]?.length) {
        if (player.money >= 2) { player.money -= 2; events.push(event('venom.payment', `${player.name} 未移除毒液标记，回合结束支付 2 资金。`)); }
        else makeChoice(state, actor, '毒液结算资金不足：按规则撤销整个回合并重新选择行动', [option('undo-turn', '撤销本回合，保留可复现的回退记录', [item(actor, { type: 'undo-turn' })])]);
      }
      break;
    case 'undo-turn': {
      const checkpoint = state.turnCheckpoint;
      if (!checkpoint) throw new Error('缺少本回合起始状态。');
      const revision = state.revision;
      Object.assign(state, structuredClone(checkpoint), { revision, turnCheckpoint: null });
      events.push(event('turn.undone', `${player.name} 因毒液支付不足撤销整个回合；请改用有毒液的行动或获取资金。`));
      break;
    }
    case 'focus':
      makeChoice(state, actor, '特别任务：选择本局专注的小型或大型动物', ['small', 'large'].map(focus => option(focus, focus === 'small' ? '小型：每只 +2 魅力，不能再打大型' : '大型：每只 +4 魅力，不能再打小型', [item(actor, { type: 'set-focus', focus: focus as 'small' | 'large' })])));
      break;
    case 'set-focus': {
      player.animalFocus = effect.focus;
      const discarded: string[] = [];
      const budget = state.deck.length + state.discard.length;
      for (let index = 0; index < budget; index += 1) {
        const id = draw(state, 1)[0];
        if (!id) break;
        const card = zooCard(id);
        if (card.kind === 'animal' && (effect.focus === 'small' ? card.size <= 2 : card.size >= 4)) { player.hand.push(id); break; }
        discarded.push(id);
      }
      state.discard.push(...discarded);
      events.push(event('sponsor.focus', `${player.name} 选择${effect.focus === 'small' ? '小型' : '大型'}动物发展方向。`));
      break;
    }
    case 'archaeologist': {
      const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
      const options = mapCells(player.map).filter(cell => cell.reward && !occupied.has(hexKey(cell))).map(cell =>
        option(`archaeology-${cell.q}-${cell.r}`, `额外获得地图 ${cell.q},${cell.r} 的 ${cell.reward} 奖励（不覆盖该格）`, [item(actor, { type: 'map-reward', q: cell.q, r: cell.r })]));
      makeChoice(state, actor, '考古学家：选择一项尚未覆盖的地图奖励', options);
      break;
    }
    case 'map-reward': {
      const reward = mapCells(player.map).find(cell => cell.q === effect.q && cell.r === effect.r)?.reward;
      if (!reward) throw new Error('该格没有覆盖奖励。');
      if (reward.startsWith('money-')) prepend(state, [gainItem(actor, 'money', Number(reward.split('-')[1]))]);
      else if (reward === 'x') prepend(state, [gainItem(actor, 'x', 1)]);
      else if (reward === 'worker') prepend(state, [item(actor, { type: 'worker' })]);
      else if (reward === 'reputation-1' || reward === 'reputation-2') prepend(state, [gainItem(actor, 'reputation', reward === 'reputation-1' ? 1 : 2)]);
      else if (reward === 'draw-2') prepend(state, [item(actor, { type: 'draw', count: 2 })]);
      else if (reward === 'clever') {
        if (state.context) state.context.after.push(item(actor, { type: 'clever' }));
        else prepend(state, [item(actor, { type: 'clever' })]);
      } else if (reward === 'partner') prepend(state, [item(actor, { type: 'offer-partner' })]);
      else if (reward === 'paid-sponsor') prepend(state, [item(actor, { type: 'offer-paid-sponsor' })]);
      else if (reward === 'upgrade') prepend(state, [item(actor, { type: 'upgrade', workerOption: false })]);
      else prepend(state, [item(actor, { type: 'snap', count: 1, refill: false, range: true })]);
      break;
    }
    case 'okapi-sponsor':
      if ((player.sponsorTokens?.['253'] ?? 0) > 0) makeChoice(state, actor, '霍加狓：可消耗一个标记，按等级付费打出手牌赞助商',
        player.hand.filter(id => zooCard(id).kind === 'sponsor' && zooCard(id).strength <= player.money && !sponsorError(state, player, id)).map(id => option(id, `${zooCard(id).name} · ${zooCard(id).strength} 资金`, [item(actor, { type: 'play-paid-sponsor', card: id, tokenHost: '253' })], id)), 0, 1);
      break;
    case 'small-animal-bonus': {
      const context = state.context!;
      const virtual = { ...state, context: { ...context, remaining: 1 } };
      const options = animalCommands(virtual, player, false).filter(command => zooCard(command.card).size <= 2).map((command, index) => option(`small-bonus-${index}`, `额外安置${zooCard(command.card).name}`, [item(actor, { type: 'play-bonus-animal', card: command.card, building: command.building })], command.card));
      makeChoice(state, actor, '小型动物计划：可额外按正常费用安置一只手牌小型动物', options, 0, 1);
      break;
    }
    case 'play-bonus-animal': {
      const card = zooCard(effect.card);
      const cost = animalCost(state, player, card.id, 'hand');
      if (!player.hand.includes(card.id) || player.money < cost || requirementError(player, card.id)) throw new Error('额外动物无法支付或条件不满足。');
      player.money -= cost;
      removeCard(state, player, card.id, 'hand');
      player.animals.push(card.id);
      const building = player.buildings.find(building => building.id === effect.building);
      if (building) {
        building.occupancy = building.kind.startsWith('enclosure') ? 1 : buildingUsedSpace(building) + (building.kind === 'petting' ? 1 : card.specialHousing!.space);
        building.animals.push(card.id);
      }
      triggerExperts(state, card.id, events);
      state.context!.playedAnimals = [...(state.context!.playedAnimals ?? []), card.id];
      prepend(state, iconEffects(state, player, cardIcons(card), animalEffects(state, player, card.id)));
      events.push(event('animal.bonus', `${player.name} 额外安置${card.name}，支付 ${cost} 资金。`));
      break;
    }
    case 'take-small-animal':
      makeChoice(state, actor, '小型动物计划：可拿取展示区一只小型动物，不受声望限制', state.market.flatMap(id => id && zooCard(id).kind === 'animal' && zooCard(id).size <= 2 ? [option(id, zooCard(id).name, [item(actor, { type: 'take-market', card: id })], id)] : []), 0, 1);
      break;
    case 'discard-revealed': state.discard.push(...state.revealed); state.revealed = []; break;
    case 'snap': {
      const options = state.market.flatMap((id, index) => id && (!effect.range || index < reputationRange(player.reputation)) ?
        [option(id, `${zooCard(id).name} · 展示位 ${index + 1}`, [item(actor, { type: 'take-market', card: id })], id)] : []);
      if (effect.range && (state.deck.length || state.discard.length)) options.unshift(option('deck', '从牌库抽取 1 张', [item(actor, { type: 'draw', count: 1 })]));
      if (effect.count > 1) prepend(state, [
        ...(effect.refill ? [item(actor, { type: 'refill' } as const)] : []),
        item(actor, { ...effect, count: effect.count - 1 })
      ]);
      makeChoice(state, actor, effect.range ? '拿取一张卡牌：牌库或声望范围内的展示区' : '精选：拿取任意一张展示牌', options, effect.optional ? 0 : 1, 1);
      break;
    }
    case 'take-market': {
      const index = state.market.indexOf(effect.card);
      if (index < 0) throw new Error('展示牌已不在原位。');
      player.hand.push(effect.card);
      state.market[index] = null;
      break;
    }
    case 'refill': refill(state); break;
    case 'final-choice':
      if (player.finals.length > 1) makeChoice(state, actor, '弃除一张终局计分卡，其余保留至终局计分',
        player.finals.map(id => option(id, FINAL_CARDS.find(card => card.id === id)!.name, [], id)), 1, 1, 'final');
      break;
    case 'resistance':
      state.finalRevealed = state.finalDeck.splice(0, 2);
      makeChoice(state, actor, '坚韧：从两张终局卡中保留一张，可与其他终局目标共同计分', state.finalRevealed.map(id =>
        option(id, FINAL_CARDS.find(card => card.id === id)!.name, [item(actor, { type: 'keep-resistance', card: id })], id)));
      break;
    case 'keep-resistance':
      if (!state.finalRevealed.includes(effect.card)) throw new Error('终局卡不在当前展示区。');
      player.finals.push(effect.card);
      state.finalDiscard.push(...state.finalRevealed.filter(id => id !== effect.card));
      state.finalRevealed = [];
      break;
    case 'base-project':
      makeChoice(state, actor, effect.target ? '支配：可取得灵长类基础保护项目' : '主张：可取得一张未入场的基础保护项目',
        state.baseReserve.filter(id => !effect.target || id === effect.target).map(id => option(id, projectById(id).name, [item(actor, { type: 'take-base-project', card: id })], id)), 0, 1);
      break;
    case 'take-base-project':
      if (!state.baseReserve.includes(effect.card)) throw new Error('基础项目已被取得。');
      state.baseReserve.splice(state.baseReserve.indexOf(effect.card), 1);
      player.hand.push(effect.card);
      events.push(event('project.obtained', `${player.name} 取得${projectById(effect.card).name}基础项目，仍须协会行动打出并支持。`));
      break;
    case 'extra-action': {
      const options: ArkChoiceOption[] = [];
      const testState = { ...state, context: null, pending: null, stage: 'turn' as const };
      for (const action of effect.action ? [effect.action] : ARK_ACTIONS) {
        for (let spendX = 0; spendX <= player.x; spendX += 1) for (let doubleCount = 0; doubleCount <= player.doubleTokens.filter(token => token === action).length; doubleCount += 1) {
          const command = { type: 'begin' as const, action, spendX, ...(doubleCount ? { doubleCount, useDouble: true } : {}) };
          if (!validateArkCommand(testState, actor, command)) options.push(option(`extra-${action}-${spendX}${doubleCount ? `-double-${doubleCount}` : ''}`, `执行${ACTION_NAMES[action]} · 强度 ${strengthFor(player, action, spendX)}${spendX ? ` · ${spendX} X` : ''}${doubleCount ? ` · 双重 ${doubleCount}` : ''}`, [item(actor, { type: 'start-extra-action', command })]));
        }
        if (!effect.action && player.x < 5) options.push(option(`extra-x-${action}`, `${ACTION_NAMES[action]}改为获得 X`, [item(actor, { type: 'start-extra-action', command: { type: 'take-x', action } })]));
      }
      makeChoice(state, actor, effect.action ? `额外${ACTION_NAMES[effect.action]}行动：按当前槽位执行，也可放弃` : '决心：必须执行一次额外行动，可用任意行动或替代 X', options, effect.action ? 0 : 1, 1);
      break;
    }
    case 'start-extra-action': {
      const continuation = state.queue.splice(0);
      const command = effect.command;
      if (command.type === 'take-x') {
        clearActionToken(state, player.id, command.action);
        state.constriction[player.id] = state.constriction[player.id]?.filter(action => action !== command.action) ?? [];
        const action = selectAction(player.row, command.action, player.x, 0, true);
        player.row = action.row; player.x = action.tokens;
        prepend(state, continuation);
      } else {
        player.x -= command.spendX;
        consumeDoubles(player, command.action, doubleUses(command));
        const strength = actionStrength(state, player, command.action, command.spendX);
        const upgraded = player.upgrades.includes(command.action);
        state.context = { ...actionContext(command.action, strength, upgraded, doubleUses(command)), spentX: command.spendX, continuation };
        clearActionToken(state, player.id, command.action);
        state.stage = 'action';
        if (command.action === 'cards') state.breakProgress = Math.min(9, state.breakProgress + 2);
        if (command.action === 'animals' && upgraded && strength >= 5) prepend(state, [gainItem(actor, 'reputation', 1)]);
      }
      events.push(event('action.extra', `${player.name} 在同一回合内额外执行${ACTION_NAMES[command.action]}，休息仍等待完整回合结束。`));
      break;
    }
    case 'continue':
      if (state.context && (state.context.remaining <= 0 || (!state.context.upgraded && state.context.action !== 'animals' && state.context.action !== 'cards' && state.context.action !== 'association'))) completeAction(state, events);
      break;
    case 'end-turn': {
      refill(state);
      state.turns += 1;
      if (state.finalTurns !== null) state.finalTurns -= 1;
      detectEnd(state, false, events);
      if (state.breakProgress >= 9) {
        state.stage = 'break';
        gain(state, player, 'x', 1, events);
        prepend(state, [item(actor, { type: 'break-start' })]);
      } else nextTurn(state, events);
      break;
    }
    case 'break-start': {
      const effects: QueueItem<ArkEffect>[] = [];
      for (const candidate of [player, ...state.players.filter(candidate => candidate.id !== actor)]) {
        const extra = candidate.hand.length - handLimit(candidate);
        if (extra > 0) effects.push(item(candidate.id, { type: 'discard', count: extra, reason: '休息手牌上限' }));
      }
      effects.push(item(actor, { type: 'break-income' }));
      prepend(state, effects);
      events.push(event('break.started', '触发休息：先弃到手牌上限，再恢复事务员、更新展示区和领取收入。'));
      break;
    }
    case 'break-income': {
      for (const candidate of state.players) { candidate.usedWorkers = {}; candidate.doubleTokens = []; }
      state.venom = {}; state.constriction = {};
      state.partnerSupply = CONTINENTS.filter(continent => !state.players.every(candidate => candidate.partners.includes(continent)));
      state.universitySupply = Object.keys(UNIVERSITY_NAMES).filter(university => !state.players.every(candidate => candidate.universities.includes(university)));
      for (const card of state.market.slice(0, 2)) if (card) state.discard.push(card);
      state.market = [...state.market.slice(2), null, null];
      refill(state);
      const income: QueueItem<ArkEffect>[] = [];
      for (const candidate of [player, ...state.players.filter(candidate => candidate.id !== actor)]) {
        const preview = breakIncome(candidate);
        income.push(gainItem(candidate.id, 'money', preview.money));
        // Keep the two protection rewards separate to preserve event/replay ordering.
        if (candidate.projectRewards.includes('income-cp')) income.push(gainItem(candidate.id, 'conservation', 1));
        if (preview.x) income.push(gainItem(candidate.id, 'x', preview.x));
        if (candidate.sponsors.includes('206')) income.push(gainItem(candidate.id, 'conservation', 1));
        if (candidate.projectRewards.includes('income-sponsor')) income.push(item(candidate.id, { type: 'offer-paid-sponsor' }));
        if (candidate.projectRewards.includes('snap')) income.push(item(candidate.id, { type: 'snap', count: 1, refill: false, range: false }), item(candidate.id, { type: 'refill' }));
        if (candidate.sponsors.includes('201')) income.push(item(candidate.id, { type: 'snap', count: 1, refill: false, range: true, optional: true }), item(candidate.id, { type: 'refill' }));
      }
      income.push(item(actor, { type: 'break-complete' }));
      prepend(state, income);
      break;
    }
    case 'break-complete':
      state.breakProgress = 0;
      state.breaks += 1;
      detectEnd(state, true, events);
      events.push(event('break.completed', `第 ${state.breaks} 次休息结束。`));
      nextTurn(state, events);
      break;
    case 'milestone': {
      const rewards = state.bonusTiles.filter(tile => tile.point === effect.point && !tile.claimedBy);
      const options = [option('money-5', '获得 5 资金（始终可选）', [gainItem(actor, 'money', 5)]),
        ...rewards.map(tile => option(
          `${effect.point}-${tile.reward}`, `取得共享奖励：${BONUS_NAMES[tile.reward]}`, bonusEffects(actor, tile.reward)
        ))];
      makeChoice(state, actor, `保护轨道 ${effect.point} 点奖励 · 本局随机配置`, options);
      break;
    }
    case 'offer-transfer': {
      const building = player.buildings.find(building => building.id === effect.building);
      if (!building) throw new Error('新建特殊馆不存在。');
      const options = player.animals.flatMap(animal => {
        const source = player.buildings.find(candidate => candidate.animals.includes(animal));
        if ((source && !source.kind.startsWith('enclosure')) || housingError(building, animal, player.map)) return [];
        return freedEnclosures(player, animal).map(freed => option(
          `transfer-${animal}-${freed.id}`, `转移${zooCard(animal).name} · 释放 ${BUILDING_NAMES[freed.kind]}（${freed.id}）`,
          [item(actor, { type: 'transfer', building: building.id, animal, freed: freed.id }), item(actor, effect)]
        ));
      });
      makeChoice(state, actor, `建成${BUILDING_NAMES[building.kind]}：仅此一次，可逐只转移动物；不转移则结束`, options, 0, 1);
      break;
    }
    case 'transfer': {
      const building = player.buildings.find(candidate => candidate.id === effect.building)!;
      const error = housingError(building, effect.animal, player.map);
      if (error) throw new Error(error);
      releaseHousing(player, effect.animal, effect.freed, true);
      building.occupancy = buildingUsedSpace(building) + (zooCard(effect.animal).specialHousing?.space ?? 0);
      building.animals.push(effect.animal);
      events.push(event('animal.transferred', `${player.name} 将${zooCard(effect.animal).name}转入${BUILDING_NAMES[building.kind]}，原最小符合条件饲养区恢复闲置。`));
      break;
    }
    case 'offer-partner':
      makeChoice(state, actor, '领取一个可用合作动物园（不消耗事务员）',
        player.partners.length >= (player.upgrades.includes('association') ? 4 : 2) ? [] :
          state.partnerSupply.filter(continent => !player.partners.includes(continent)).map(continent => option(continent, `${TAG_NAMES[continent]}合作动物园`, [item(actor, { type: 'take-partner', continent })])));
      break;
    case 'offer-university':
      makeChoice(state, actor, '领取一个可用大学（不消耗事务员）',
        state.universitySupply.filter(university => !player.universities.includes(university)).map(university => option(university, UNIVERSITY_NAMES[university]!, [item(actor, { type: 'take-university', university })])));
      break;
    case 'take-partner': prepend(state, takePartner(state, player, effect.continent)); break;
    case 'take-university': prepend(state, takeUniversity(state, player, effect.university)); break;
    case 'offer-double':
      makeChoice(state, actor, '在一张行动卡上放置双重标记',
        ARK_ACTIONS.map(action => option(action, `双重：${ACTION_NAMES[action]}`, [item(actor, { type: 'set-double', action })])));
      break;
    case 'set-double': player.doubleTokens.push(effect.action); break;
    case 'offer-pavilions': {
      const commands = buildCommands(state, { ...player, money: Math.max(player.money, 2) }, 1, player.upgrades.includes('build'), [], Infinity).filter(command => command.kind === 'kiosk' || command.kind === 'pavilion');
      makeChoice(state, actor, `姿态：还可免费放置 ${effect.count} 个贩售亭或休憩亭，也可结束`,
        commands.map((command, index) => option(`posture-${index}`, `${BUILDING_NAMES[command.kind]} · ${command.q},${command.r}`, [
          item(actor, { type: 'place-free-build', command }),
          ...(effect.count > 1 ? [item(actor, { ...effect, count: effect.count - 1 })] : [])
        ])), 0, 1);
      break;
    }
    case 'offer-paid-sponsor':
      makeChoice(state, actor, '可支付与卡牌等级相同的资金，打出一张手牌赞助商',
        player.hand.filter(id => zooCard(id).kind === 'sponsor' && zooCard(id).strength <= player.money && !sponsorError(state, player, id)).map(id =>
          option(id, `${zooCard(id).name} · 支付 ${zooCard(id).strength} 资金`, [item(actor, { type: 'play-paid-sponsor', card: id })], id)), 0, 1);
      break;
    case 'play-paid-sponsor': {
      const card = zooCard(effect.card);
      if (!player.hand.includes(card.id) || card.kind !== 'sponsor' || player.money < card.strength || sponsorError(state, player, card.id)) throw new Error('无法支付或不满足赞助商条件。');
      if (effect.tokenHost) {
        const tokens = player.sponsorTokens?.[effect.tokenHost] ?? 0;
        if (!tokens) throw new Error('赞助商标记已耗尽。');
        player.sponsorTokens![effect.tokenHost] = tokens - 1;
      }
      player.money -= card.strength;
      removeCard(state, player, card.id, 'hand');
      registerSponsor(state, player, card.id);
      triggerExperts(state, card.id, events);
      prepend(state, iconEffects(state, player, cardIcons(card), sponsorEffects(player, card.id, state)));
      events.push(event('sponsor.bonus', `${player.name} 用奖励支付 ${card.strength} 资金打出${card.name}，不移动赞助商行动卡。`));
      break;
    }
    case 'repeat-action': {
      const repeat = state.repeatContext!;
      state.repeatContext = null;
      state.context = actionContext(repeat.action, repeat.strength, repeat.upgraded, repeat.remaining);
      if (repeat.continuation) state.context.continuation = repeat.continuation;
      if (repeat.playedAnimals) state.context.playedAnimals = repeat.playedAnimals;
      state.context.after = repeat.after;
      state.stage = 'action';
      const options: ArkChoiceOption[] = [];
      for (let spendX = 0; spendX <= player.x; spendX += 1) {
        const candidate = actionContext(repeat.action, repeat.strength + spendX, repeat.upgraded, repeat.remaining);
        state.context = candidate;
        candidate.after = repeat.after;
        if (arkGame.getDecision(state, actor)?.options.length) options.push(option(`repeat-${spendX}`,
          `再次执行 · 强度 ${repeat.strength + spendX}${spendX ? ` · 另消耗 ${spendX} 枚 X` : ''}`, [item(actor, { type: 'start-repeat', spendX })]));
      }
      state.context = actionContext(repeat.action, repeat.strength, repeat.upgraded, repeat.remaining);
      if (repeat.continuation) state.context.continuation = repeat.continuation;
      if (repeat.playedAnimals) state.context.playedAnimals = repeat.playedAnimals;
      state.context.after = repeat.after;
      makeChoice(state, actor, `双重：再次执行${ACTION_NAMES[repeat.action]}（基础强度 ${repeat.strength}），X 需另行消耗；最多还可 ${repeat.remaining + 1} 次`,
        [...options, option('skip', '放弃第二次行动', [item(actor, { type: 'end-repeat' })])]);
      break;
    }
    case 'start-repeat':
      if (!state.context || effect.spendX > player.x) throw new Error('第二次行动的 X 不足。');
      player.x -= effect.spendX;
      {
        const context = state.context;
        state.context = { ...actionContext(context.action, context.strength + effect.spendX, context.upgraded, context.repeatRemaining), after: context.after, spentX: effect.spendX, ...(context.continuation ? { continuation: context.continuation } : {}), ...(context.playedAnimals ? { playedAnimals: context.playedAnimals } : {}) };
      }
      if (state.context?.action === 'cards') state.breakProgress = Math.min(9, state.breakProgress + 2);
      if (state.context?.action === 'animals' && state.context.upgraded && state.context.strength >= 5) prepend(state, [gainItem(actor, 'reputation', 1)]);
      break;
    case 'end-repeat':
      state.context!.repeatRemaining = 0;
      completeAction(state, events);
      break;
    case 'offer-free-build': {
      const commands = buildCommands(state, { ...player, money: Math.max(10, player.money) }, BUILDING_SHAPES[effect.kind].length, player.upgrades.includes('build'), [], Infinity, effect.waiveSpecialUpgrade).filter(command => command.kind === effect.kind);
      makeChoice(state, actor, `免费建造${BUILDING_NAMES[effect.kind]}：选择一个合法位置，或跳过`,
        commands.map((command, index) => option(`free-${index}`, `${BUILDING_NAMES[command.kind]} · 锚点 ${command.q},${command.r} · 旋转 ${command.rotation * 60}°${command.flip ? ' · 镜像' : ''}`, [item(actor, { type: 'place-free-build', command, ...(effect.waiveSpecialUpgrade ? { waiveSpecialUpgrade: true } : {}) })])), 0, 1);
      break;
    }
    case 'place-free-build':
      prepend(state, placeBuilding(state, player, effect.command, true, events));
      break;
    case 'score': {
      const totals = state.players.map(candidate => {
        let points = candidate.finals.reduce((total, id) => total + finalCardPoints(state, candidate, id), 0);
        if (CONTINENTS.every(tag => (tagsOf(candidate)[tag] ?? 0) > 0)) points += Number(candidate.sponsors.includes('225')) + Number(candidate.sponsors.includes('226'));
        if (candidate.sponsors.includes('261') && ANIMAL_TAG_COUNT(candidate) >= 5) points += 1;
        if (candidate.universities.length === 3) points += Number(candidate.sponsors.includes('203')) + Number(candidate.sponsors.includes('209'));
        if (candidate.reputation >= 9 && candidate.sponsors.includes('220')) points += 1;
        const tags = tagsOf(candidate);
        if (candidate.sponsors.includes('201')) points += (tags.science ?? 0) >= 6 ? 2 : (tags.science ?? 0) >= 3 ? 1 : 0;
        if (candidate.sponsors.includes('208') && ANIMAL_TAG_COUNT(candidate) >= 5) points += 1;
        if (candidate.sponsors.includes('210') && candidate.buildings.filter(building => building.kind === 'kiosk').length >= 5) points += 1;
        if (candidate.sponsors.includes('211') && candidate.buildings.filter(building => building.kind.startsWith('enclosure') && housingCapacity(building, candidate.map) === 1 && buildingUsedSpace(building) > 0).length >= 5) points += 1;
        if (candidate.sponsors.includes('241') && allTerrainConnected(candidate, 'water')) points += 1;
        if (candidate.sponsors.includes('242') && allTerrainConnected(candidate, 'rock')) points += 1;
        if (candidate.sponsors.includes('214')) candidate.appeal = Math.min(113, candidate.appeal + candidate.x);
        points += candidate.sponsors.reduce((total, id) => total + newSponsorFinalPoints(candidate, id), 0);
        candidate.appeal = Math.min(113, candidate.appeal + candidate.sponsors.reduce((total, id) => total + newSponsorFinalAppeal(candidate, id), 0));
        return { candidate, points };
      });
      for (const { candidate, points } of totals) {
        candidate.conservation = Math.min(41, candidate.conservation + points);
        events.push(event('score.final', `${candidate.name} 终局卡与赞助商额外获得 ${points} 保护点。`));
      }
      state.phase = 'finished';
      state.stage = 'finished';
      events.push(event('game.finished', '终局计分完成；同分时比较支持保护项目数量。'));
      break;
    }
  }
}

function ANIMAL_TAG_COUNT(player: ArkPlayer): number { return projectMetric(player, 'all-animals'); }
function drain(state: ArkState, events: ArkEvent[]) {
  let count = 0;
  while (state.queue.length && !state.pending) {
    if (++count > 1000) throw new Error('结算链超出安全上限。');
    const current = state.queue.shift()!;
    resolveEffect(state, current.actor, current.effect, events);
  }
}
function animalCommands(state: ArkState, player: ArkPlayer, marketAllowed: boolean): Extract<ArkCommand, { type: 'animal' }>[] {
  const result: Extract<ArkCommand, { type: 'animal' }>[] = [];
  for (const source of ['hand', 'market'] as const) {
    if (source === 'market' && !marketAllowed) continue;
    const cards = source === 'hand' ? player.hand : state.market.slice(0, reputationRange(player.reputation)).filter(card => card !== null);
    for (const id of cards) {
      const rulePlayer = state.context?.cardOwner && state.context.action === 'animals' ? { ...player, upgrades: state.context.upgraded ? [...new Set([...player.upgrades, 'animals' as const])] : player.upgrades.filter(action => action !== 'animals') } : player;
      if (zooCard(id).kind !== 'animal' || requirementError(rulePlayer, id) || player.money < animalCost(state, player, id, source)) continue;
      if (canFlock(player, id)) result.push({ type: 'animal', card: id, source, building: 'flock' });
      for (const building of player.buildings) if (!housingError(building, id, player.map, player.sponsors.includes('219'))) result.push({ type: 'animal', card: id, source, building: building.id });
    }
  }
  return result;
}
function associationError(state: ArkState, player: ArkPlayer, command: Extract<ArkCommand, { type: 'association' }>, remaining: number, upgraded: boolean, tasks: string[]): string | null {
  const cost = command.task === 'reputation' ? 2 : command.task === 'partner' ? 3 : command.task === 'university' ? 4 : player.sponsors.includes('203') ? 4 : 5;
  if (cost > remaining) return `此协会任务需要强度 ${cost}。`;
  if (!upgraded && tasks.length) return '协会 I 每次只能执行一项任务。';
  if (tasks.includes(command.task)) return '同一次协会行动不能重复相同任务。';
  if (availableWorkers(player) < workerCost(player, command.task)) return '可用事务员不足；重复相同任务需要 2 人。';
  if (command.task === 'partner') {
    if (player.partners.includes(command.target) || !state.partnerSupply.includes(command.target)) return '此合作动物园当前不可用。';
    if (player.partners.length >= (upgraded && player.upgrades.includes('association') ? 4 : 2)) return '第三与第四个合作动物园需要自己的协会 II，且本次行动须使用 II 面。';
  }
  if (command.task === 'university' && (player.universities.includes(command.target) || !state.universitySupply.includes(command.target))) return '此大学当前不可用。';
  if (command.task === 'project') {
    const source = command.source ?? 'board';
    const base = state.projects.find(candidate => candidate.id === command.target);
    const active = state.activeProjects.find(candidate => candidate.id === command.target);
    const spec = [...BASE_PROJECTS, ...DECK_PROJECTS].find(project => project.id === command.target);
    if (source !== 'board') {
      if (!spec || !(source === 'hand' ? player.hand : state.market).includes(command.target)) return '保护项目不在指定牌区。';
      if (base || active) return '此项目已经在场上。';
      if (source === 'market') {
        const index = state.market.indexOf(command.target);
        if (!upgraded || index >= reputationRange(player.reputation)) return '从展示区打出项目需要协会 II 和声望范围。';
        if (player.money < index + 1) return '不足以支付展示位费用。';
      }
    }
    const project = base ?? active ?? (source !== 'board' && spec ? { id: spec.id, blocked: -1, claimed: [null, null, null] } : null);
    if (!project) return '此保护项目不在本局场上。';
    const release = DECK_PROJECTS.find(spec => spec.id === project.id)?.mode === 'release';
    if (project.claimed.includes(player.id) && !(release && player.sponsors.includes('224'))) return '每个基础保护项目每人仅能支持一次。';
    if (project.blocked === command.tier || project.claimed[command.tier]) return '此项目等级已被封锁或占用。';
    const requirement = projectRequirementError(player, project.id, command.tier, command.releaseAnimal);
    const wildcards = command.wildcards ?? (command.wildcard ? [command.wildcard] : []);
    if (wildcards.length) {
      if (!base || wildcards.some(id => !player.sponsors.includes(id) || !(player.sponsorTokens?.[id] ?? 0))) return '通配标记仅可用于协会板下方基础项目，且须有剩余标记。';
      const spec = projectById(project.id);
      if (projectMetric(player, spec.tag) + wildcards.length < spec.thresholds[command.tier]!) return '使用通配图标后仍不满足项目条件。';
    } else if (requirement) return requirement;
    if (!projectRewardsFor(player).includes(command.reward) || player.projectRewards.includes(command.reward)) return '左侧边缘奖励已经使用或不存在。';
  }
  return null;
}
function associationCommands(state: ArkState, player: ArkPlayer, remaining: number, upgraded: boolean, tasks: string[]): Extract<ArkCommand, { type: 'association' }>[] {
  const commands: Extract<ArkCommand, { type: 'association' }>[] = [
    { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false },
    ...state.partnerSupply.map(target => ({ type: 'association' as const, task: 'partner' as const, target, tier: 0, reward: 'money-12', rewardFirst: false })),
    ...state.universitySupply.map(target => ({ type: 'association' as const, task: 'university' as const, target, tier: 0, reward: 'money-12', rewardFirst: false }))
  ];
  const projects = [
    ...[...state.projects, ...state.activeProjects].map(project => ({ id: project.id, source: 'board' as const })),
    ...player.hand.filter(id => zooCard(id).kind === 'project').map(id => ({ id, source: 'hand' as const })),
    ...(upgraded ? state.market.filter(id => id && zooCard(id).kind === 'project').map(id => ({ id: id!, source: 'market' as const })) : [])
  ];
  for (const project of projects) for (const tier of [0, 1, 2]) {
    const spec = DECK_PROJECTS.find(candidate => candidate.id === project.id);
    const animals = spec?.mode === 'release' ? player.animals.filter(id => !projectRequirementError(player, project.id, tier, id)) : [''];
    for (const animal of animals) for (const reward of projectRewardsFor(player)) {
      commands.push({ type: 'association', task: 'project', target: project.id, source: project.source, tier, reward, rewardFirst: false, releaseAnimal: animal });
      if (project.source === 'board' && state.projects.some(current => current.id === project.id)) for (const wildcard of ['215', '218'] as const) if ((player.sponsorTokens?.[wildcard] ?? 0) > 0) commands.push({ type: 'association', task: 'project', target: project.id, source: project.source, tier, reward, rewardFirst: false, releaseAnimal: animal, wildcard });
      if (project.source === 'board' && state.projects.some(current => current.id === project.id) && (player.sponsorTokens?.['215'] ?? 0) > 0 && (player.sponsorTokens?.['218'] ?? 0) > 0) commands.push({ type: 'association', task: 'project', target: project.id, source: project.source, tier, reward, rewardFirst: false, releaseAnimal: animal, wildcards: ['215', '218'] });
    }
  }
  return commands.filter(command => !associationError(state, player, command, remaining, upgraded, tasks));
}

export function validateArkCommand(state: ArkState, actor: string, command: ArkCommand): RuleError | null {
  if (state.phase === 'finished') return ruleError('对局已经结束。', 'FINISHED');
  if (actor !== arkActor(state)) return ruleError('现在需要另一位玩家操作。', 'WRONG_ACTOR');
  const player = arkPlayer(state, actor);
  const context = state.context;
  if (state.pending) {
    if (command.type !== 'resolve') return ruleError('先完成当前选择。', 'CHOICE_REQUIRED');
    if (command.choiceId !== state.pending.id || new Set(command.options).size !== command.options.length ||
      command.options.length < state.pending.min || command.options.length > state.pending.max ||
      command.options.some(id => !state.pending!.options.some(option => option.id === id))) return ruleError('选择数量不符或选项已失效。', 'INVALID_CHOICE');
    return null;
  }
  if (command.type === 'resolve') return ruleError('当前没有待处理选择。');
  if (command.type === 'begin' || command.type === 'take-x') {
    if (context || state.stage !== 'turn') return ruleError('先完成当前行动。');
    if (command.type === 'take-x') {
      if (doubleUses(command) > player.doubleTokens.filter(action => action === command.action).length) return ruleError('该行动卡上的双重标记不足。');
      return player.x >= 5 ? ruleError('X 标记最多 5 枚。') : null;
    }
    if (command.spendX > player.x) return ruleError('X 标记不足。');
    if (doubleUses(command) > player.doubleTokens.filter(action => action === command.action).length) return ruleError('该行动卡上的双重标记不足。');
    const strength = actionStrength(state, player, command.action, command.spendX);
    if (strength < 1) return ruleError('缠绕后的强度不足 1，须使用 X 或替代行动。');
    const upgraded = player.upgrades.includes(command.action);
    const prospectivePlayer = command.action === 'animals' && upgraded && strength >= 5
      ? { ...player, reputation: Math.min(player.upgrades.includes('cards') ? 15 : 9, player.reputation + 1) } : player;
    if (command.action === 'animals' && (!animalCapacity(strength, upgraded) || !animalCommands(state, prospectivePlayer, upgraded).length)) return ruleError('强度不足，或没有满足费用、条件与饲养区需求的动物。');
    if (command.action === 'build' && !buildCommands(state, player, strength, upgraded, [], 1).length) return ruleError('没有可支付且合法的建筑位置。');
    if (command.action === 'association' && !associationCommands(state, player, strength, upgraded, []).length) return ruleError('没有可执行的协会任务，或事务员不足。');
    if (command.action === 'cards' && !state.deck.length && !state.discard.length &&
      !(cardActionTable(strength, upgraded).snap ? state.market.some(Boolean) : upgraded && state.market.slice(0, reputationRange(player.reputation)).some(Boolean))) return ruleError('没有可获得的卡牌。');
    return null;
  }
  if (!context) return ruleError('请先选择一张行动卡。');
  if (command.type === 'finish') return context.action !== 'cards' && context.played > 0 ? null : ruleError('必须完成本次行动规定的抓牌与弃牌，且不能执行零次行动。');
  if (command.type === 'build') {
    if (context.action !== 'build') return ruleError('先选择建造行动。');
    if (uniqueKind(command.kind.replace('unique-', ''))) return ruleError('独有建筑须通过对应赞助商免费建造。');
    const size = BUILDING_SHAPES[command.kind].length;
    if (size > context.remaining || (context.upgraded && context.built.includes(command.kind))) return ruleError('剩余强度不足或已经建过相同类型。');
    if (player.money < size * 2) return ruleError(`建造需要 ${size * 2} 资金。`);
    if (state.players.flatMap(candidate => candidate.buildings).filter(building => building.kind === command.kind).length >= BUILDING_SUPPLY[command.kind]) return ruleError('建筑供应已耗尽。');
    const error = placementError(player.buildings, command.kind, buildingCells(command.kind, command, command.rotation, command.flip), context.upgraded, player.map, false, player.sponsors.includes('219'));
    return error ? ruleError(error) : null;
  }
  if (command.type === 'draw') {
    if (context.action !== 'cards' || context.remaining <= 0) return ruleError('当前不能抓牌。');
    if (command.source === 'deck') return state.deck.length || state.discard.length ? null : ruleError('牌库已空。');
    const index = state.market.indexOf(command.card);
    if (!context.upgraded || index < 0 || index >= reputationRange(player.reputation)) return ruleError('需要卡牌 II 且展示牌在声望范围内。');
    return null;
  }
  if (command.type === 'snap') {
    if (context.action !== 'cards' || context.played || !cardActionTable(context.strength, context.upgraded).snap) return ruleError('当前强度不能精选，或已经开始抓牌。');
    return state.market.includes(command.card) ? null : ruleError('此展示牌已失效。');
  }
  if (command.type === 'income') return context.action === 'sponsors' && context.played === 0 ? null : ruleError('当前不能选择赞助商拿钱。');
  if (command.type === 'animal' || command.type === 'sponsor') {
    if ((command.type === 'animal' ? 'animals' : 'sponsors') !== context.action) return ruleError('卡牌种类不符合当前行动。');
    if (!(command.source === 'hand' ? player.hand : state.market).includes(command.card)) return ruleError('卡牌不在指定位置。');
    if (command.source === 'market' && (!context.upgraded || state.market.indexOf(command.card) >= reputationRange(player.reputation))) return ruleError('只能用升级行动打出声望范围内的展示牌。');
    const card = zooCard(command.card);
    if (card.kind !== (command.type === 'animal' ? 'animal' : 'sponsor')) return ruleError('卡牌类型不匹配。');
    const rulePlayer = command.type === 'animal' && context.cardOwner ? { ...player, upgrades: context.upgraded ? [...new Set([...player.upgrades, 'animals' as const])] : player.upgrades.filter(action => action !== 'animals') } : player;
    const requirements = requirementError(rulePlayer, card.id);
    if (requirements) return ruleError(requirements);
    if (command.type === 'animal') {
      if (context.remaining < 1) return ruleError('本次动物行动额度已用完。');
      if (player.money < animalCost(state, player, card.id, command.source)) return ruleError('安置费用不足，不能预支卡牌奖励。');
      if (command.building === 'flock') return canFlock(player, card.id) ? null : ruleError('群居需要已有同等或更大面积的食草动物。');
      const building = player.buildings.find(candidate => candidate.id === command.building);
      if (!building) return ruleError('请选择饲养区。');
      const housing = housingError(building, card.id, player.map, player.sponsors.includes('219'));
      return housing ? ruleError(housing) : null;
    }
    if (card.strength > context.remaining) return ruleError('赞助商等级超过剩余强度。');
    const sponsor = sponsorError(state, player, card.id);
    if (sponsor) return ruleError(sponsor);
    return command.source === 'market' && player.money < state.market.indexOf(card.id) + 1 ? ruleError('不足以支付展示位费用。') : null;
  }
  if (command.type === 'association') {
    if (context.action !== 'association') return ruleError('先选择协会行动。');
    const error = associationError(state, player, command, context.remaining, context.upgraded, context.tasks);
    return error ? ruleError(error) : null;
  }
  if (command.type === 'donate') return context.action === 'association' && context.upgraded && context.played > 0 && !context.donated && player.money >= donationCost(state.donations) ? null : ruleError('捐赠要求协会 II、已执行任务、足够资金，且每次仅一次。');
  return ruleError('未知操作。');
}

function removeCard(state: ArkState, player: ArkPlayer, card: string, source: 'hand' | 'market') {
  if (source === 'hand') player.hand.splice(player.hand.indexOf(card), 1);
  else state.market[state.market.indexOf(card)] = null;
}
function sponsorError(state: ArkState, player: ArkPlayer, id: string): string | null {
  const requirement = requirementError(player, id);
  if (requirement) return requirement;
  const unique = uniqueKind(id);
  return unique && !uniqueCommands(state, player, id, 1).length ? '独有建筑没有满足形状、地形和边界要求的合法位置，不能打出此赞助商。' : null;
}
function triggerExperts(state: ArkState, cardId: string, events: ArkEvent[]) {
  const card = zooCard(cardId);
  for (const owner of state.players) for (const sponsor of owner.sponsors) {
    if (expertTags[sponsor]) {
      const count = card.tags.filter(tag => tag === expertTags[sponsor]).length;
      if (count) gain(state, owner, 'money', count * 3, events);
    }
  }
}
function animalEffects(state: ArkState, player: ArkPlayer, cardId: string): QueueItem<ArkEffect>[] {
  const card = zooCard(cardId);
  const effects = [gainItem(player.id, 'appeal', card.appeal), gainItem(player.id, 'conservation', card.conservation), gainItem(player.id, 'reputation', card.reputation)].filter(queued => queued.effect.type !== 'gain' || queued.effect.amount > 0);
  const attack = card.abilities.find(ability => ['VENOM', 'CONSTRICTION', 'HYPNOSIS', 'PILFERING_1', 'PILFERING_2'].includes(ability.key));
  if (attack) return [item(player.id, { type: 'attack-order', ability: attack.key, count: Number(attack.value), rewards: effects })];
  if (player.sponsors.includes('227') && player.animalFocus && (player.animalFocus === 'small' ? card.size <= 2 : card.size >= 4)) effects.push(gainItem(player.id, 'appeal', player.animalFocus === 'small' ? 2 : 4));
  for (const ability of card.abilities) {
    const count = Number(ability.value);
    if (ability.key === 'SPRINT') effects.push(item(player.id, { type: 'draw', count }));
    else if (ability.key === 'PACK') effects.push(gainItem(player.id, 'appeal', tagsOf(player).predator ?? 0));
    else if (ability.key === 'JUMPING') { state.breakProgress = Math.min(9, state.breakProgress + count); effects.push(gainItem(player.id, 'money', count)); }
    else if (ability.key === 'INVENTIVE') effects.push(gainItem(player.id, 'x', 1));
    else if (ability.key === 'INVENTIVE_BEAR') effects.push(gainItem(player.id, 'x', Math.min(3, state.players.reduce((total, candidate) => total + (tagsOf(candidate).bear ?? 0), 0))));
    else if (ability.key === 'INVENTIVE_PRIMARY') effects.push(gainItem(player.id, 'x', (tagsOf(player).primate ?? 0) >= 5 ? 3 : (tagsOf(player).primate ?? 0) >= 3 ? 2 : 1));
    else if (ability.key === 'FULL_THROATED') effects.push(item(player.id, { type: 'worker' }));
    else if (ability.key === 'CLEVER') state.context!.after.push(item(player.id, { type: 'clever' }));
    else if (ability.key.startsWith('BOOST_') && abilityActions[ability.key.slice(6)]) state.context!.after.push(item(player.id, { type: 'boost', action: abilityActions[ability.key.slice(6)]! }));
    else if (ability.key.startsWith('MULTIPLIER_') && abilityActions[ability.key.slice(11)]) effects.push(item(player.id, { type: 'set-double', action: abilityActions[ability.key.slice(11)]! }));
    else if (ability.key === 'DIGGING') effects.push(item(player.id, { type: 'dig', count }));
    else if (ability.key === 'POSTURING') effects.push(item(player.id, { type: 'offer-pavilions', count }));
    else if (ability.key === 'FLOCK_ANIMAL') continue;
    else if (ability.key === 'RESISTANCE') effects.push(item(player.id, { type: 'resistance' }));
    else if (ability.key === 'ASSERTION' || ability.key === 'DOMINANCE') effects.push(item(player.id, { type: 'base-project', target: ability.key === 'DOMINANCE' ? '108' : null }));
    else if (ability.key === 'PEACOCKING') effects.push(item(player.id, { type: 'offer-free-build', kind: 'aviary', waiveSpecialUpgrade: true }));
    else if (ability.key === 'DETERMINATION' || ability.key.startsWith('ACTION_')) {
      const action = ability.key === 'DETERMINATION' ? null : { ASSOCIATION: 'association', SPONSORS: 'sponsors', CARDS: 'cards', BUILDING: 'build' }[ability.key.slice(7)] as typeof ARK_ACTIONS[number];
      state.context!.after.push(item(player.id, { type: 'extra-action', action }));
    }
    else if (ability.key === 'HUNTER') effects.push(item(player.id, { type: 'hunt', count }));
    else if (ability.key === 'SUN_BATHING' || ability.key === 'POUCH') effects.push(item(player.id, { type: ability.key === 'POUCH' ? 'pouch' : 'sell', count, host: cardId }));
    else if (ability.key === 'PERCEPTION_4') effects.push(item(player.id, { type: 'perception', count: 4 }));
    else if (ability.key === 'SCAVENGING') effects.push(item(player.id, { type: 'scavenge', count }));
    else if (ability.key === 'SNAPPING_1' || ability.key === 'SNAPPING_2') effects.push(item(player.id, { type: 'snap', count: ability.key === 'SNAPPING_2' ? 2 : 1, refill: true, range: false }));
    else if (ability.key === 'ICONIC_ANIMAL') effects.push(gainItem(player.id, 'appeal', Math.min(8, state.players.reduce((total, candidate) => total + (tagsOf(candidate)[String(ability.value).toLowerCase()] ?? 0), 0))));
    else if (ability.key === 'PETTING_ZOO_ANIMAL') effects.push(gainItem(player.id, 'appeal', (tagsOf(player).pet ?? 0) * 3));
    else if (ability.key === 'SPONSOR_MAGNET') {
      for (let index = 0; index < state.market.length; index += 1) {
        const id = state.market[index];
        if (id && zooCard(id).kind === 'sponsor') { player.hand.push(id); state.market[index] = null; }
      }
    } else throw new Error(`未实现能力 ${ability.key}。`);
  }
  return effects;
}
function performCommand(state: ArkState, actor: string, command: ArkCommand): ArkEvent[] {
  const events: ArkEvent[] = [];
  const player = arkPlayer(state, actor);
  if (command.type === 'resolve') {
    const choice = state.pending!;
    const selected = command.options.map(id => choice.options.find(option => option.id === id)!);
    state.pending = null;
    if (choice.kind === 'setup') {
      const kept = selected.map(option => option.id);
      state.discard.push(...player.hand.filter(id => !kept.includes(id)));
      player.hand = kept;
    } else if (choice.kind === 'final') {
      state.finalDeck.push(...player.finals.filter(id => command.options.includes(id)));
      player.finals = player.finals.filter(id => !command.options.includes(id));
    }
    for (const selectedOption of selected) if (/^[58]-/.test(selectedOption.id)) state.claimedMilestones.push(selectedOption.id);
    for (const selectedOption of selected) if (/^[58]-/.test(selectedOption.id)) {
      const tile = state.bonusTiles.find(tile => `${tile.point}-${tile.reward}` === selectedOption.id);
      if (!tile || tile.claimedBy) throw new Error('该奖励板块已被拿取。');
      tile.claimedBy = actor;
    }
    prepend(state, selected.flatMap(option => option.effects));
    events.push(event('choice.completed', `${player.name} 完成「${choice.prompt}」。`));
  } else if (command.type === 'take-x') {
    if (!state.turnCheckpoint) state.turnCheckpoint = structuredClone(state);
    clearActionToken(state, player.id, command.action);
    state.constriction[player.id] = state.constriction[player.id]?.filter(action => action !== command.action) ?? [];
    const action = selectAction(player.row, command.action, player.x, 0, true);
    player.row = action.row; player.x = action.tokens;
    if (doubleUses(command)) {
      consumeDoubles(player, command.action, doubleUses(command));
      player.x = Math.min(5, player.x + doubleUses(command));
    }
    events.push(event('action.x', `${player.name} 选择${ACTION_NAMES[command.action]}替代行动，获得最多 ${doubleUses(command) + 1} 枚 X。`));
    prepend(state, [item(actor, { type: 'venom-payment' }), item(actor, { type: 'end-turn' })]);
  } else if (command.type === 'begin') {
    if (!state.turnCheckpoint) state.turnCheckpoint = structuredClone(state);
    const strength = actionStrength(state, player, command.action, command.spendX);
    clearActionToken(state, player.id, command.action);
    player.x -= command.spendX;
    const upgraded = player.upgrades.includes(command.action);
    consumeDoubles(player, command.action, doubleUses(command));
    state.context = actionContext(command.action, strength, upgraded, doubleUses(command));
    state.context.spentX = command.spendX;
    state.stage = 'action';
    events.push(event('action.started', `${player.name} 执行${ACTION_NAMES[command.action]} ${upgraded ? 'II' : 'I'}，强度 ${strength}${command.spendX ? `，消耗 ${command.spendX} 枚 X` : ''}。`));
    if (command.action === 'cards') state.breakProgress = Math.min(9, state.breakProgress + 2);
    if (command.action === 'animals' && upgraded && strength >= 5) prepend(state, [gainItem(actor, 'reputation', 1)]);
  } else {
    const context = state.context!;
    if (command.type === 'finish') completeAction(state, events);
    else if (command.type === 'build') {
      const effects = placeBuilding(state, player, command, false, events);
      context.remaining -= BUILDING_SHAPES[command.kind].length; context.played += 1; context.built.push(command.kind);
      prepend(state, [...effects, item(actor, { type: 'continue' })]);
    } else if (command.type === 'draw' || command.type === 'snap') {
      if (command.type === 'draw') {
        if (command.source === 'deck') drawToHand(state, player, 1, events);
        else { removeCard(state, player, command.card, 'market'); player.hand.push(command.card); }
        context.remaining -= 1; context.played += 1;
        if (context.remaining <= 0 || (!state.deck.length && !state.discard.length && !(context.upgraded && state.market.slice(0, reputationRange(player.reputation)).some(Boolean)))) {
          const discard = cardActionTable(context.strength, context.upgraded).discard;
          context.remaining = 0;
          prepend(state, [...(discard ? [item(actor, { type: 'discard', count: discard, reason: '卡牌行动表' } as const)] : []), item(actor, { type: 'continue' })]);
        }
      } else {
        removeCard(state, player, command.card, 'market');
        player.hand.push(command.card); context.remaining = 0; context.played = 1;
        prepend(state, [item(actor, { type: 'continue' })]);
      }
    } else if (command.type === 'income') {
      const amount = context.strength * (context.upgraded ? 2 : 1);
      state.breakProgress = Math.min(9, state.breakProgress + context.strength);
      context.remaining = 0; context.played = 1;
      prepend(state, [gainItem(actor, 'money', amount), item(actor, { type: 'continue' })]);
    } else if (command.type === 'animal' || command.type === 'sponsor') {
      const card = zooCard(command.card);
      const cost = command.type === 'animal' ? animalCost(state, player, card.id, command.source) : command.source === 'market' ? state.market.indexOf(card.id) + 1 : 0;
      player.money -= cost;
      removeCard(state, player, card.id, command.source);
      let effects: QueueItem<ArkEffect>[];
      if (command.type === 'animal') {
        player.animals.push(card.id);
        const building = player.buildings.find(building => building.id === command.building);
        if (building) {
          building.occupancy = building.kind.startsWith('enclosure') ? 1 : buildingUsedSpace(building) + (building.kind === 'petting' ? 1 : card.specialHousing!.space);
          building.animals.push(card.id);
        }
        context.remaining -= 1;
        context.playedAnimals = [...(context.playedAnimals ?? []), card.id];
        effects = animalEffects(state, player, card.id);
        if (building && player.map === '1' && building.kind.startsWith('enclosure') && nextToLandmark(building, player.map)) effects.push(gainItem(actor, 'appeal', 2));
      } else {
      registerSponsor(state, player, card.id);
        context.remaining -= card.strength;
        effects = sponsorEffects(player, card.id, state);
      }
      context.played += 1;
      triggerExperts(state, card.id, events);
      prepend(state, [...iconEffects(state, player, cardIcons(card), effects), item(actor, { type: 'continue' })]);
      events.push(event('card.played', `${player.name} ${command.type === 'animal' ? '安置动物' : '打出赞助商'}「${card.name}」${cost ? `，支付 ${cost} 资金` : ''}。`));
    } else if (command.type === 'association') {
      const cost = command.task === 'reputation' ? 2 : command.task === 'partner' ? 3 : command.task === 'university' ? 4 : player.sponsors.includes('203') ? 4 : 5;
      player.usedWorkers[command.task] = (player.usedWorkers[command.task] ?? 0) + workerCost(player, command.task);
      context.remaining -= cost; context.played += 1; context.tasks.push(command.task);
      if (!context.upgraded) context.remaining = 0;
      const effects: QueueItem<ArkEffect>[] = [];
      if (command.task === 'reputation') effects.push(gainItem(actor, 'reputation', 2));
      else if (command.task === 'partner') {
        effects.push(...takePartner(state, player, command.target));
      } else if (command.task === 'university') {
        effects.push(...takeUniversity(state, player, command.target));
      } else {
        const source = command.source ?? 'board';
        const spec = DECK_PROJECTS.find(project => project.id === command.target);
        if (source !== 'board') {
          if (source === 'market') player.money -= state.market.indexOf(command.target) + 1;
          removeCard(state, player, command.target, source);
          state.activeProjects.unshift({ id: command.target, blocked: -1, claimed: [null, null, null] });
          if (state.activeProjects.length > 2) {
            const displaced = state.activeProjects.pop()!;
            state.discard.push(displaced.id);
            events.push(event('project.displaced', `新增项目将${projectById(displaced.id).name}推出场外，标记返回各自供应区。`));
          }
          if (spec?.playReputation) effects.push(gainItem(actor, 'reputation', spec.playReputation));
        }
        const project = [...state.projects, ...state.activeProjects].find(candidate => candidate.id === command.target)!;
        for (const wildcard of command.wildcards ?? (command.wildcard ? [command.wildcard] : [])) player.sponsorTokens![wildcard] = player.sponsorTokens![wildcard]! - 1;
        project.claimed[command.tier] = actor;
        player.projectRewards.push(command.reward);
        player.supportedProjects.push(command.target);
        if (spec?.mode === 'release') {
          const animal = command.releaseAnimal!;
          releaseHousing(player, animal);
          player.animals.splice(player.animals.indexOf(animal), 1);
          state.discard.push(animal);
          const buried = player.buried.filter(card => card.host === animal);
          state.discard.push(...buried.map(card => card.card));
          player.buried = player.buried.filter(card => card.host !== animal);
          player.appeal = Math.max(0, player.appeal - zooCard(animal).appeal);
          events.push(event('animal.released', `${player.name} 放归${zooCard(animal).name}，回退 ${zooCard(animal).appeal} 魅力；保留保护与声望。`));
        }
        const projectEffects = [gainItem(actor, 'conservation', projectById(project.id).points[command.tier]!)];
        if (spec?.mode === 'release' && player.sponsors.includes('224')) projectEffects.push(gainItem(actor, 'conservation', 1));
        if (spec?.reputation[command.tier]) projectEffects.push(gainItem(actor, 'reputation', spec.reputation[command.tier]!));
        const reward = rewardEffects(actor, command.reward);
        effects.push(...(command.rewardFirst ? [...reward, ...projectEffects] : [...projectEffects, ...reward]));
      }
      prepend(state, [...effects, item(actor, { type: 'continue' })]);
      events.push(event('association.task', `${player.name} 完成协会任务：${command.task === 'reputation' ? '声望 +2' : command.task === 'partner' ? `${TAG_NAMES[command.target]}合作动物园` : command.task === 'university' ? UNIVERSITY_NAMES[command.target] : `支持${projectById(command.target).name}，激活${PROJECT_REWARD_NAMES[command.reward]}`}。`));
    } else if (command.type === 'donate') {
      const cost = donationCost(state.donations);
      player.money -= cost; state.donations += 1; context.donated = true;
      prepend(state, [gainItem(actor, 'conservation', 1)]);
      events.push(event('association.donation', `${player.name} 支付 ${cost} 资金捐赠，获得 1 保护。`));
    }
  }
  drain(state, events);
  return events;
}

export const arkGame: GameModule<ArkState, ArkConfig, ArkCommand, ArkView, ArkResult> = {
  manifest: {
    gameId: 'ark-nova', engineVersion: ENGINE_VERSION, rulesVersion: 'base-v2-library-1',
    contentVersion: `base-library-1+${fingerprint({ cards: ZOO_CARDS, projects: [...BASE_PROJECTS, ...DECK_PROJECTS], finals: FINAL_CARDS, maps: MAPS, mapInfo: MAP_INFO, bonuses: BONUS_TILES, shapes: BUILDING_SHAPES })}`
  },
  parseConfig: input => arkConfigSchema.parse(input),
  parseCommand: input => arkCommandSchema.parse(input),
  createGame(config, seed) {
    let rng = seed;
    const deck = shuffle(CARD_IDS, rng); rng = deck.rng;
    const finals = shuffle(FINAL_CARDS.map(card => card.id), rng); rng = finals.rng;
    const projects = shuffle(BASE_PROJECTS.map(project => project.id), rng); rng = projects.rng;
    const bonuses = shuffle(BONUS_TILES, rng); rng = bonuses.rng;
    const players: ArkPlayer[] = [];
    for (let index = 0; index < 2; index += 1) {
      const actions = initialActionRow(rng); rng = actions.rng;
      players.push({
        id: `p${index + 1}`, name: index === 0 ? '你的动物园' : '林野动物园 AI', map: config.map,
        money: 25, appeal: index, conservation: 0, reputation: 1, x: 0,
        row: actions.row, upgrades: [], hand: deck.values.splice(0, 8), finals: finals.values.splice(0, 2),
        animals: [], sponsors: [], buried: [], buildings: startingBuildings(config.map), partners: [], universities: [],
        workers: 1, usedWorkers: {}, projectRewards: [], coveredRewards: [], mapCompleted: false, doubleTokens: [], supportedProjects: []
      });
    }
    const state: ArkState = {
      revision: 0, rng, phase: 'playing', stage: 'setup', activePlayer: 'p1', players,
      deck: deck.values, discard: [], revealed: [], market: Array.from({ length: 6 }, () => null),
      finalDeck: finals.values, finalDiscard: [], finalRevealed: [], baseReserve: projects.values.slice(3), requiredBuildings: [], projects: projects.values.slice(0, 3).map((id, index) => ({ id, blocked: index, claimed: [null, null, null] })),
      activeProjects: [], bonusTiles: bonuses.values.slice(0, 4).map((reward, index) => ({ point: index < 2 ? 5 : 8, reward, claimedBy: null })),
      partnerSupply: [...CONTINENTS], universitySupply: Object.keys(UNIVERSITY_NAMES), donations: 0,
      breakProgress: 0, breaks: 0, turns: 0, finalReduced: false, finalTurns: null, endingTrigger: null,
      context: null, repeatContext: null, queue: [item('p1', { type: 'setup' }), item('p2', { type: 'setup' }), item('p1', { type: 'setup-complete' })],
      pending: null, choiceSequence: 0, buildingSequence: 0, claimedMilestones: [], venom: {}, constriction: {}, venomRemoved: false, turnCheckpoint: null
    };
    drain(state, []);
    return state;
  },
  getPlayerView(state, viewer) {
    return {
      revision: state.revision, phase: state.phase, stage: state.stage, activePlayer: state.activePlayer, actor: arkActor(state),
      players: state.players.map(player => ({
        ...structuredClone(player),
        hand: player.id === viewer ? [...player.hand] : [], handCount: player.hand.length,
        finals: player.id === viewer ? [...player.finals] : [], finalCount: player.finals.length,
        buried: player.buried.map(buried => ({ host: buried.host, card: player.id === viewer ? buried.card : 'hidden' }))
      })),
      market: [...state.market], deckCount: state.deck.length, discardCount: state.discard.length,
      projects: structuredClone(state.projects), activeProjects: structuredClone(state.activeProjects), bonusTiles: structuredClone(state.bonusTiles), partnerSupply: [...state.partnerSupply], universitySupply: [...state.universitySupply],
      donations: state.donations, breakProgress: state.breakProgress, breaks: state.breaks, turns: state.turns,
      finalTurns: state.finalTurns,
      venom: structuredClone(state.venom), constriction: structuredClone(state.constriction),
      context: state.context ? { ...structuredClone(state.context), after: [], ...(state.context.continuation ? { continuation: [] } : {}) } : null,
      pending: state.pending ? {
        ...structuredClone(state.pending),
        prompt: state.pending.actor === viewer ? state.pending.prompt : '另一位玩家正在完成选择',
        options: state.pending.actor === viewer ? state.pending.options.map(({ id, label, card, effects }) => {
          const placement = effects.find(item => item.actor === state.pending!.actor && (item.effect.type === 'place-free-build' || item.effect.type === 'place-engineer'))?.effect;
          return { id, label, card, ...(placement?.type === 'place-free-build' || placement?.type === 'place-engineer' ? { placement: structuredClone(placement.command) } : {}) };
        }) : []
      } : null
    };
  },
  getDecision(state, actor) {
    if (state.phase === 'finished' || arkActor(state) !== actor) return null;
    const player = arkPlayer(state, actor);
    const options: Decision<ArkCommand>['options'] = [];
    const add = (id: string, label: string, command: ArkCommand) => {
      if (!validateArkCommand(state, actor, command)) options.push({ id, label, command });
    };
    if (state.pending) {
      if (state.pending.min !== 1 || state.pending.max !== 1) return {
        actor, prompt: state.pending.prompt, options: [{
          id: 'select-cards', label: state.pending.prompt,
          command: { type: 'resolve', choiceId: state.pending.id, options: state.pending.options.slice(0, state.pending.min).map(option => option.id) }
        }]
      };
      return { actor, prompt: state.pending.prompt, options: state.pending.options.map(choice => ({
        id: choice.id, label: choice.label, command: { type: 'resolve', choiceId: state.pending!.id, options: [choice.id] }
      })) };
    }
    if (!state.context) {
      for (const action of ARK_ACTIONS) {
        for (let spendX = 0; spendX <= player.x; spendX += 1) {
          add(`${action}-${spendX}`, `${ACTION_NAMES[action]}，强度 ${strengthFor(player, action, spendX)}`, { type: 'begin', action, spendX });
          for (let doubleCount = 1; doubleCount <= player.doubleTokens.filter(token => token === action).length; doubleCount += 1) add(`${action}-${spendX}-double-${doubleCount}`, `双重${ACTION_NAMES[action]} ×${doubleCount + 1}`, { type: 'begin', action, spendX, useDouble: true, doubleCount });
        }
        add(`x-${action}`, `${ACTION_NAMES[action]}替代：获得 X`, { type: 'take-x', action });
        for (let doubleCount = 1; doubleCount <= player.doubleTokens.filter(token => token === action).length; doubleCount += 1) add(`double-x-${action}-${doubleCount}`, `消耗 ${doubleCount} 枚双重标记获得最多 ${doubleCount + 1} 枚 X`, { type: 'take-x', action, useDouble: true, doubleCount });
      }
    } else {
      const context = state.context;
      if (context.action === 'build') {
        for (const command of buildCommands(state, player, context.remaining, context.upgraded, context.built)) add(`build-${options.length}`, BUILDING_NAMES[command.kind], command);
      } else if (context.action === 'animals') {
        for (const command of animalCommands(state, player, context.upgraded)) add(`animal-${options.length}`, `安置${zooCard(command.card).name}`, command);
      } else if (context.action === 'cards') {
        add('draw-deck', '从牌库抽取 1 张', { type: 'draw', source: 'deck', card: '' });
        for (const card of state.market) if (card) {
          add(`draw-${card}`, `拿取${zooCard(card).name}`, { type: 'draw', source: 'market', card });
          add(`snap-${card}`, `精选${zooCard(card).name}`, { type: 'snap', card });
        }
      } else if (context.action === 'sponsors') {
        add('income', '推进休息并领取资金', { type: 'income' });
        for (const source of ['hand', 'market'] as const) for (const card of (source === 'hand' ? player.hand : state.market)) {
          if (card && zooCard(card).kind === 'sponsor') add(`sponsor-${card}`, zooCard(card).name, { type: 'sponsor', card, source });
        }
      } else {
        for (const command of associationCommands(state, player, context.remaining, context.upgraded, context.tasks)) add(`association-${options.length}`, `${command.task} ${command.target} ${command.reward}`, command);
        add('donate', `捐赠 ${donationCost(state.donations)} 资金`, { type: 'donate' });
      }
      add('finish', '结束本次行动', { type: 'finish' });
    }
    return { actor, prompt: state.context ? `执行${ACTION_NAMES[state.context.action]}` : '选择五行动之一，或获取 X', options };
  },
  validateCommand: validateArkCommand,
  applyCommand: performCommand,
  getResult(state) {
    if (state.phase !== 'finished') return null;
    const scores = state.players.map(player => ({ player: player.id, appeal: player.appeal, conservation: player.conservation, points: victoryScore(player.appeal, player.conservation), projects: player.projectRewards.length }));
    const maximum = Math.max(...scores.map(score => score.points));
    const tied = scores.filter(score => score.points === maximum);
    const mostProjects = Math.max(...tied.map(score => score.projects));
    return { scores, winners: tied.filter(score => score.projects === mostProjects).map(score => score.player) };
  },
  assertInvariants(state) {
    const located = [...state.deck, ...state.discard, ...state.revealed, ...state.market.filter(card => card !== null), ...state.baseReserve, ...state.projects.map(project => project.id),
      ...state.activeProjects.map(project => project.id),
      ...state.players.flatMap(player => [...player.hand, ...player.animals, ...player.sponsors, ...player.buried.map(buried => buried.card)])];
    const allCards = [...CARD_IDS, ...BASE_PROJECTS.map(project => project.id)];
    if (located.length !== allCards.length || new Set(located).size !== allCards.length || located.some(id => !allCards.includes(id))) throw new Error('卡牌实例守恒失败。');
    const finals = [...state.finalDeck, ...state.finalDiscard, ...state.finalRevealed, ...state.players.flatMap(player => player.finals)];
    if (finals.length !== FINAL_CARDS.length || new Set(finals).size !== FINAL_CARDS.length) throw new Error('终局卡守恒失败。');
    for (const player of state.players) {
      if ([player.money, player.appeal, player.conservation, player.reputation, player.x].some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('资源无效。');
      if (player.x > 5 || player.reputation > (player.upgrades.includes('cards') ? 15 : 9) || availableWorkers(player) < 0 || player.workers > 4) throw new Error('资源上限或工人数量错误。');
      if (new Set(player.row).size !== 5 || player.row.length !== 5 || player.row.some(action => !ARK_ACTIONS.includes(action))) throw new Error('五行动顺序错误。');
      const occupied = player.buildings.flatMap(building => building.cells);
      if (new Set(occupied.map(hexKey)).size !== occupied.length || occupied.some(cell => !mapCells(player.map).some(candidate => hexKey(cell) === hexKey(candidate) && (candidate.terrain === 'land' || player.sponsors.includes('219'))))) throw new Error('地图建筑重叠或覆盖地形。');
      const housed = player.buildings.flatMap(building => building.animals);
      if (new Set(housed).size !== housed.length || housed.some(id => !player.animals.includes(id))) throw new Error('动物安置标签不一致。');
      for (const building of player.buildings) {
        const space = buildingUsedSpace(building);
        if (!Number.isInteger(space) || space < 0 || space > (building.kind.startsWith('enclosure') ? 1 : building.kind === 'petting' ? 3 : 5)) throw new Error('饲养区占用或容量无效。');
        if ((building.kind === 'aviary' || building.kind === 'reptile-house') && building.animals.some(id => zooCard(id).specialHousing?.kind !== building.kind)) throw new Error('特殊饲养区动物种类无效。');
      }
      if (player.supportedProjects.length !== player.projectRewards.length || new Set(player.projectRewards).size !== player.projectRewards.length) throw new Error('保护项目标记守恒失败。');
    }
    if (state.activeProjects.length > 2 || state.activeProjects.some(project => ![...BASE_PROJECTS, ...DECK_PROJECTS].some(spec => spec.id === project.id))) throw new Error('双人保护项目上方最多两张。');
    if (state.bonusTiles.length !== 4 || new Set(state.bonusTiles.map(tile => tile.reward)).size !== 4) throw new Error('随机保护奖励配置无效。');
    if (state.pending && (!state.players.some(player => player.id === state.pending!.actor) || state.pending.options.length < state.pending.min)) throw new Error('待处理选择无效。');
    if (!state.pending && state.queue.length) throw new Error('存在未结算队列。');
    if (state.phase === 'finished' && (state.pending || state.queue.length || state.context)) throw new Error('终局残留操作。');
    if (state.context && state.stage !== 'action') throw new Error('行动阶段不一致。');
  }
};
