import { ENGINE_VERSION, fingerprint, shuffle, type Decision, type GameModule, type QueueItem, type RuleError } from '@eurogame/engine-core';
import { hexKey } from '@eurogame/mechanisms';
import { ARK_ACTIONS, useAction } from './index.js';
import { ACTION_NAMES, animalCapacity, cardActionTable, initialActionRow, selectAction } from './foundation.js';
import { BASE_PROJECTS, CARD_IDS, CONTINENTS, FINAL_CARDS, TAG_NAMES, ZOO_CARDS, zooCard } from './cards.js';
import { appealIncome, buildingCells, BUILDING_NAMES, BUILDING_SHAPES, BUILDING_SUPPLY, MAP_A, kioskIncome, placementError, startingBuildings, victoryScore } from './board.js';
import { animalCost, arkActor, arkPlayer, availableWorkers, buildCommands, donationCost, finalCardPoints, handLimit, housingError, projectById, projectMetric, PROJECT_REWARDS, PROJECT_REWARD_NAMES, reputationRange, requirementError, strengthFor, tagsOf, UNIVERSITY_NAMES, workerCost } from './rules.js';
import { arkCommandSchema, arkConfigSchema, type ArkChoice, type ArkChoiceOption, type ArkCommand, type ArkConfig, type ArkEffect, type ArkEvent, type ArkPlayer, type ArkState, type ArkView } from './types.js';

export interface ArkResult {
  winners: string[];
  scores: { player: string; appeal: number; conservation: number; points: number; projects: number }[];
}
const resourceNames = { money: '资金', appeal: '魅力', conservation: '保护', reputation: '声望', x: 'X' };
const fundingTags: Record<string, string> = { '231': 'primate', '232': 'reptile', '233': 'bird', '234': 'predator', '235': 'herbivore' };
const expertTags: Record<string, string> = { '236': 'primate', '237': 'reptile', '238': 'bird', '239': 'predator', '240': 'herbivore' };

function item(actor: string, effect: ArkEffect): QueueItem<ArkEffect> { return { actor, effect }; }
function event(type: string, message: string, audience: ArkEvent['audience'] = 'public'): ArkEvent { return { type, message, audience }; }
function ruleError(message: string, code = 'ILLEGAL_ACTION'): RuleError { return { code, message }; }
function prepend(state: ArkState, effects: QueueItem<ArkEffect>[]) { state.queue.unshift(...effects); }
function gainItem(actor: string, resource: Extract<ArkEffect, { type: 'gain' }>['resource'], amount: number) { return item(actor, { type: 'gain', resource, amount }); }
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
  player.row = useAction(player.row, context.action);
  events.push(event('action.completed', `${player.name} 完成${ACTION_NAMES[context.action]}，行动卡移至槽位 1。`));
  state.context = null;
  state.stage = 'turn';
  prepend(state, [...context.after, item(player.id, { type: 'end-turn' })]);
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
  if (reward === 'snap') return [item(actor, { type: 'snap', count: 1, refill: false, range: true })];
  return [];
}

