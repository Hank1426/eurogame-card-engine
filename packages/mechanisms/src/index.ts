export type Resources = Record<string, number>;

export function canAfford(resources: Resources, cost: Resources): boolean {
  return Object.entries(cost).every(([resource, amount]) => Number.isSafeInteger(amount) && amount >= 0 && (resources[resource] ?? 0) >= amount);
}

export function changeResource(resources: Resources, resource: string, amount: number): void {
  const next = (resources[resource] ?? 0) + amount;
  if (!Number.isSafeInteger(next) || next < 0) throw new Error(`资源 ${resource} 变化无效。`);
  resources[resource] = next;
}

export function payCost(resources: Resources, cost: Resources): void {
  if (!canAfford(resources, cost)) throw new Error('资源不足。');
  for (const [resource, amount] of Object.entries(cost)) changeResource(resources, resource, -amount);
}

export interface Hex {
  q: number;
  r: number;
}

export function hexKey(hex: Hex): string {
  return `${hex.q},${hex.r}`;
}

export function hexNeighbors(hex: Hex): Hex[] {
  return [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]
    .map(offset => ({ q: hex.q + offset.q, r: hex.r + offset.r }));
}

export function transformHexes(shape: Hex[], rotations: number, flip = false): Hex[] {
  if (!Number.isInteger(rotations)) throw new Error('旋转次数必须为整数。');
  return shape.map(hex => {
    let position = flip ? { q: hex.r, r: hex.q } : { ...hex };
    for (let turn = 0; turn < ((rotations % 6) + 6) % 6; turn += 1) {
      position = { q: -position.r, r: position.q + position.r };
    }
    return position;
  });
}

export function validatePlacement(board: Hex[], occupied: Hex[], shape: Hex[], anchor: Hex, requireAdjacent = true): string | null {
  if (!shape.length) return '建筑至少需要一个格子。';
  const boardKeys = new Set(board.map(hexKey));
  const occupiedKeys = new Set(occupied.map(hexKey));
  const placed = shape.map(hex => ({ q: hex.q + anchor.q, r: hex.r + anchor.r }));
  if (new Set(placed.map(hexKey)).size !== placed.length) return '建筑自身存在重叠。';
  if (placed.some(hex => !boardKeys.has(hexKey(hex)))) return '建筑超出地图边界。';
  if (placed.some(hex => occupiedKeys.has(hexKey(hex)))) return '建筑与现有建筑重叠。';
  const remaining = new Set(placed.map(hexKey));
  const frontier = [placed[0]!];
  remaining.delete(hexKey(placed[0]!));
  while (frontier.length) {
    for (const neighbor of hexNeighbors(frontier.pop()!)) {
      if (remaining.delete(hexKey(neighbor))) frontier.push(neighbor);
    }
  }
  if (remaining.size) return '建筑格子必须相连。';
  if (requireAdjacent && occupied.length && !placed.some(hex => hexNeighbors(hex).some(neighbor => occupiedKeys.has(hexKey(neighbor))))) return '建筑必须邻接已有建筑。';
  return null;
}
