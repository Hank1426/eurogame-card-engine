import { expect, it } from 'vitest';
import fc from 'fast-check';
import { transformHexes, validatePlacement, hexNeighbors, canAfford, payCost } from './index.js';

it('六次旋转和两次镜像回到原始形状', () => {
  fc.assert(fc.property(fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 }), (axialQ, axialR) => {
    const shape = [{ q: axialQ, r: axialR }];
    expect(transformHexes(shape, 6)).toEqual(shape);
    expect(transformHexes(transformHexes(shape, 0, true), 0, true)).toEqual(shape);
  }));
});
it('放置校验边界、重叠、邻接和连通性', () => {
  const center = { q: 0, r: 0 };
  const board = [center, ...hexNeighbors(center), { q: 3, r: 0 }];
  expect(validatePlacement(board, [center], [center], { q: 1, r: 0 })).toBeNull();
  expect(validatePlacement(board, [center], [center], center)).toContain('重叠');
  expect(validatePlacement(board, [center], [center], { q: 8, r: 0 })).toContain('边界');
  expect(validatePlacement(board, [center], [center], { q: 3, r: 0 })).toContain('邻接');
  expect(validatePlacement(board, [], [center, { q: 3, r: 0 }], center)).toContain('相连');
});
it('费用不足时不能部分扣费', () => {
  const resources = { coins: 3, energy: 0 };
  expect(canAfford(resources, { coins: 2, energy: 1 })).toBe(false);
  expect(() => payCost(resources, { coins: 2, energy: 1 })).toThrow();
  expect(resources).toEqual({ coins: 3, energy: 0 });
});
