import { z } from 'zod';
import {
  ENGINE_VERSION, applyCommand, createSession, drainQueue, resolveChoice, shuffle,
  type CoreState, type Decision, type GameEvent, type GameModule,
  type Resolution, type RuleError, type Session
} from '@eurogame/engine-core';
import { canAfford, changeResource, payCost } from '@eurogame/mechanisms';
import { gardenPack, gardenFingerprint, getCard, instanceIds, type Effect, type Resource } from '@eurogame/content';

export const configSchema = z.object({
  rounds: z.number().int().min(1).max(12).default(6),
  playerCount: z.number().int().min(2).max(4).default(2),
  debug: z.boolean().default(false),
  deckOrder: z.array(z.string()).optional()
}).strict().superRefine((config, context) => {
  if (config.deckOrder && (!config.debug || config.deckOrder.length !== instanceIds.length ||
    new Set(config.deckOrder).size !== instanceIds.length || config.deckOrder.some(id => !instanceIds.includes(id)))) {
    context.addIssue({ code: 'custom', message: '固定牌序需要调试模式与完整、唯一的实例清单。' });
  }
});
export type DemoConfig = z.infer<typeof configSchema>;
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('work') }).strict(),
  z.object({ type: z.literal('research') }).strict(),
  z.object({ type: z.literal('play'), instanceId: z.string(), source: z.enum(['hand', 'market']) }).strict(),
  z.object({ type: z.literal('choose'), choiceId: z.string(), optionId: z.string() }).strict(),
  z.object({ type: z.literal('debug.adjust'), resource: z.enum(['credits', 'energy', 'points']), amount: z.number().int().min(-100).max(100) }).strict()
]);
export type DemoCommand = z.infer<typeof commandSchema>;
export type Resources = Record<Resource, number>;
export interface Player {
  id: string;
  name: string;
  resources: Resources;
  hand: string[];
  tableau: string[];
  income: { resource: Resource; amount: number }[];
}
type RuntimeEffect = Effect | { type: 'finish-turn' };
export interface DemoState extends CoreState {
  activePlayer: string;
  round: number;
  roundLimit: number;
  completedTurns: number;
  debug: boolean;
  players: Player[];
  deck: string[];
  market: (string | null)[];
  discard: string[];
  resolution: Resolution<RuntimeEffect>;
  choiceSequence: number;
}
export interface PlayerView {
  id: string;
  name: string;
  resources: Resources;
  handCount: number;
  hand: string[];
  tableau: string[];
  income: Player['income'];
}
export interface DemoView {
  revision: number;
  phase: DemoState['phase'];
  activePlayer: string;
  round: number;
  roundLimit: number;
  players: PlayerView[];
  deckCount: number;
  market: (string | null)[];
  pending: { id: string; actor: string; prompt: string; options: { id: string; label: string; effects: Effect[] }[] } | null;
}
export interface DemoResult {
  winners: string[];
  scores: { player: string; points: number; credits: number; energy: number }[];
}
export type DemoSession = Session<DemoState, DemoConfig, DemoCommand>;

export function currentActor(state: DemoState): string {
  return state.resolution.pending?.actor ?? state.activePlayer;
}

function playerFor(state: DemoState, actor: string): Player {
  const player = state.players.find(candidate => candidate.id === actor);
  if (!player) throw new Error('未知玩家。');
  return player;
}

export function playCost(instanceId: string, source: 'hand' | 'market'): Resources {
  const cost = { ...getCard(instanceId).cost };
  if (source === 'market') cost.credits += 1;
  return cost;
}

function error(code: string, message: string): RuleError {
  return { code, message };
}

