import { expect, it } from 'vitest';
import { projectSprite } from './ArkArtwork.js';

it('保护项目按参考图集 101–132 排列，不把最后一行空白格当作卡牌', () => {
  expect(projectSprite('101')?.backgroundPosition).toBe('0% 0%');
  expect(projectSprite('108')?.backgroundPosition).toBe('20% 20%');
  expect(projectSprite('113')?.backgroundPosition).toBe('0% 40%');
  expect(projectSprite('132')?.backgroundPosition).toBe('20% 100%');
  expect(projectSprite('133')).toBeNull();
  expect(projectSprite('421')).toBeNull();
});
