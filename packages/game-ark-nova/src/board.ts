import { hexKey, hexNeighbors, transformHexes, validatePlacement, type Hex } from '@eurogame/mechanisms';

export type MapId = 'A' | '0';
export type BuildingKind = 'enclosure-1' | 'enclosure-2' | 'enclosure-3' | 'enclosure-4' | 'enclosure-5' | 'kiosk' | 'pavilion' | 'petting' | 'reptile-house' | 'aviary';
export type MapReward = 'money-5' | 'money-10' | 'draw-2' | 'x' | 'reputation-2' | 'worker' | 'snap' | 'upgrade';
export interface MapCell extends Hex {
  column: number;
  row: number;
  terrain: 'land' | 'water' | 'rock';
  upgraded: boolean;
  reward: MapReward | null;
}
export interface Building {
  id: string;
  kind: BuildingKind;
  cells: Hex[];
  animals: string[];
  occupancy?: number;
}
export const BUILDING_SHAPES: Record<BuildingKind, Hex[]> = {
  'enclosure-1': [{ q: 0, r: 0 }],
  'enclosure-2': [{ q: 0, r: 0 }, { q: 0, r: 1 }],
  'enclosure-3': [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }],
  'enclosure-4': [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }, { q: 1, r: 1 }],
  'enclosure-5': [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 2, r: 0 }],
  kiosk: [{ q: 0, r: 0 }],
  pavilion: [{ q: 0, r: 0 }],
  petting: [{ q: 0, r: 0 }, { q: 1, r: -1 }, { q: 2, r: -1 }],
  'reptile-house': [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }, { q: 2, r: -1 }, { q: 2, r: 0 }],
  aviary: [{ q: 0, r: 0 }, { q: 0, r: 1 }, { q: 1, r: 0 }, { q: 1, r: 1 }, { q: 2, r: -1 }]
};
export const BUILDING_NAMES: Record<BuildingKind, string> = {
  'enclosure-1': '1 格饲养区', 'enclosure-2': '2 格饲养区', 'enclosure-3': '3 格饲养区',
  'enclosure-4': '4 格饲养区', 'enclosure-5': '5 格饲养区', kiosk: '贩售亭', pavilion: '休憩亭', petting: '萌宠园',
  'reptile-house': '爬行馆', aviary: '鸟禽馆'
};
export const BUILDING_SUPPLY: Record<BuildingKind, number> = {
  'enclosure-1': 28, 'enclosure-2': 24, 'enclosure-3': 15, 'enclosure-4': 13, 'enclosure-5': 10,
  kiosk: 34, pavilion: 34, petting: 4, 'reptile-house': 4, aviary: 4
};

const rocks = new Set(['1:0', '1:1', '2:1', '3:0', '5:2', '6:4', '1:6']);
const water = new Set(['2:0', '2:5', '3:6', '4:0', '5:4', '6:3', '7:0', '8:0', '8:1']);
const rewards: Record<string, MapReward> = {
  '0:0': 'reputation-2', '0:1': 'x', '2:2': 'snap', '2:4': 'money-5', '3:1': 'money-5',
  '4:3': 'x', '5:0': 'x', '5:3': 'snap', '5:5': 'snap', '7:1': 'worker', '7:5': 'reputation-2', '8:2': 'money-10'
};
export const MAP_A: MapCell[] = Array.from({ length: 9 }, (_, column) =>
  Array.from({ length: column % 2 ? 7 : 6 }, (_, row): MapCell => {
    const key = `${column}:${row}`;
    return {
      q: column, r: row - Math.ceil(column / 2), column, row,
      terrain: rocks.has(key) ? 'rock' : water.has(key) ? 'water' : 'land',
      upgraded: key === '7:6' || key === '8:5',
      reward: rewards[key] ?? null
    };
  })
).flat();

const zeroRocks = new Set(['2:0', '3:1', '6:1', '5:4', '6:4', '6:5', '5:6', '1:6', '0:5']);
const zeroWater = new Set(['0:0', '0:1', '1:0', '3:0', '2:3', '5:2', '1:5', '8:4', '8:5', '7:6']);
const zeroRewards: Record<string, MapReward> = {
  '1:1': 'snap', '2:2': 'snap', '3:6': 'snap', '3:4': 'x', '4:0': 'x', '4:2': 'money-10',
  '5:3': 'upgrade', '5:5': 'x', '7:1': 'money-5', '8:3': 'money-5', '7:5': 'reputation-2', '0:4': 'reputation-2'
};
export const MAP_0: MapCell[] = MAP_A.map(cell => {
  const key = `${cell.column}:${cell.row}`;
  return { ...cell, terrain: zeroRocks.has(key) ? 'rock' : zeroWater.has(key) ? 'water' : 'land', upgraded: key === '6:2' || key === '7:2', reward: zeroRewards[key] ?? null };
});
export function mapCells(map: MapId = 'A'): MapCell[] { return map === 'A' ? MAP_A : MAP_0; }

