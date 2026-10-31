import { hexKey, hexNeighbors } from '@eurogame/mechanisms';
import { actionStrength } from './index.js';
import { ANIMAL_TAGS, BASE_PROJECTS, CONTINENTS, FINAL_CARDS, zooCard } from './cards.js';
import { adjacentTerrain, buildingCells, BUILDING_SHAPES, BUILDING_SUPPLY, MAP_A, placementError, type Building, type BuildingKind } from './board.js';
import type { ArkCommand, ArkPlayer, ArkState } from './types.js';

export const UNIVERSITY_NAMES: Record<string, string> = { hand: '大学：手牌上限 5 · 声望 +1', science: '大学：研究图标 ×2', reputation: '大学：研究 ×1 · 声望 +2' };
export const PROJECT_REWARDS = ['snap', 'free-2', 'income-5', 'income-cp', 'draw-2', 'money-12', 'x-3'] as const;
export const PROJECT_REWARD_NAMES: Record<string, string> = {
  snap: '立即与每次休息拿取 1 张卡牌', 'free-2': '立即免费建造 2 格饲养区', 'income-5': '立即与每次休息获得 5 资金',
  'income-cp': '立即与每次休息获得 1 保护', 'draw-2': '立即抽取 2 张卡牌', 'money-12': '立即获得 12 资金', 'x-3': '立即获得 3 枚 X'
};
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
    card.tags.forEach(tag => add(tag));
    add('water', card.water);
    add('rock', card.rock);
  }
  player.partners.forEach(tag => add(tag));
  if (player.universities.includes('science')) add('science', 2);
  if (player.universities.includes('reputation')) add('science');
  return counts;
}
export function requirementError(player: ArkPlayer, cardId: string): string | null {
  const card = zooCard(cardId);
  const tags = tagsOf(player);
  const counts: Record<string, number> = {};
  for (const requirement of card.requirements) counts[requirement] = (counts[requirement] ?? 0) + 1;
  for (const [tag, count] of Object.entries(counts)) {
    if (tag === 'animalsII') {
      if (!player.upgrades.includes('animals')) return '需要动物行动 II。';
    } else if (tag === 'Partner Zoo') {
      if (!card.tags.some(continent => player.partners.includes(continent))) return '需要该动物起源大洲的合作动物园。';
    } else if ((tags[tag] ?? 0) < count) return `未满足 ${tag} ×${count} 的前置条件。`;
  }
  return null;
}
export function reputationRange(reputation: number): number {
  return reputation >= 15 ? 6 : reputation >= 12 ? 5 : reputation >= 9 ? 4 : reputation >= 6 ? 3 : reputation >= 3 ? 2 : 1;
}
export function animalCost(state: ArkState, player: ArkPlayer, cardId: string, source: 'hand' | 'market'): number {
  const card = zooCard(cardId);
  const discount = card.tags.filter(tag => player.partners.includes(tag)).length * 3 +
    (card.size <= 2 && player.sponsors.includes('229') ? 3 : 0) +
    (card.size >= 4 && player.sponsors.includes('230') ? 4 : 0);
  return Math.max(0, card.price - discount) + (source === 'market' ? state.market.indexOf(cardId) + 1 : 0);
}
export function housingError(building: Building, cardId: string): string | null {
  const card = zooCard(cardId);
  if (card.tags.includes('pet')) {
    if (building.kind !== 'petting' || building.animals.length >= 3) return '萌宠必须放入有空位的萌宠园。';
  } else {
    if (!building.kind.startsWith('enclosure') || building.animals.length || building.cells.length < card.size) return '需要足够大的闲置标准饲养区。';
  }
  if (adjacentTerrain(building.cells, 'water') < card.water) return `需要邻接 ${card.water} 个不同水域格。`;
  if (adjacentTerrain(building.cells, 'rock') < card.rock) return `需要邻接 ${card.rock} 个不同岩石格。`;
  return null;
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
  return tags[tag] ?? 0;
}
export function projectById(id: string) {
  const project = BASE_PROJECTS.find(candidate => candidate.id === id);
  if (!project) throw new Error('未知保护项目。');
  return project;
}
export function donationCost(donations: number): number {
  return [2, 5, 7, 10, 12][Math.min(donations, 4)]!;
}
export function handLimit(player: ArkPlayer): number {
  return player.universities.includes('hand') ? 5 : 3;
}
export function buildCommands(state: ArkState, player: ArkPlayer, sizeLimit: number, upgraded: boolean, built: BuildingKind[] = [], maximumPerKind = 12): Extract<ArkCommand, { type: 'build' }>[] {
  const output: Extract<ArkCommand, { type: 'build' }>[] = [];
  const occupied = new Set(player.buildings.flatMap(building => building.cells.map(hexKey)));
  const candidates = MAP_A.filter(cell => cell.terrain === 'land' && !occupied.has(hexKey(cell)));
  for (const kind of Object.keys(BUILDING_SHAPES) as BuildingKind[]) {
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
        if (!placementError(player.buildings, kind, cells, upgraded)) {
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
  return MAP_A.filter(cell => cell.terrain === terrain).every(cell => adjacent.has(hexKey(cell)));
}
export function finalCardPoints(state: Pick<ArkState, 'players'>, player: ArkPlayer, id: string): number {
  const final = FINAL_CARDS.find(card => card.id === id);
  if (!final) throw new Error('未知终局卡。');
  const cards = player.animals.map(zooCard);
  const tags = tagsOf(player);
  const occupied = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  if (final.metric === 'architecture') {
    const boardKeys = new Set(MAP_A.map(hexKey));
    const edges = MAP_A.filter(cell => hexNeighbors(cell).some(neighbor => !boardKeys.has(hexKey(neighbor))));
    return Number(allTerrainConnected(player, 'water')) + Number(allTerrainConnected(player, 'rock')) +
      Number(edges.every(cell => cell.terrain !== 'land' || occupied.has(hexKey(cell)))) +
      Number(MAP_A.every(cell => cell.terrain !== 'land' || occupied.has(hexKey(cell))));
  }
  if (final.metric === 'diversity') {
    const other = state.players.find(candidate => candidate.id !== player.id)!;
    const otherTags = tagsOf(other);
    return Math.min(4, ANIMAL_TAGS.filter(tag => (tags[tag] ?? 0) > (otherTags[tag] ?? 0)).length);
  }
  const metric = final.metric === 'large' ? cards.filter(card => card.size >= 4).length :
    final.metric === 'small' ? cards.filter(card => card.size <= 2).length :
    final.metric === 'projects' ? player.projectRewards.length :
    final.metric === 'empty' ? MAP_A.filter(cell => cell.terrain === 'land' && !occupied.has(hexKey(cell))).length :
    final.metric === 'reputation' ? player.reputation : final.metric === 'sponsors' ? player.sponsors.length : tags[final.metric] ?? 0;
  return Math.min(4, final.thresholds.filter(threshold => metric >= threshold).length);
}
export function strengthFor(player: ArkPlayer, action: 'animals' | 'build' | 'cards' | 'association' | 'sponsors', spend = 0): number {
  return actionStrength(player.row, action) + spend;
}