export function validateCommand(state: DemoState, actor: string, command: DemoCommand): RuleError | null {
  if (state.phase === 'finished') return error('FINISHED', '对局已结束。');
  if (actor !== currentActor(state)) return error('WRONG_ACTOR', '现在需要另一位玩家操作。');
  const player = playerFor(state, actor);
  if (state.resolution.pending) {
    if (command.type !== 'choose') return error('CHOICE_REQUIRED', '请先完成当前选择。');
    if (command.choiceId !== state.resolution.pending.id ||
      !state.resolution.pending.options.some(option => option.id === command.optionId)) {
      return error('INVALID_CHOICE', '选择已失效或选项不存在。');
    }
    return null;
  }
  if (command.type === 'choose') return error('NO_CHOICE', '当前没有待处理选择。');
  if (command.type === 'research' && !state.deck.length) return error('EMPTY_DECK', '牌库已空，请选择其他行动。');
  if (command.type === 'debug.adjust') {
    if (!state.debug) return error('DEBUG_DISABLED', '此局未启用调试。');
    if (player.resources[command.resource] + command.amount < 0) return error('INSUFFICIENT_RESOURCE', '调整后资源不能为负。');
  }
  if (command.type === 'play') {
    const available = command.source === 'hand' ? player.hand : state.market;
    if (!available.includes(command.instanceId)) return error('CARD_NOT_AVAILABLE', '此卡牌不在指定位置。');
    if (!canAfford(player.resources, playCost(command.instanceId, command.source))) return error('INSUFFICIENT_RESOURCE', '资金或能量不足。');
  }
  return null;
}

function event(type: string, message: string, audience: GameEvent['audience'] = 'public'): GameEvent {
  return { type, message, audience };
}

const resourceNames: Record<Resource, string> = { credits: '资金', energy: '能量', points: '得分' };

function drawCards(state: DemoState, player: Player, count: number, events: GameEvent[]): void {
  const drawn = state.deck.splice(0, count);
  player.hand.push(...drawn);
  events.push(event('cards.draw', `${player.name} 抽取 ${drawn.length} 张牌。`));
  if (drawn.length) events.push(event('cards.private', `抽到：${drawn.map(id => getCard(id).name).join('、')}。`, [player.id]));
}

function finishTurn(state: DemoState, events: GameEvent[]): void {
  for (let index = 0; index < state.market.length; index += 1) {
    if (state.market[index] === null) state.market[index] = state.deck.shift() ?? null;
  }
  state.completedTurns += 1;
  if (state.completedTurns % state.players.length === 0) {
    for (const player of state.players) {
      for (const income of player.income) {
        changeResource(player.resources, income.resource, income.amount);
        events.push(event('income', `${player.name} 收入：${resourceNames[income.resource]} +${income.amount}。`));
      }
    }
    if (state.round === state.roundLimit) {
      state.phase = 'finished';
      events.push(event('game.finished', '最后一轮收入已结算，对局结束。'));
      return;
    }
    state.round += 1;
    events.push(event('round.started', `第 ${state.round} 轮开始。`));
  }
  state.activePlayer = state.players[state.completedTurns % state.players.length]!.id;
}

function resolveEffects(state: DemoState, events: GameEvent[]): void {
  drainQueue(state.resolution, item => {
    const player = playerFor(state, item.actor);
    const effect = item.effect;
    switch (effect.type) {
      case 'gain':
        changeResource(player.resources, effect.resource, effect.amount);
        events.push(event('resource.gain', `${player.name} ${resourceNames[effect.resource]} +${effect.amount}。`));
        break;
      case 'draw':
        drawCards(state, player, effect.count, events);
        break;
      case 'registerIncome':
        player.income.push({ resource: effect.resource, amount: effect.amount });
        events.push(event('income.registered', `${player.name} 建立每轮${resourceNames[effect.resource]} +${effect.amount} 的收入。`));
        break;
      case 'sequence':
        state.resolution.queue.unshift(...effect.effects.map(child => ({ actor: item.actor, effect: child })));
        break;
      case 'choice':
        state.choiceSequence += 1;
        state.resolution.pending = {
          id: `choice-${state.choiceSequence}`, actor: item.actor, prompt: effect.prompt,
          options: effect.options.map(option => ({
            ...option, effects: option.effects.map(child => ({ actor: item.actor, effect: child }))
          }))
        };
        events.push(event('choice.requested', `${player.name} 需要完成一次选择。`));
        break;
      case 'finish-turn':
        finishTurn(state, events);
        break;
    }
  });
}

