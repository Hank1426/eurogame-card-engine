import { expect, it } from 'vitest';
import { parseEnums, parseExport } from './ark-source-parser.js';

it('静态读取枚举、关键词和数据构造器，不执行模型回调', () => {
  const enums = parseEnums([
    "enum Source { BASE = 'Base' } enum Icon { DRAW = 'Draw' }",
    "class KeyWord { static DRAW = new KeyWord(Icon.DRAW, 'abilities.draw', 1, false, { model: () => process.exit() }); }"
  ]);
  expect(parseExport("export const Cards = [{ id: '401', source: Source.BASE, abilities: [new Ability(KeyWord.DRAW, 2)] }]", 'Cards', enums)).toMatchObject([
    { id: '401', source: 'Base', abilities: [{ kind: 'Ability', arguments: [{ kind: 'KeyWord', key: 'DRAW' }, 2] }] }
  ]);
});
it('拒绝调用、展开、未知构造器与原型属性', () => {
  for (const expression of ['run()', 'new Evil()', '[...danger]', '{ __proto__: {} }']) {
    expect(() => parseExport(`const Cards = [${expression}];`, 'Cards', new Map())).toThrow();
  }
});