function placeBuilding(state: ArkState, player: ArkPlayer, command: Extract<ArkCommand, { type: 'build' }>, free: boolean, events: ArkEvent[]): QueueItem<ArkEffect>[] {
  const cells = buildingCells(command.kind, command, command.rotation, command.flip);
  if (!free) player.money -= cells.length * 2;
  state.buildingSequence += 1;
  player.buildings.push({ id: `building-${state.buildingSequence}`, kind: command.kind, cells, animals: [] });
  const effects: QueueItem<ArkEffect>[] = [];
  if (command.kind === 'pavilion') effects.push(gainItem(player.id, 'appeal', 1));
  for (const cell of cells) {
    const map = MAP_A.find(candidate => hexKey(candidate) === hexKey(cell))!;
    if (!map.reward || player.coveredRewards.includes(hexKey(cell))) continue;
    player.coveredRewards.push(hexKey(cell));
    const reward = map.reward;
    if (reward.startsWith('money-')) effects.push(gainItem(player.id, 'money', Number(reward.split('-')[1])));
    else if (reward === 'x') effects.push(gainItem(player.id, 'x', 1));
    else if (reward === 'worker') effects.push(item(player.id, { type: 'worker' }));
    else if (reward === 'reputation-2') effects.push(gainItem(player.id, 'reputation', 2));
    else if (reward === 'draw-2') effects.push(item(player.id, { type: 'draw', count: 2 }));
    else effects.push(item(player.id, { type: 'snap', count: 1, refill: false, range: true }));
  }
  const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  if (!player.mapCompleted && MAP_A.filter(cell => cell.terrain === 'land').every(cell => occupied.has(hexKey(cell)))) {
    player.mapCompleted = true;
    effects.push(gainItem(player.id, 'appeal', 7));
  }
  events.push(event('building.placed', `${player.name} ${free ? '免费' : `支付 ${cells.length * 2} 资金，`}建造${BUILDING_NAMES[command.kind]}。`));
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
      player.workers = Math.min(4, player.workers + 1);
      events.push(event('worker.unlocked', `${player.name} 可用事务员总数提升至 ${player.workers}。`));
      break;
    case 'clever':
      makeChoice(state, actor, '机灵：可将一张行动卡移到槽位 1',
        ARK_ACTIONS.map(action => option(action, `${ACTION_NAMES[action]} → 槽位 1`, [item(actor, { type: 'move-action', action })])), 0, 1);
      break;
    case 'move-action': player.row = useAction(player.row, effect.action); events.push(event('action.moved', `${player.name} 将${ACTION_NAMES[effect.action]}移至槽位 1。`)); break;
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
      const count = Math.min(effect.type === 'perception' ? 2 : 1, cards.length);
      state.queue.unshift(item(actor, { type: 'discard-revealed' }));
      makeChoice(state, actor, `${effect.type === 'hunt' ? '狩猎：保留一张动物' : effect.type === 'scavenge' ? '食腐：保留一张卡牌' : '洞察：保留两张卡牌'}`,
        cards.map(id => option(id, zooCard(id).name, [item(actor, { type: 'keep-revealed', card: id })], id)), count, count);
      break;
    }
    case 'keep-revealed':
      state.revealed.splice(state.revealed.indexOf(effect.card), 1);
      player.hand.push(effect.card);
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
      makeChoice(state, actor, effect.range ? '拿取一张卡牌：牌库或声望范围内的展示区' : '精选：拿取任意一张展示牌', options);
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
      if (player.finals.length > 1) makeChoice(state, actor, '保留一张终局计分卡，其余放回计分牌堆底部',
        player.finals.map(id => option(id, FINAL_CARDS.find(card => card.id === id)!.name, [], id)), 1, 1, 'final');
      break;
    case 'continue':
      if (state.context && (state.context.remaining <= 0 || (!state.context.upgraded && state.context.action !== 'animals' && state.context.action !== 'cards'))) completeAction(state, events);
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
      for (const candidate of state.players) candidate.usedWorkers = {};
      state.partnerSupply = CONTINENTS.filter(continent => !state.players.every(candidate => candidate.partners.includes(continent)));
      state.universitySupply = Object.keys(UNIVERSITY_NAMES).filter(university => !state.players.every(candidate => candidate.universities.includes(university)));
      for (const card of state.market.slice(0, 2)) if (card) state.discard.push(card);
      state.market = [...state.market.slice(2), null, null];
      refill(state);
      const income: QueueItem<ArkEffect>[] = [];
      for (const candidate of [player, ...state.players.filter(candidate => candidate.id !== actor)]) {
        const tags = tagsOf(candidate);
        let money = appealIncome(candidate.appeal) + kioskIncome(candidate.buildings) +
          (candidate.projectRewards.includes('income-5') ? 5 : 0) + (candidate.sponsors.includes('220') ? 3 : 0);
        for (const id of candidate.sponsors) if (fundingTags[id]) {
          const count = tags[fundingTags[id]!] ?? 0;
          money += count >= 5 ? 9 : count >= 3 ? 6 : count >= 1 ? 3 : 0;
        }
        income.push(gainItem(candidate.id, 'money', money));
        if (candidate.projectRewards.includes('income-cp')) income.push(gainItem(candidate.id, 'conservation', 1));
        if (candidate.sponsors.includes('209')) income.push(gainItem(candidate.id, 'x', 1));
        if (candidate.projectRewards.includes('snap')) income.push(item(candidate.id, { type: 'snap', count: 1, refill: false, range: true }), item(candidate.id, { type: 'refill' }));
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
      const rewards = effect.point === 5
        ? [{ id: 'money-10', label: '取得共享奖励：10 资金', effects: [gainItem(actor, 'money', 10)] }, { id: 'x-3', label: '取得共享奖励：3 枚 X', effects: [gainItem(actor, 'x', 3)] }]
        : [{ id: 'draw-3', label: '取得共享奖励：拿取 3 张牌', effects: [item(actor, { type: 'snap', count: 3, refill: false, range: true })] }, { id: 'reputation-2', label: '取得共享奖励：2 声望', effects: [gainItem(actor, 'reputation', 2)] }];
      const options = [option('money-5', '获得 5 资金（始终可选）', [gainItem(actor, 'money', 5)]),
        ...rewards.filter(reward => !state.claimedMilestones.includes(`${effect.point}-${reward.id}`)).map(reward => option(
          `${effect.point}-${reward.id}`, reward.label, reward.effects
        ))];
      makeChoice(state, actor, `保护轨道 ${effect.point} 点奖励 · 固定教学配置`, options);
      break;
    }
    case 'offer-free-build': {
      const commands = buildCommands(state, { ...player, money: Math.max(10, player.money) }, BUILDING_SHAPES[effect.kind].length, player.upgrades.includes('build'), [], Infinity).filter(command => command.kind === effect.kind);
      makeChoice(state, actor, `免费建造${BUILDING_NAMES[effect.kind]}：选择一个合法位置，或跳过`,
        commands.map((command, index) => option(`free-${index}`, `${BUILDING_NAMES[command.kind]} · 锚点 ${command.q},${command.r} · 旋转 ${command.rotation * 60}°${command.flip ? ' · 镜像' : ''}`, [item(actor, { type: 'place-free-build', command })])), 0, 1);
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
      if (zooCard(id).kind !== 'animal' || requirementError(player, id) || player.money < animalCost(state, player, id, source)) continue;
      for (const building of player.buildings) if (!housingError(building, id)) result.push({ type: 'animal', card: id, source, building: building.id });
    }
  }
  return result;
}
function associationError(state: ArkState, player: ArkPlayer, command: Extract<ArkCommand, { type: 'association' }>, remaining: number, upgraded: boolean, tasks: string[]): string | null {
  const cost = command.task === 'reputation' ? 2 : command.task === 'partner' ? 3 : command.task === 'university' ? 4 : player.sponsors.includes('203') ? 4 : 5;
  if (cost > remaining) return `此协会任务需要强度 ${cost}。`;
  if (tasks.includes(command.task)) return '同一次协会行动不能重复相同任务。';
  if (availableWorkers(player) < workerCost(player, command.task)) return '可用事务员不足；重复相同任务需要 2 人。';
  if (command.task === 'partner') {
    if (player.partners.includes(command.target) || !state.partnerSupply.includes(command.target)) return '此合作动物园当前不可用。';
    if (player.partners.length >= (upgraded ? 4 : 2)) return '第三与第四个合作动物园需要协会 II。';
  }
  if (command.task === 'university' && (player.universities.includes(command.target) || !state.universitySupply.includes(command.target))) return '此大学当前不可用。';
  if (command.task === 'project') {
    const project = state.projects.find(candidate => candidate.id === command.target);
    if (!project) return '此基础保护项目不在本局中。';
    if (project.claimed.includes(player.id)) return '每个基础保护项目每人仅能支持一次。';
    if (project.blocked === command.tier || project.claimed[command.tier]) return '此项目等级已被封锁或占用。';
    if (projectMetric(player, projectById(project.id).tag) < projectById(project.id).thresholds[command.tier]!) return '尚未满足此项目的图标条件。';
    if (!PROJECT_REWARDS.includes(command.reward as typeof PROJECT_REWARDS[number]) || player.projectRewards.includes(command.reward)) return '左侧边缘奖励已经使用或不存在。';
  }
  return null;
}
function associationCommands(state: ArkState, player: ArkPlayer, remaining: number, upgraded: boolean, tasks: string[]): Extract<ArkCommand, { type: 'association' }>[] {
  const commands: Extract<ArkCommand, { type: 'association' }>[] = [
    { type: 'association', task: 'reputation', target: '', tier: 0, reward: 'money-12', rewardFirst: false },
    ...state.partnerSupply.map(target => ({ type: 'association' as const, task: 'partner' as const, target, tier: 0, reward: 'money-12', rewardFirst: false })),
    ...state.universitySupply.map(target => ({ type: 'association' as const, task: 'university' as const, target, tier: 0, reward: 'money-12', rewardFirst: false }))
  ];
  for (const project of state.projects) for (const tier of [0, 1, 2]) {
    for (const reward of PROJECT_REWARDS) commands.push({ type: 'association', task: 'project', target: project.id, tier, reward, rewardFirst: false });
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
    if (command.type === 'take-x') return player.x >= 5 ? ruleError('X 标记最多 5 枚。') : null;
    if (command.spendX > player.x) return ruleError('X 标记不足。');
    const strength = strengthFor(player, command.action, command.spendX);
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
    const size = BUILDING_SHAPES[command.kind].length;
    if (size > context.remaining || (context.upgraded && context.built.includes(command.kind))) return ruleError('剩余强度不足或已经建过相同类型。');
    if (player.money < size * 2) return ruleError(`建造需要 ${size * 2} 资金。`);
    if (state.players.flatMap(candidate => candidate.buildings).filter(building => building.kind === command.kind).length >= BUILDING_SUPPLY[command.kind]) return ruleError('建筑供应已耗尽。');
    const error = placementError(player.buildings, command.kind, buildingCells(command.kind, command, command.rotation, command.flip), context.upgraded);
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
    const requirements = requirementError(player, card.id);
    if (requirements) return ruleError(requirements);
    if (command.type === 'animal') {
      if (context.remaining < 1) return ruleError('本次动物行动额度已用完。');
      if (player.money < animalCost(state, player, card.id, command.source)) return ruleError('安置费用不足，不能预支卡牌奖励。');
      const building = player.buildings.find(candidate => candidate.id === command.building);
      if (!building) return ruleError('请选择饲养区。');
      const housing = housingError(building, card.id);
      return housing ? ruleError(housing) : null;
    }
    if (card.strength > context.remaining) return ruleError('赞助商等级超过剩余强度。');
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
      state.finalDiscard.push(...player.finals.filter(id => !command.options.includes(id)));
      player.finals = [...command.options];
    }
    for (const selectedOption of selected) if (/^[58]-/.test(selectedOption.id)) state.claimedMilestones.push(selectedOption.id);
    prepend(state, selected.flatMap(option => option.effects));
    events.push(event('choice.completed', `${player.name} 完成「${choice.prompt}」。`));
  } else if (command.type === 'take-x') {
    const action = selectAction(player.row, command.action, player.x, 0, true);
    player.row = action.row; player.x = action.tokens;
    events.push(event('action.x', `${player.name} 选择${ACTION_NAMES[command.action]}替代行动，获得 1 枚 X。`));
    prepend(state, [item(actor, { type: 'end-turn' })]);
  } else if (command.type === 'begin') {
    const strength = strengthFor(player, command.action, command.spendX);
    player.x -= command.spendX;
    const upgraded = player.upgrades.includes(command.action);
    state.context = {
      action: command.action, strength, upgraded,
      remaining: command.action === 'animals' ? animalCapacity(strength, upgraded) : command.action === 'cards' ? cardActionTable(strength, upgraded).draw : strength + (command.action === 'sponsors' && upgraded ? 1 : 0),
      played: 0, built: [], tasks: [], donated: false, after: []
    };
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
      let effects: QueueItem<ArkEffect>[] = [];
      if (command.type === 'animal') {
        player.animals.push(card.id);
        player.buildings.find(building => building.id === command.building)!.animals.push(card.id);
        context.remaining -= 1;
        effects = animalEffects(state, player, card.id);
      } else {
        player.sponsors.push(card.id);
        context.remaining -= card.strength;
        if (card.reputation) effects.push(gainItem(actor, 'reputation', card.reputation));
        if (fundingTags[card.id]) effects.push(gainItem(actor, 'appeal', tagsOf(player)[fundingTags[card.id]!] ?? 0));
      }
      context.played += 1;
      triggerExperts(state, card.id, events);
      prepend(state, [...effects, item(actor, { type: 'continue' })]);
      events.push(event('card.played', `${player.name} ${command.type === 'animal' ? '安置动物' : '打出赞助商'}「${card.name}」${cost ? `，支付 ${cost} 资金` : ''}。`));
    } else if (command.type === 'association') {
      const cost = command.task === 'reputation' ? 2 : command.task === 'partner' ? 3 : command.task === 'university' ? 4 : player.sponsors.includes('203') ? 4 : 5;
      player.usedWorkers[command.task] = (player.usedWorkers[command.task] ?? 0) + workerCost(player, command.task);
      context.remaining -= cost; context.played += 1; context.tasks.push(command.task);
      const effects: QueueItem<ArkEffect>[] = [];
      if (command.task === 'reputation') effects.push(gainItem(actor, 'reputation', 2));
      else if (command.task === 'partner') {
        state.partnerSupply.splice(state.partnerSupply.indexOf(command.target), 1);
        player.partners.push(command.target);
        if (player.partners.length === 2) effects.push(item(actor, { type: 'upgrade', workerOption: false }));
        else if (player.partners.length === 3) effects.push(item(actor, { type: 'worker' }));
        else if (player.partners.length === 4) effects.push(gainItem(actor, 'conservation', 2));
      } else if (command.task === 'university') {
        state.universitySupply.splice(state.universitySupply.indexOf(command.target), 1);
        player.universities.push(command.target);
        if (command.target !== 'science') effects.push(gainItem(actor, 'reputation', command.target === 'hand' ? 1 : 2));
        if (player.universities.length === 2) effects.push(item(actor, { type: 'upgrade', workerOption: false }));
        if (player.universities.length === 3) effects.push(gainItem(actor, 'conservation', 2));
      } else {
        const project = state.projects.find(candidate => candidate.id === command.target)!;
        project.claimed[command.tier] = actor;
        player.projectRewards.push(command.reward);
        const projectEffects = [gainItem(actor, 'conservation', projectById(project.id).points[command.tier]!)];
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
    gameId: 'ark-nova', engineVersion: ENGINE_VERSION, rulesVersion: 'base-v2-first-playable-1',
    contentVersion: `first-playable-1+${fingerprint({ cards: ZOO_CARDS, projects: BASE_PROJECTS, finals: FINAL_CARDS, map: MAP_A })}`
  },
  parseConfig: input => arkConfigSchema.parse(input),
  parseCommand: input => arkCommandSchema.parse(input),
  createGame(config, seed) {
    void config;
    let rng = seed;
    const deck = shuffle(CARD_IDS, rng); rng = deck.rng;
    const finals = shuffle(FINAL_CARDS.map(card => card.id), rng); rng = finals.rng;
    const projects = shuffle(BASE_PROJECTS.map(project => project.id), rng); rng = projects.rng;
    const players: ArkPlayer[] = [];
    for (let index = 0; index < 2; index += 1) {
      const actions = initialActionRow(rng); rng = actions.rng;
      players.push({
        id: `p${index + 1}`, name: index === 0 ? '你的动物园' : '林野动物园 AI',
        money: 25, appeal: index, conservation: 0, reputation: 1, x: 0,
        row: actions.row, upgrades: [], hand: deck.values.splice(0, 8), finals: finals.values.splice(0, 2),
        animals: [], sponsors: [], buried: [], buildings: startingBuildings(), partners: [], universities: [],
        workers: 1, usedWorkers: {}, projectRewards: [], coveredRewards: [], mapCompleted: false
      });
    }
    const state: ArkState = {
      revision: 0, rng, phase: 'playing', stage: 'setup', activePlayer: 'p1', players,
      deck: deck.values, discard: [], revealed: [], market: Array.from({ length: 6 }, () => null),
      finalDeck: finals.values, finalDiscard: [], projects: projects.values.slice(0, 3).map((id, index) => ({ id, blocked: index, claimed: [null, null, null] })),
      partnerSupply: [...CONTINENTS], universitySupply: Object.keys(UNIVERSITY_NAMES), donations: 0,
      breakProgress: 0, breaks: 0, turns: 0, finalReduced: false, finalTurns: null, endingTrigger: null,
      context: null, queue: [item('p1', { type: 'setup' }), item('p2', { type: 'setup' }), item('p1', { type: 'setup-complete' })],
      pending: null, choiceSequence: 0, buildingSequence: 0, claimedMilestones: []
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
      projects: structuredClone(state.projects), partnerSupply: [...state.partnerSupply], universitySupply: [...state.universitySupply],
      donations: state.donations, breakProgress: state.breakProgress, breaks: state.breaks, turns: state.turns,
      finalTurns: state.finalTurns,
      context: state.context ? { ...structuredClone(state.context), after: [] } : null,
      pending: state.pending ? {
        ...structuredClone(state.pending),
        prompt: state.pending.actor === viewer ? state.pending.prompt : '另一位玩家正在完成选择',
        options: state.pending.actor === viewer ? state.pending.options.map(({ id, label, card }) => ({ id, label, card })) : []
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
        for (let spendX = 0; spendX <= player.x; spendX += 1) add(`${action}-${spendX}`, `${ACTION_NAMES[action]}，强度 ${strengthFor(player, action, spendX)}`, { type: 'begin', action, spendX });
        add(`x-${action}`, `${ACTION_NAMES[action]}替代：获得 X`, { type: 'take-x', action });
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
    const located = [...state.deck, ...state.discard, ...state.revealed, ...state.market.filter(card => card !== null),
      ...state.players.flatMap(player => [...player.hand, ...player.animals, ...player.sponsors, ...player.buried.map(buried => buried.card)])];
    if (located.length !== CARD_IDS.length || new Set(located).size !== CARD_IDS.length || located.some(id => !CARD_IDS.includes(id))) throw new Error('卡牌实例守恒失败。');
    const finals = [...state.finalDeck, ...state.finalDiscard, ...state.players.flatMap(player => player.finals)];
    if (finals.length !== FINAL_CARDS.length || new Set(finals).size !== FINAL_CARDS.length) throw new Error('终局卡守恒失败。');
    for (const player of state.players) {
      if ([player.money, player.appeal, player.conservation, player.reputation, player.x].some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('资源无效。');
      if (player.x > 5 || player.reputation > (player.upgrades.includes('cards') ? 15 : 9) || availableWorkers(player) < 0 || player.workers > 4) throw new Error('资源上限或工人数量错误。');
      if (new Set(player.row).size !== 5 || player.row.length !== 5 || player.row.some(action => !ARK_ACTIONS.includes(action))) throw new Error('五行动顺序错误。');
      const occupied = player.buildings.flatMap(building => building.cells);
      if (new Set(occupied.map(hexKey)).size !== occupied.length || occupied.some(cell => !MAP_A.some(candidate => hexKey(cell) === hexKey(candidate) && candidate.terrain === 'land'))) throw new Error('地图建筑重叠或覆盖地形。');
      const housed = player.buildings.flatMap(building => building.animals);
      if (new Set(housed).size !== player.animals.length || housed.some(id => !player.animals.includes(id))) throw new Error('动物安置状态不一致。');
    }
    if (state.pending && (!state.players.some(player => player.id === state.pending!.actor) || state.pending.options.length < state.pending.min)) throw new Error('待处理选择无效。');
    if (!state.pending && state.queue.length) throw new Error('存在未结算队列。');
    if (state.phase === 'finished' && (state.pending || state.queue.length || state.context)) throw new Error('终局残留操作。');
    if (state.context && state.stage !== 'action') throw new Error('行动阶段不一致。');
  }
};
