import { z } from 'zod';

export const ENGINE_VERSION = '0.1.0';
export const seedSchema = z.number().int().min(0).max(0xffff_ffff);
export const envelopeSchema = z.object({
  id: z.string().min(1).max(120),
  actor: z.string().min(1).max(80),
  revision: z.number().int().nonnegative(),
  command: z.unknown()
}).strict();

export interface CoreState {
  revision: number;
  rng: number;
  phase: 'playing' | 'finished';
}

export interface Manifest {
  gameId: string;
  engineVersion: string;
  rulesVersion: string;
  contentVersion: string;
}

export interface RuleError {
  code: string;
  message: string;
}

export interface GameEvent {
  type: string;
  message: string;
  audience: 'public' | string[];
}

export interface Envelope<Command> {
  id: string;
  actor: string;
  revision: number;
  command: Command;
}

export interface Decision<Command> {
  actor: string;
  prompt: string;
  options: { id: string; label: string; command: Command }[];
}

export interface GameModule<State extends CoreState, Config, Command, View, Result> {
  manifest: Manifest;
  parseConfig: (input: unknown) => Config;
  parseCommand: (input: unknown) => Command;
  createGame: (config: Config, seed: number) => State;
  getPlayerView: (state: State, viewer: string | null) => View;
  getDecision: (state: State, actor: string) => Decision<Command> | null;
  validateCommand: (state: State, actor: string, command: Command) => RuleError | null;
  applyCommand: (state: State, actor: string, command: Command) => GameEvent[];
  getResult: (state: State) => Result | null;
  assertInvariants: (state: State) => void;
}

export interface Branch {
  id: string;
  parent: string | null;
  forkRevision: number;
}

export interface Session<State, Config, Command> {
  manifest: Manifest;
  config: Config;
  seed: number;
  commands: Envelope<Command>[];
  state: State;
  events: (GameEvent & { revision: number })[];
  branch: Branch;
}

export type CommandResult<SessionType> =
  | { ok: true; session: SessionType }
  | { ok: false; error: RuleError };

export function canonicalJson(input: unknown): string {
  if (input === undefined) throw new Error('Undefined is not serializable');
  if (input === null || typeof input !== 'object') {
    const encoded = JSON.stringify(input);
    if (encoded === undefined) throw new Error('Non-JSON value');
    return encoded;
  }
  if (Array.isArray(input)) return `[${input.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(input).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([key, value]) => `${JSON.stringify(key)}:${canonicalJson(value)}`).join(',')}}`;
}

