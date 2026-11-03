import { hexKey, hexNeighbors } from '@eurogame/mechanisms';
import { actionStrength } from './index.js';
import { ANIMAL_TAGS, BASE_PROJECTS, DECK_PROJECTS, CONTINENTS, FINAL_CARDS, zooCard, type DeckProject } from './cards.js';
import { adjacentTerrain, housingCapacity, buildingCells, BUILDING_SHAPES, BUILDING_SUPPLY, mapCells, placementError, type Building, type BuildingKind, type MapId } from './board.js';
import type { ArkCommand, ArkPlayer, ArkState } from './types.js';
import { uniqueKind } from './unique-buildings.js';

export const UNIVERSITY_NAMES: Record<string, string> = { hand: '大学：手牌上限 5 · 声望 +1', science: '大学：研究图标 ×2', reputation: '大学：研究 ×1 · 声望 +2' };
export const PROJECT_REWARDS = ['snap', 'free-2', 'income-5', 'income-cp', 'draw-2', 'money-12', 'x-3'] as const;
export const PROJECT_REWARD_NAMES: Record<string, string> = {
  snap: '立即与每次休息拿取 1 张卡牌', 'free-2': '立即免费建造 2 格饲养区', 'income-5': '立即与每次休息获得 5 资金',
  'income-cp': '立即与每次休息获得 1 保护', 'draw-2': '立即抽取 2 张卡牌', 'money-12': '立即获得 12 资金', 'x-3': '立即获得 3 枚 X',
  worker: '立即解锁一名事务员', 'income-sponsor': '立即与每次休息可按等级付费打出一张手牌赞助商'
};
export function projectRewardsFor(player: Pick<ArkPlayer, 'map'>): string[] {
  return PROJECT_REWARDS.map(reward =>
    reward === 'income-5' && player.map === '0' ? 'worker' :
    reward === 'income-cp' && player.map === '1' ? 'income-sponsor' :
    reward === 'draw-2' && (player.map === '1' || player.map === '2') ? 'worker' : reward);
}
export function arkActor(state: ArkState): string {
  return state.pending?.actor ?? state.activePlayer;
}
export function arkPlayer(state: ArkState, id: string): ArkPlayer {
  const player = state.players.find(candidate => candidate.id === id);
  if (!player) throw new Error('未知玩家。');
  return player;
}
export function tagsOf(player: ArkPlayer): Record<string, number> {
  const counts: Record<string, number> = {};
  const add = (tag: string, count = 1) => { counts[tag] = (counts[tag] ?? 0) + count; };
  for (const id of [...player.animals, ...player.sponsors]) {
    const card = zooCard(id);
    card.tags.filter(tag => tag !== 'water' && tag !== 'rock').forEach(tag => add(tag));
    add('water', card.water);
    add('rock', card.rock);
  }
  player.partners.forEach(tag => add(tag));
  if (player.universities.includes('science')) add('science', 2);
  if (player.universities.includes('reputation')) add('science');
  return counts;
}
export interface CardRequirementCheck {
  tag: string; required: number; actual: number; maximum: boolean;
  missing: number; waived: number; met: boolean;
}
export function cardRequirementChecks(player: ArkPlayer, cardId: string): CardRequirementCheck[] {
  const card = zooCard(cardId);
  const tags = tagsOf(player);
  const counts: Record<string, number> = {};
  for (const requirement of card.requirements) counts[requirement] = (counts[requirement] ?? 0) + 1;
  let ignored = card.kind === 'animal' && card.size >= 4 && player.sponsors.includes('263') ? 1 : 0;
  return Object.entries(counts).map(([tag, count]) => {
    const required = tag === 'appeal' ? 25 : tag === 'reputation' ? card.id === '227' || card.id === '263' ? 6 : 3 : count;
    const actual = tag === 'animalsII' || tag === 'sponsorsII' ? Number(player.upgrades.includes(tag === 'animalsII' ? 'animals' : 'sponsors'))
      : tag === 'Partner Zoo' ? card.kind === 'animal' ? Number(card.tags.some(continent => player.partners.includes(continent))) : player.partners.length
      : tag === 'appeal' ? player.appeal : tag === 'reputation' ? player.reputation : tags[tag] ?? 0;
    const deficit = Math.max(0, tag === 'appeal' ? actual - required : required - actual);
    const threshold = tag === 'appeal' || tag === 'reputation';
    const units = threshold ? Number(deficit > 0) : deficit;
    const waived = Math.min(units, ignored);
    ignored -= waived;
    return { tag, required, actual, maximum: tag === 'appeal', missing: units <= waived ? 0 : threshold ? deficit : deficit - waived, waived, met: units <= waived };
  });
}
export function requirementError(player: ArkPlayer, cardId: string): string | null {
  const card = zooCard(cardId);
  const unmet = cardRequirementChecks(player, cardId).find(check => !check.met);
  if (unmet) {
    const { tag, required } = unmet;
    return tag === 'animalsII' || tag === 'sponsorsII' ? `需要${tag === 'animalsII' ? '动物' : '赞助商'}行动 II。` : tag === 'Partner Zoo' ? card.kind === 'animal' ? '需要该动物起源大洲的合作动物园。' : `需要 ${required} 个合作动物园。` : tag === 'appeal' ? '此牌要求魅力不超过 25。' : tag === 'reputation' ? `此牌要求至少 ${required} 声望。` : `未满足 ${tag} ×${required} 的前置条件。`;
  }
  if (card.kind === 'animal' && player.sponsors.includes('227') && player.animalFocus && (player.animalFocus === 'small' ? card.size >= 4 : card.size <= 2)) return '此动物与世界动物园协会特别任务的方向冲突。';
  return null;
}
export function reputationRange(reputation: number): number {
  return reputation >= 15 ? 6 : reputation >= 12 ? 5 : reputation >= 9 ? 4 : reputation >= 6 ? 3 : reputation >= 3 ? 2 : 1;
}
export function animalCost(state: Pick<ArkState, 'market'>, player: ArkPlayer, cardId: string, source: 'hand' | 'market'): number {
  const card = zooCard(cardId);
  const discount = card.tags.filter(tag => player.partners.includes(tag)).length * 3 +
    (card.size <= 2 && player.sponsors.includes('229') ? 3 : 0) +
    (card.size >= 4 && player.sponsors.includes('230') ? 4 : 0);
  return Math.max(0, card.price - discount) + (source === 'market' ? state.market.indexOf(cardId) + 1 : 0);
}
export function specialSpace(cardId: string, kind: BuildingKind): number | null {
  const card = zooCard(cardId);
  if (kind === 'petting') return card.tags.includes('pet') ? 1 : null;
  return card.specialHousing?.kind === kind ? card.specialHousing.space : null;
}
export function buildingUsedSpace(building: Building): number {
  return building.occupancy ?? (building.kind.startsWith('enclosure') ? Number(building.animals.length > 0) : building.animals.reduce((total, id) => total + (specialSpace(id, building.kind) ?? 0), 0));
}
export function housingError(building: Building, cardId: string, map: MapId = 'A', ignoreTerrain = false): string | null {
  const card = zooCard(cardId);
  if (card.kind !== 'animal') return '保护项目或赞助商不能安置在饲养区。';
  if (card.tags.includes('pet')) {
    if (building.kind !== 'petting' || buildingUsedSpace(building) >= 3) return '萌宠必须放入有空位的萌宠园。';
  } else if (building.kind === 'reptile-house' || building.kind === 'aviary') {
    const space = specialSpace(cardId, building.kind);
    if (space === null) return '该动物卡不允许放入此特殊饲养区。';
    if (buildingUsedSpace(building) + space > 5) return '特殊饲养区剩余容量不足。';
  } else {
    if (!building.kind.startsWith('enclosure') || buildingUsedSpace(building) > 0 || housingCapacity(building, map) < card.size) return '需要足够大的闲置标准饲养区。';
  }
  if (!ignoreTerrain && adjacentTerrain(building.cells, 'water', map) < card.water) return `需要邻接 ${card.water} 个不同水域格。`;
  if (!ignoreTerrain && adjacentTerrain(building.cells, 'rock', map) < card.rock) return `需要邻接 ${card.rock} 个不同岩石格。`;
  return null;
}
export function canFlock(player: ArkPlayer, cardId: string): boolean {
  const card = zooCard(cardId);
  return card.abilities.some(ability => ability.key === 'FLOCK_ANIMAL') &&
    player.animals.some(id => id !== cardId && zooCard(id).tags.includes('herbivore') && zooCard(id).size >= card.size);
}
export function freedEnclosures(player: ArkPlayer, animal: string): Building[] {
  const card = zooCard(animal);
  const eligible = player.buildings.filter(building => building.kind.startsWith('enclosure') && buildingUsedSpace(building) > 0 && housingCapacity(building, player.map) >= card.size);
  const full = eligible.filter(building => player.sponsors.includes('219') || adjacentTerrain(building.cells, 'water', player.map) >= card.water && adjacentTerrain(building.cells, 'rock', player.map) >= card.rock);
  const candidates = full.length ? full : eligible;
  const minimum = Math.min(...candidates.map(building => housingCapacity(building, player.map)));
  return candidates.filter(building => housingCapacity(building, player.map) === minimum);
}
export function releaseHousing(player: ArkPlayer, animal: string, freedId?: string, transfer = false): void {
  for (const building of player.buildings) building.occupancy = buildingUsedSpace(building);
  const hall = !transfer && player.buildings.find(building => {
    const space = specialSpace(animal, building.kind);
    return space !== null && buildingUsedSpace(building) >= space;
  });
  if (hall) {
    hall.occupancy = buildingUsedSpace(hall) - (specialSpace(animal, hall.kind) ?? 0);
    hall.animals = hall.animals.filter(id => id !== animal);
    for (const building of player.buildings) if (building.id !== hall.id) building.animals = building.animals.filter(id => id !== animal);
    return;
  }
  const freed = freedEnclosures(player, animal).find(building => !freedId || building.id === freedId);
  if (!freed) {
    if (transfer) throw new Error('没有符合最小占用饲养区释放规则的建筑。');
    for (const building of player.buildings) building.animals = building.animals.filter(id => id !== animal);
    return;
  }
  freed.occupancy = 0;
  freed.animals = [];
  for (const building of player.buildings) building.animals = building.animals.filter(id => id !== animal);
}
export function availableWorkers(player: ArkPlayer): number {
  return player.workers - Object.values(player.usedWorkers).reduce((total, value) => total + value, 0);
}
export function workerCost(player: ArkPlayer, task: string): number {
  return !player.usedWorkers[task] ? 1 : player.usedWorkers[task] === 1 ? 2 : Infinity;
}
export function projectMetric(player: ArkPlayer, tag: string): number {
  const tags = tagsOf(player);
  if (tag === 'all-animals') return ANIMAL_TAGS.filter(animal => (tags[animal] ?? 0) > 0).length;
  if (tag === 'all-continents') return CONTINENTS.filter(continent => (tags[continent] ?? 0) > 0).length;
  if (tag === 'animal-size-2') return player.animals.filter(id => zooCard(id).size <= 2).length;
  if (tag === 'animal-size-4') return player.animals.filter(id => zooCard(id).size >= 4).length;
  return tags[tag] ?? 0;
}
export function projectById(id: string) {
  const project = [...BASE_PROJECTS, ...DECK_PROJECTS].find(candidate => candidate.id === id);
  if (!project) throw new Error('未知保护项目。');
  return project;
}
export function projectRequirementError(player: ArkPlayer, id: string, tier: number, releaseAnimal = ''): string | null {
  const project = projectById(id);
  if (DECK_PROJECTS.some(candidate => candidate.id === id)) {
    const spec = project as DeckProject;
    if (spec.mode === 'release') {
      const size = player.animals.includes(releaseAnimal) ? zooCard(releaseAnimal).size : 0;
      const matches = tier === 0 ? size >= 4 : tier === 1 ? size === 3 : size >= 1 && size <= 2;
      if (!matches || !zooCard(releaseAnimal).tags.includes(spec.tag)) return '放归等级需精确匹配：大型 4–5 格、3 格、或小型 1–2 格，并具有项目图标。';
      return null;
    }
    if (spec.mode === 'breed') return player.animals.some(id => {
      const card = zooCard(id);
      return card.tags.includes(spec.tag) && card.tags.some(tag => player.partners.includes(tag));
    }) ? null : '繁育计划需要相同动物的大洲图标和对应合作动物园。';
  }
  return projectMetric(player, project.tag) >= project.thresholds[tier]! ? null : '尚未满足此项目的图标条件。';
}
export function donationCost(donations: number): number {
  return [2, 5, 7, 10, 12][Math.min(donations, 4)]!;
}
export function handLimit(player: ArkPlayer): number {
  return player.universities.includes('hand') ? 5 : 3;
}
export function buildCommands(state: ArkState, player: ArkPlayer, sizeLimit: number, upgraded: boolean, built: BuildingKind[] = [], maximumPerKind = 12, waiveSpecialUpgrade = false): Extract<ArkCommand, { type: 'build' }>[] {
  const output: Extract<ArkCommand, { type: 'build' }>[] = [];
  const occupied = new Set(player.buildings.flatMap(building => building.cells.map(hexKey)));
  const candidates = mapCells(player.map).filter(cell => (cell.terrain === 'land' || player.sponsors.includes('219')) && !occupied.has(hexKey(cell)));
  for (const kind of Object.keys(BUILDING_SHAPES) as BuildingKind[]) {
    if (kind.startsWith('unique-')) continue;
    if (built.includes(kind) || BUILDING_SHAPES[kind].length > sizeLimit || BUILDING_SHAPES[kind].length * 2 > player.money) continue;
    if (state.players.flatMap(candidate => candidate.buildings).filter(building => building.kind === kind).length >= BUILDING_SUPPLY[kind]) continue;
    const seen = new Set<string>();
    let count = 0;
    placements: for (const cell of candidates) {
      for (const flip of [false, true]) for (let rotation = 0; rotation < 6; rotation += 1) {
        const cells = buildingCells(kind, cell, rotation, flip);
        const key = cells.map(hexKey).sort().join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        if (!placementError(player.buildings, kind, cells, upgraded, player.map, waiveSpecialUpgrade, player.sponsors.includes('219'))) {
          output.push({ type: 'build', kind, q: cell.q, r: cell.r, rotation, flip });
          if (++count >= maximumPerKind) break placements;
        }
      }
    }
  }
  return output;
}
export function allTerrainConnected(player: ArkPlayer, terrain: 'water' | 'rock'): boolean {
  const adjacent = new Set(player.buildings.flatMap(building => building.cells.flatMap(hexNeighbors)).map(hexKey));
  const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  return mapCells(player.map).filter(cell => cell.terrain === terrain && !occupied.has(hexKey(cell))).every(cell => adjacent.has(hexKey(cell)));
}
export function uniqueCommands(state: ArkState, player: ArkPlayer, card: string, maximum = Infinity): Extract<ArkCommand, { type: 'build' }>[] {
  const kind = uniqueKind(card);
  if (!kind || state.players.some(candidate => candidate.buildings.some(building => building.kind === kind))) return [];
  const output: Extract<ArkCommand, { type: 'build' }>[] = [];
  const seen = new Set<string>();
  for (const anchor of mapCells(player.map)) for (let rotation = 0; rotation < 6; rotation += 1) {
    const cells = buildingCells(kind, anchor, rotation, false);
    const key = cells.map(hexKey).sort().join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    if (!placementError(player.buildings, kind, cells, player.upgrades.includes('build'), player.map, false, player.sponsors.includes('219'))) {
      output.push({ type: 'build', kind, q: anchor.q, r: anchor.r, rotation, flip: false });
      if (output.length >= maximum) return output;
    }
  }
  return output;
}
export function finalCardPoints(state: Pick<ArkState, 'players'>, player: ArkPlayer, id: string): number {
  const final = FINAL_CARDS.find(card => card.id === id);
  if (!final) throw new Error('未知终局卡。');
  const cards = player.animals.map(zooCard);
  const tags = tagsOf(player);
  const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  if (final.metric === 'architecture') {
    const board = mapCells(player.map);
    const boardKeys = new Set(board.map(hexKey));
    const edges = board.filter(cell => hexNeighbors(cell).some(neighbor => !boardKeys.has(hexKey(neighbor))));
    return Number(allTerrainConnected(player, 'water')) + Number(allTerrainConnected(player, 'rock')) +
      Number(edges.every(cell => cell.terrain !== 'land' || occupied.has(hexKey(cell)))) +
      Number(board.every(cell => cell.terrain !== 'land' || occupied.has(hexKey(cell))));
  }
  if (final.metric === 'diversity') {
    const other = state.players.find(candidate => candidate.id !== player.id)!;
    const otherTags = tagsOf(other);
    return Math.min(4, ANIMAL_TAGS.filter(tag => (tags[tag] ?? 0) > (otherTags[tag] ?? 0)).length);
  }
  const metric = final.metric === 'large' ? cards.filter(card => card.size >= 4).length :
    final.metric === 'small' ? cards.filter(card => card.size <= 2).length :
    final.metric === 'projects' ? player.supportedProjects.length :
    final.metric === 'empty' ? mapCells(player.map).filter(cell => cell.terrain === 'land' && !occupied.has(hexKey(cell))).length :
    final.metric === 'reputation' ? player.reputation : final.metric === 'sponsors' ? player.sponsors.length : tags[final.metric] ?? 0;
  return Math.min(4, final.thresholds.filter(threshold => metric >= threshold).length);
}
export function strengthFor(player: ArkPlayer, action: 'animals' | 'build' | 'cards' | 'association' | 'sponsors', spend = 0): number {
  return actionStrength(player.row, action) + spend;
}
