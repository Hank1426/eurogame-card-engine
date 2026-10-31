import { describe, expect, it } from 'vitest';
import { initialActionRow, cardActionTable, animalCapacity, selectAction } from './foundation.js';
import { MAP_A, adjacentTerrain, adjacentTerrainCells, appealIncome, buildingCells, kioskIncome, placementError, startingBuildings, victoryScore, crossingAppeal } from './board.js';
import { housingError } from './rules.js';

describe('阶段一 · 行动与地图 A 验收', () => {
  it('动物固定在槽位 1，其他四张按种子洗牌', () => {
    expect(initialActionRow(42)).toEqual(initialActionRow(42));
    expect(initialActionRow(42).row[0]).toBe('animals');
    expect(new Set(initialActionRow(42).row).size).toBe(5);
  });
  it('行动表与原始 I/II 卡面逐列一致', () => {
    expect([1, 2, 3, 4, 5].map(strength => cardActionTable(strength, false).draw)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 2, 3, 4, 5].map(strength => cardActionTable(strength, true).discard)).toEqual([0, 1, 0, 1, 1]);
    expect([1, 2, 3, 4, 5].map(strength => animalCapacity(strength, false))).toEqual([0, 1, 1, 1, 2]);
    expect([1, 2, 3, 4, 5].map(strength => animalCapacity(strength, true))).toEqual([1, 1, 2, 2, 2]);
    expect(cardActionTable(7, false)).toEqual(cardActionTable(5, false));
  });
  it('X 必须预先消耗，替代行动受上限限制', () => {
    const row = initialActionRow(42).row;
    expect(selectAction(row, 'animals', 2, 2).strength).toBe(3);
    expect(selectAction(row, 'animals', 2, 2).tokens).toBe(0);
    expect(() => selectAction(row, 'build', 1, 2)).toThrow();
    expect(() => selectAction(row, 'cards', 5, 0, true)).toThrow();
    expect(() => selectAction(row, 'cards', 2, 1, true)).toThrow();
  });
  it('地图 A 是 58 格，有 7 个岩石和 9 个水域格及固定起始建筑', () => {
    expect(MAP_A).toHaveLength(58);
    expect(MAP_A.filter(cell => cell.terrain === 'rock')).toHaveLength(7);
    expect(MAP_A.filter(cell => cell.terrain === 'water')).toHaveLength(9);
    const buildings = startingBuildings();
    expect(buildings[1]!.cells).toHaveLength(3);
    expect(buildings[0]!.kind).toBe('kiosk');
    expect(placementError(buildings, 'enclosure-1', [{ q: 0, r: 2 }], false)).toBeNull();
    expect(placementError(buildings, 'enclosure-1', [{ q: 1, r: 0 }], false)).toContain('岩石');
    expect(placementError(buildings, 'kiosk', [{ q: 0, r: 2 }], false)).toContain('3 格');
    expect(buildingCells('enclosure-5', { q: 0, r: 0 }, 6, false)).toEqual(buildingCells('enclosure-5', { q: 0, r: 0 }, 0, false));
  });
  it('收入只计算有效建筑、不同水域格不会重复计数', () => {
    const buildings = startingBuildings();
    expect(kioskIncome(buildings)).toBe(0);
    buildings[1]!.animals.push('test');
    expect(kioskIncome(buildings)).toBe(1);
    expect(adjacentTerrain([{ q: 2, r: 3 }, { q: 3, r: 3 }], 'water')).toBeGreaterThan(0);
    expect([0, 4, 5, 6, 7, 17, 20, 52, 108].map(appealIncome)).toEqual([5, 9, 10, 10, 11, 16, 17, 26, 37]);
  });
  it('官方终局示例与保护点区域查表一致', () => {
    expect(victoryScore(80, 16)).toBe(104);
    expect(victoryScore(78, 18)).toBe(108);
    expect(crossingAppeal(20)).toBe(64);
    expect(victoryScore(64, 20)).toBe(100);
    expect(victoryScore(0, 0)).toBe(-14);
  });
  it('截图回归：共同邻接的起始贩售亭不是岩石，五格区邻接两水零岩', () => {
    const cells = [{ q: 1, r: 3 }, { q: 2, r: 2 }, { q: 2, r: 3 }, { q: 3, r: 2 }, { q: 3, r: 3 }];
    const building = { id: 'screenshot-five', kind: 'enclosure-5' as const, cells, animals: [] };
    expect(placementError(startingBuildings(), building.kind, cells, false)).toBeNull();
    expect(adjacentTerrainCells(cells, 'water').map(cell => [cell.q, cell.r])).toEqual([[2, 4], [3, 4]]);
    expect(adjacentTerrainCells(cells, 'rock')).toEqual([]);
    expect(housingError(building, '421')).toBe('需要邻接 1 个不同岩石格。');
    expect(adjacentTerrainCells(startingBuildings()[1]!.cells, 'rock').map(cell => [cell.q, cell.r])).toEqual([[1, 5]]);
    expect(startingBuildings()[0]!.kind).toBe('kiosk');
    expect(MAP_A.find(cell => cell.q === 0 && cell.r === 3)!.terrain).toBe('land');
  });
  it('地形检查区分地图、按不同地形格计数，合法五格区可安置海狗', () => {
    const cells = buildingCells('enclosure-5', { q: 2, r: 1 }, 1, false);
    expect(placementError(startingBuildings(), 'enclosure-5', cells, false)).toBeNull();
    expect(adjacentTerrain(cells, 'rock', 'A')).toBeGreaterThan(0);
    expect(adjacentTerrain(cells, 'water', 'A')).toBeGreaterThan(0);
    expect(housingError({ id: 'valid-five', kind: 'enclosure-5', cells, animals: [] }, '421', 'A')).toBeNull();
    const single = [{ q: 0, r: 0 }, { q: 0, r: 1 }];
    expect(adjacentTerrain(single, 'water', 'A')).toBe(0);
    expect(adjacentTerrain(single, 'water', '0')).toBeGreaterThan(0);
  });
});
