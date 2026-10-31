import { expect, it } from 'vitest';
import { gardenPack, packSchema, effectSchema, arkReferenceSchema } from './index.js';

it('未知效果和重复卡牌在内容加载时失败', () => {
  expect(effectSchema.safeParse({ type: 'unknown' }).success).toBe(false);
  expect(packSchema.safeParse({ ...gardenPack, cards: [...gardenPack.cards, gardenPack.cards[0]] }).success).toBe(false);
});
it('参考资料不能冒充已实现规则', () => {
  expect(arkReferenceSchema.safeParse({
    formatVersion: 1,
    source: { repository: 'https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards', commit: 'test', license: 'unknown', files: [] },
    cards: [{ id: '401', name: 'Sample', category: 'animal', raw: {}, implementation: 'implemented' }],
    locales: {}
  }).success).toBe(false);
});