export function startingBuildings(map: MapId = 'A'): Building[] {
  if (map === '0') return [];
  return [
    { id: 'initial-kiosk', kind: 'kiosk', cells: [{ q: 0, r: 3 }], animals: [] },
    { id: 'initial-enclosure', kind: 'enclosure-3', cells: [{ q: 0, r: 4 }, { q: 0, r: 5 }, { q: 1, r: 4 }], animals: [] }
  ];
}

export function buildingCells(kind: BuildingKind, anchor: Hex, rotation: number, flip: boolean): Hex[] {
  return transformHexes(BUILDING_SHAPES[kind], rotation, flip).map(cell => ({ q: cell.q + anchor.q, r: cell.r + anchor.r }));
}

export function hexDistance(first: Hex, second: Hex): number {
  return (Math.abs(first.q - second.q) + Math.abs(first.r - second.r) + Math.abs(first.q + first.r - second.q - second.r)) / 2;
}

export function placementError(buildings: Building[], kind: BuildingKind, cells: Hex[], upgraded: boolean, mapId: MapId = 'A'): string | null {
  const board = mapCells(mapId);
  const occupied = buildings.flatMap(building => building.cells);
  const shape = validatePlacement(board, occupied, cells, { q: 0, r: 0 }, false);
  if (shape) return shape;
  const map = new Map(board.map(cell => [hexKey(cell), cell]));
  if (cells.some(cell => map.get(hexKey(cell))!.terrain !== 'land')) return '不能覆盖水域或岩石格。';
  if (!upgraded && cells.some(cell => map.get(hexKey(cell))!.upgraded)) return '此格要求建造行动升级至 II。';
  const occupiedKeys = new Set(occupied.map(hexKey));
  if (occupied.length && !cells.some(cell => hexNeighbors(cell).some(neighbor => occupiedKeys.has(hexKey(neighbor))))) return '建筑必须邻接已有建筑。';
  if (!occupied.length && !cells.some(cell => hexNeighbors(cell).some(neighbor => !map.has(hexKey(neighbor))))) return '首座建筑必须覆盖至少一个地图边界格。';
  if (kind === 'kiosk' && buildings.some(building => building.kind === 'kiosk' && hexDistance(building.cells[0]!, cells[0]!) < 3)) return '贩售亭之间至少相距 3 格。';
  if (['petting', 'reptile-house', 'aviary'].includes(kind) && buildings.some(building => building.kind === kind)) return `每座动物园只能有一个${BUILDING_NAMES[kind]}。`;
  if (['reptile-house', 'aviary'].includes(kind) && !upgraded) return '鸟禽馆与爬行馆需要建造行动 II。';
  return null;
}

export function adjacentTerrain(cells: Hex[], terrain: 'water' | 'rock', mapId: MapId = 'A'): number {
  const adjacent = new Set(cells.flatMap(hexNeighbors).map(hexKey));
  return mapCells(mapId).filter(cell => cell.terrain === terrain && adjacent.has(hexKey(cell))).length;
}

export function kioskIncome(buildings: Building[]): number {
  return buildings.filter(building => building.kind === 'kiosk').reduce((total, kiosk) => {
    const adjacent = new Set(kiosk.cells.flatMap(hexNeighbors).map(hexKey));
    return total + buildings.filter(building => building.kind !== 'kiosk' &&
      (!building.kind.startsWith('enclosure') || (building.occupancy ?? building.animals.length) > 0) &&
      building.cells.some(cell => adjacent.has(hexKey(cell)))).length;
  }, 0);
}

export function appealIncome(appeal: number): number {
  const thresholds = [0, 1, 2, 3, 4, 5, 7, 9, 11, 13, 15, 17, 20, 23, 26, 29, 32, 35, 39, 43, 47, 52, 57, 62, 67, 72, 77, 82, 87, 92, 97, 102, 108];
  return 5 + thresholds.filter(value => appeal >= value).length - 1;
}

export function crossingAppeal(conservation: number): number {
  return conservation <= 10 ? 114 - 2 * conservation : 124 - 3 * conservation;
}

export function victoryScore(appeal: number, conservation: number): number {
  return appeal + 100 - crossingAppeal(conservation);
}