export const demoGame: GameModule<DemoState, DemoConfig, DemoCommand, DemoView, DemoResult> = {
  manifest: {
    gameId: gardenPack.id, engineVersion: ENGINE_VERSION, rulesVersion: 'garden-lab-1.0.0',
    contentVersion: `${gardenPack.version}+${gardenFingerprint}`
  },
  parseConfig: input => configSchema.parse(input),
  parseCommand: input => commandSchema.parse(input),
  createGame(config, seed) {
    const shuffled = shuffle(instanceIds, seed);
    const deck = config.deckOrder ? [...config.deckOrder] : shuffled.values;
    const names = ['林间研究员', '河畔规划师', '山谷园艺师', '原野观察员'];
    const players = Array.from({ length: config.playerCount }, (_, index) => ({
      id: `p${index + 1}`, name: names[index]!,
      resources: { credits: 5, energy: 1, points: 0 },
      hand: deck.splice(0, 3), tableau: [], income: []
    }));
    return {
      revision: 0, rng: config.deckOrder ? seed : shuffled.rng, phase: 'playing',
      activePlayer: 'p1', round: 1, roundLimit: config.rounds, completedTurns: 0, debug: config.debug,
      players, market: deck.splice(0, 4), deck, discard: [],
      resolution: { queue: [], pending: null }, choiceSequence: 0
    };
  },
  getPlayerView(state, viewer) {
    const pending = state.resolution.pending;
    return {
      revision: state.revision, phase: state.phase, activePlayer: state.activePlayer,
      round: state.round, roundLimit: state.roundLimit,
      players: state.players.map(player => ({
        id: player.id, name: player.name, resources: { ...player.resources },
        handCount: player.hand.length, hand: viewer === player.id ? [...player.hand] : [],
        tableau: [...player.tableau], income: structuredClone(player.income)
      })),
      deckCount: state.deck.length, market: [...state.market],
      pending: pending ? {
        id: pending.id, actor: pending.actor, prompt: viewer === pending.actor ? pending.prompt : '另一位玩家正在选择',
        options: viewer === pending.actor ? pending.options.map(option => ({
          id: option.id, label: option.label,
          effects: structuredClone(option.effects.map(item => item.effect).filter((effect): effect is Effect => effect.type !== 'finish-turn'))
        })) : []
      } : null
    };
  },
  getDecision(state, actor) {
    if (state.phase === 'finished' || actor !== currentActor(state)) return null;
    const pending = state.resolution.pending;
    if (pending) {
      return {
        actor, prompt: pending.prompt, options: pending.options.map(option => ({
          id: option.id, label: option.label,
          command: { type: 'choose', choiceId: pending.id, optionId: option.id }
        }))
      };
    }
    const player = playerFor(state, actor);
    const options: Decision<DemoCommand>['options'] = [{ id: 'work', label: '经营：资金 +2，能量 +1', command: { type: 'work' } }];
    if (state.deck.length) options.push({ id: 'research', label: '研究：抽 2 张牌', command: { type: 'research' } });
    for (const source of ['hand', 'market'] as const) {
      const cards = source === 'hand' ? player.hand : state.market.filter(id => id !== null);
      for (const instanceId of cards) {
        const command: DemoCommand = { type: 'play', instanceId, source };
        if (!validateCommand(state, actor, command)) options.push({
          id: `play-${instanceId}`, label: `建设${getCard(instanceId).name}`, command
        });
      }
    }
    return { actor, prompt: '选择本回合行动', options };
  },
  validateCommand,
  applyCommand(state, actor, command) {
    const player = playerFor(state, actor);
    const events: GameEvent[] = [];
    if (command.type === 'debug.adjust') {
      changeResource(player.resources, command.resource, command.amount);
      return [event('debug.adjust', `调试修改：${player.name} ${resourceNames[command.resource]} ${command.amount >= 0 ? '+' : ''}${command.amount}。`)];
    }
    if (command.type === 'choose') {
      const label = state.resolution.pending!.options.find(option => option.id === command.optionId)!.label;
      resolveChoice(state.resolution, command.optionId);
      events.push(event('choice.selected', `${player.name} 选择：${label}。`));
    } else {
      const effects: RuntimeEffect[] = [];
      if (command.type === 'work') {
        events.push(event('action.work', `${player.name} 经营工坊。`));
        effects.push({ type: 'gain', resource: 'credits', amount: 2 }, { type: 'gain', resource: 'energy', amount: 1 });
      } else if (command.type === 'research') {
        events.push(event('action.research', `${player.name} 开展研究。`));
        effects.push({ type: 'draw', count: 2 });
      } else {
        const card = getCard(command.instanceId);
        payCost(player.resources, playCost(command.instanceId, command.source));
        if (command.source === 'hand') player.hand.splice(player.hand.indexOf(command.instanceId), 1);
        else state.market[state.market.indexOf(command.instanceId)] = null;
        player.tableau.push(command.instanceId);
        events.push(event('card.played', `${player.name} 建设「${card.name}」。`));
        effects.push(...card.effects);
      }
      state.resolution.queue.push(...effects.map(effect => ({ actor, effect })), { actor, effect: { type: 'finish-turn' } });
    }
    resolveEffects(state, events);
    return events;
  },
  getResult(state) {
    if (state.phase !== 'finished') return null;
    const scores = state.players.map(player => ({ player: player.id, ...player.resources }));
    const maximum = Math.max(...scores.map(score => score.points));
    return { scores, winners: scores.filter(score => score.points === maximum).map(score => score.player) };
  },
  assertInvariants(state) {
    const located = [...state.deck, ...state.discard, ...state.market.filter(id => id !== null), ...state.players.flatMap(player => [...player.hand, ...player.tableau])];
    if (located.length !== instanceIds.length || new Set(located).size !== instanceIds.length || located.some(id => !instanceIds.includes(id))) throw new Error('卡牌守恒检查失败。');
    for (const player of state.players) {
      if (Object.values(player.resources).some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('资源状态无效。');
    }
    if (state.players.length < 2 || state.players.length > 4) throw new Error('玩家人数必须为 2–4 人。');
    if (state.completedTurns > state.roundLimit * state.players.length || state.round < 1 || state.round > state.roundLimit) throw new Error('回合计数无效。');
    if (state.activePlayer !== state.players[state.completedTurns % state.players.length]!.id && state.phase !== 'finished') throw new Error('行动玩家与回合计数不一致。');
    if (state.phase === 'finished' && (state.completedTurns !== state.roundLimit * state.players.length || state.resolution.pending || state.resolution.queue.length)) throw new Error('终局状态无效。');
    if (!state.resolution.pending && state.resolution.queue.length) throw new Error('存在未结算效果。');
    if (state.resolution.pending && (!state.players.some(player => player.id === state.resolution.pending!.actor) || !state.resolution.pending.options.length)) throw new Error('待处理选择无效。');
  }
};

export function createChoiceScenario(seed = 42): DemoSession {
  const first = 'seed-library:1';
  return createSession(demoGame, { debug: true, deckOrder: [first, ...instanceIds.filter(id => id !== first)] }, seed);
}

export function createEndgameScenario(seed = 42): DemoSession {
  let session = createSession(demoGame, { debug: true }, seed);
  for (let index = 0; index < 11; index += 1) {
    const result = applyCommand(demoGame, session, {
      id: `scenario-${index}`, actor: currentActor(session.state), revision: session.state.revision, command: { type: 'work' }
    });
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  }
  return session;
}
