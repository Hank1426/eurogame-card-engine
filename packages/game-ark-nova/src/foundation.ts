import { shuffle } from '@eurogame/engine-core';
import { actionStrength, useAction, type ArkAction } from './index.js';

export const ACTION_NAMES: Record<ArkAction, string> = { animals: '动物', build: '建造', cards: '卡牌', association: '协会', sponsors: '赞助商' };

export function initialActionRow(seed: number): { row: ArkAction[]; rng: number } {
  const result = shuffle<ArkAction>(['build', 'cards', 'association', 'sponsors'], seed);
  return { row: ['animals', ...result.values], rng: result.rng };
}

export function cardActionTable(strength: number, upgraded: boolean): { draw: number; discard: number; snap: boolean } {
  const index = Math.min(5, Math.max(1, strength)) - 1;
  return {
    draw: (upgraded ? [1, 2, 2, 3, 4] : [1, 1, 2, 2, 3])[index]!,
    discard: (upgraded ? [0, 1, 0, 1, 1] : [1, 0, 1, 0, 1])[index]!,
    snap: strength >= (upgraded ? 3 : 5)
  };
}

export function animalCapacity(strength: number, upgraded: boolean): number {
  if (!upgraded) return strength < 2 ? 0 : strength >= 5 ? 2 : 1;
  return strength >= 3 ? 2 : 1;
}

export function selectAction(row: ArkAction[], action: ArkAction, tokens: number, spend: number, takeX = false) {
  if (!Number.isInteger(spend) || spend < 0 || spend > tokens) throw new Error('X 标记数量不足。');
  if (takeX && (tokens >= 5 || spend !== 0)) throw new Error('X 标记最多 5 枚，替代行动不能消耗 X。');
  return {
    strength: actionStrength(row, action) + spend,
    row: useAction(row, action),
    tokens: takeX ? tokens + 1 : tokens - spend
  };
}
