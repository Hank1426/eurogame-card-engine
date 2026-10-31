import { expect, it } from 'vitest';
import { ARK_ACTIONS, actionStrength, useAction } from './index.js';

it('使用行动移到最左侧，仅推动原来位于左侧的卡牌', () => {
  expect(actionStrength(ARK_ACTIONS, 'association')).toBe(4);
  expect(useAction(ARK_ACTIONS, 'association')).toEqual(['association', 'animals', 'build', 'cards', 'sponsors']);
  expect(useAction(ARK_ACTIONS, 'animals')).toEqual(ARK_ACTIONS);
  expect(useAction(ARK_ACTIONS, 'sponsors')).toEqual(['sponsors', 'animals', 'build', 'cards', 'association']);
});
it('拒绝错误的五行动清单', () => {
  expect(() => useAction(['animals', 'animals', 'cards', 'association', 'sponsors'], 'cards')).toThrow('五种');
});
