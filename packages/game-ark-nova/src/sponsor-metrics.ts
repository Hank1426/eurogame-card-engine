import { hexKey, hexNeighbors } from '@eurogame/mechanisms';
import { mapCells } from './board.js';
import { tagsOf, buildingUsedSpace } from './rules.js';
import type { ArkPlayer } from './types.js';

export function connectedSpaces(player: ArkPlayer, metric: 'water' | 'rock' | 'border' | 'bonus', isolated = false): number {
  const board = mapCells(player.map);
  const all = new Set(board.map(hexKey));
  const covered = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  return board.filter(cell => !covered.has(hexKey(cell)) &&
    (metric === 'water' || metric === 'rock' ? cell.terrain === metric : metric === 'border' ? cell.terrain === 'land' && hexNeighbors(cell).some(neighbor => !all.has(hexKey(neighbor))) : Boolean(cell.reward)) &&
    (isolated ? hexNeighbors(cell).every(neighbor => !covered.has(hexKey(neighbor))) : hexNeighbors(cell).some(neighbor => covered.has(hexKey(neighbor))))
  ).length;
}
export function emptyLandGroups(player: ArkPlayer): number[] {
  const covered = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  const remaining = new Map(mapCells(player.map).filter(cell => cell.terrain === 'land' && !covered.has(hexKey(cell))).map(cell => [hexKey(cell), cell]));
  const groups: number[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const frontier = [first];
    remaining.delete(hexKey(first));
    let size = 0;
    while (frontier.length) {
      size += 1;
      for (const neighbor of hexNeighbors(frontier.pop()!)) {
        const cell = remaining.get(hexKey(neighbor));
        if (cell) { remaining.delete(hexKey(cell)); frontier.push(cell); }
      }
    }
    groups.push(size);
  }
  return groups;
}
export function allBorderCovered(player: ArkPlayer): boolean {
  const board = mapCells(player.map);
  const all = new Set(board.map(hexKey));
  const covered = new Set(player.buildings.flatMap(building => building.cells).map(hexKey));
  return board.filter(cell => cell.terrain === 'land' && hexNeighbors(cell).some(neighbor => !all.has(hexKey(neighbor)))).every(cell => covered.has(hexKey(cell)));
}
export function sideEntranceIncome(player: ArkPlayer): number {
  const entrance = player.buildings.find(building => building.kind === 'unique-257');
  if (!entrance) return 0;
  const adjacent = new Set(entrance.cells.flatMap(hexNeighbors).map(hexKey));
  return 2 * player.buildings.filter(building => building.id !== entrance.id &&
    (!building.kind.startsWith('enclosure') || buildingUsedSpace(building) > 0) &&
    building.cells.some(cell => adjacent.has(hexKey(cell)))
  ).length;
}
export function newSponsorFinalPoints(player: ArkPlayer, id: string): number {
  const tags = tagsOf(player);
  if (id === '215' || id === '218') return Number(player.supportedProjects.length >= 5);
  if (id === '216') return Number(player.reputation >= 9);
  if (id === '221') return Number(allBorderCovered(player));
  const endTags: Record<string, string> = { '243': 'herbivore', '244': 'bird', '245': 'water', '246': 'rock', '247': 'primate' };
  if (endTags[id]) return Number((tags[endTags[id]!] ?? 0) >= 6);
  if (id === '251') return (tags.bear ?? 0) >= 6 ? 2 : (tags.bear ?? 0) >= 3 ? 1 : 0;
  if (id === '258' || id === '259') return Math.floor(connectedSpaces(player, id === '258' ? 'water' : 'rock', true) / 2);
  if (id === '260') return emptyLandGroups(player).reduce((total, size) => total + Math.floor(size / 6), 0);
  if (id === '264') return Math.floor(connectedSpaces(player, 'bonus', true) / 2);
  return 0;
}
export function newSponsorFinalAppeal(player: ArkPlayer, id: string): number {
  const tags = tagsOf(player);
  if (id === '217' || id === '257') return player.mapCompleted ? 5 : 0;
  if (id === '219') return Math.min(3, tags.water ?? 0, tags.rock ?? 0) * 2;
  return 0;
}