export function fingerprint(input: unknown): string {
  let hash = 0x811c9dc5;
  for (const char of canonicalJson(input)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function nextRandom(rng: number): { rng: number; value: number } {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(next ^ (next >>> 15), next | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return { rng: next, value: ((mixed ^ (mixed >>> 14)) >>> 0) / 0x1_0000_0000 };
}

export function shuffle<Value>(values: readonly Value[], seed: number): { values: Value[]; rng: number } {
  const result = [...values];
  let rng = seedSchema.parse(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(rng);
    rng = random.rng;
    const swap = Math.floor(random.value * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return { values: result, rng };
}

export function createSession<State extends CoreState, Config, Command, View, Result>(
  module: GameModule<State, Config, Command, View, Result>, configInput: unknown, seedInput: number
): Session<State, Config, Command> {
  const config = module.parseConfig(configInput);
  const seed = seedSchema.parse(seedInput);
  const state = module.createGame(config, seed);
  module.assertInvariants(state);
  return {
    manifest: { ...module.manifest }, config, seed, state, commands: [], events: [],
    branch: { id: 'main', parent: null, forkRevision: 0 }
  };
}

export function applyCommand<State extends CoreState, Config, Command, View, Result>(
  module: GameModule<State, Config, Command, View, Result>,
  session: Session<State, Config, Command>, input: unknown
): CommandResult<Session<State, Config, Command>> {
  const parsed = envelopeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: 'INVALID_ENVELOPE', message: '命令格式不正确。' } };
  const envelope = parsed.data;
  if (canonicalJson(session.manifest) !== canonicalJson(module.manifest)) {
    return { ok: false, error: { code: 'VERSION_MISMATCH', message: '规则或内容版本不兼容。' } };
  }
  if (session.commands.some(command => command.id === envelope.id)) {
    return { ok: false, error: { code: 'DUPLICATE_COMMAND', message: '此命令已执行，请勿重复提交。' } };
  }
  if (envelope.revision !== session.state.revision) {
    return { ok: false, error: { code: 'STALE_REVISION', message: '状态已更新，请重新选择。' } };
  }
  let command: Command;
  try {
    command = module.parseCommand(envelope.command);
  } catch {
    return { ok: false, error: { code: 'INVALID_COMMAND', message: '操作参数不正确。' } };
  }
  const working = structuredClone(session.state);
  try {
    const error = module.validateCommand(working, envelope.actor, command);
    if (error) return { ok: false, error };
    const events = module.applyCommand(working, envelope.actor, command);
    working.revision += 1;
    module.assertInvariants(working);
    return {
      ok: true,
      session: {
        ...session, state: working,
        commands: [...session.commands, { ...envelope, command }],
        events: [...session.events, ...events.map(event => ({ ...event, revision: working.revision }))]
      }
    };
  } catch (error) {
    return { ok: false, error: { code: 'RESOLUTION_ERROR', message: error instanceof Error ? error.message : '结算失败，状态已保留。' } };
  }
}

export function visibleEvents(events: (GameEvent & { revision: number })[], viewer: string | null) {
  return events.filter(event => event.audience === 'public' || (viewer !== null && event.audience.includes(viewer)));
}

const archiveSchema = z.object({
  formatVersion: z.literal(1),
  manifest: z.object({ gameId: z.string(), engineVersion: z.string(), rulesVersion: z.string(), contentVersion: z.string() }).strict(),
  config: z.unknown(),
  seed: seedSchema,
  commands: z.array(envelopeSchema).max(10_000),
  snapshot: z.unknown(),
  branch: z.object({ id: z.string().min(1).max(160), parent: z.string().max(160).nullable(), forkRevision: z.number().int().nonnegative() }).strict()
}).strict();

export function exportArchive<State, Config, Command>(session: Session<State, Config, Command>): string {
  return JSON.stringify({
    formatVersion: 1, manifest: session.manifest, config: session.config, seed: session.seed,
    commands: session.commands, snapshot: session.state, branch: session.branch
  }, null, 2);
}

export function importArchive<State extends CoreState, Config, Command, View, Result>(
  module: GameModule<State, Config, Command, View, Result>, text: string
): Session<State, Config, Command> {
  if (text.length > 5_000_000) throw new Error('存档超过 5 MB 上限。');
  const archive = archiveSchema.parse(JSON.parse(text));
  if (canonicalJson(archive.manifest) !== canonicalJson(module.manifest)) throw new Error('版本不兼容；原始存档未被修改。');
  let session = createSession(module, archive.config, archive.seed);
  for (const command of archive.commands) {
    const result = applyCommand(module, session, command);
    if (!result.ok) throw new Error(`回放在修订 ${session.state.revision} 失败：${result.error.message}`);
    session = result.session;
  }
  if (canonicalJson(session.state) !== canonicalJson(archive.snapshot)) throw new Error('存档快照与命令回放不一致。');
  if (archive.branch.forkRevision > session.state.revision) throw new Error('分支起点无效。');
  return { ...session, branch: archive.branch };
}

export function forkSessionAt<State extends CoreState, Config, Command, View, Result>(
  module: GameModule<State, Config, Command, View, Result>,
  session: Session<State, Config, Command>, revision: number
): Session<State, Config, Command> {
  if (!Number.isInteger(revision) || revision < 0 || revision > session.commands.length) throw new Error('回退修订号无效。');
  let fork = createSession(module, session.config, session.seed);
  for (const command of session.commands.slice(0, revision)) {
    const result = applyCommand(module, fork, command);
    if (!result.ok) throw new Error(result.error.message);
    fork = result.session;
  }
  return {
    ...fork,
    branch: {
      id: `fork-${fingerprint({ parent: session.branch.id, commands: session.commands, revision })}`,
      parent: session.branch.id, forkRevision: revision
    }
  };
}

export interface QueueItem<Effect> {
  actor: string;
  effect: Effect;
}

export interface PendingChoice<Effect> {
  id: string;
  actor: string;
  prompt: string;
  options: { id: string; label: string; effects: QueueItem<Effect>[] }[];
}

export interface Resolution<Effect> {
  queue: QueueItem<Effect>[];
  pending: PendingChoice<Effect> | null;
}

export function drainQueue<Effect>(
  resolution: Resolution<Effect>, resolve: (item: QueueItem<Effect>) => void
): void {
  let steps = 0;
  while (resolution.queue.length && !resolution.pending) {
    if (++steps > 1_000) throw new Error('效果链超过 1,000 步，已中止本次命令。');
    resolve(resolution.queue.shift()!);
  }
}

export function resolveChoice<Effect>(resolution: Resolution<Effect>, optionId: string): void {
  const option = resolution.pending?.options.find(candidate => candidate.id === optionId);
  if (!option) throw new Error('选项已失效。');
  resolution.pending = null;
  resolution.queue.unshift(...structuredClone(option.effects));
}
