import { expect, it } from 'vitest';
import { createSession } from '@eurogame/engine-core';
import { arkGame, cardRequirementChecks, requirementError } from './index.js';

it('条件详情区分图标缺口、对应大洲合作和声望门槛', () => {
  const player = createSession(arkGame, {}, 42).state.players[0]!;
  player.partners = ['asia'];
  player.animals = ['455'];
  expect(cardRequirementChecks(player, '406')).toEqual([expect.objectContaining({ tag: 'asia', required: 3, actual: 1, missing: 2, met: false })]);
  // Macaque needs the African partner zoo; an African animal is insufficient.
  expect(cardRequirementChecks(player, '456')[0]).toMatchObject({ tag: 'Partner Zoo', actual: 0, met: false });
  player.partners.push('africa');
  expect(cardRequirementChecks(player, '456')[0]).toMatchObject({ actual: 1, met: true });
  expect(cardRequirementChecks(player, '227')[0]).toMatchObject({ required: 6, actual: 1, missing: 5 });
});

it('大型动物减免只用一次，能豁免升级条件且不会错误豁免小型动物', () => {
  const player = createSession(arkGame, {}, 42).state.players[0]!;
  player.sponsors = ['263'];
  expect(cardRequirementChecks(player, '421')[0]).toMatchObject({ tag: 'animalsII', waived: 1, met: true });
  expect(requirementError(player, '421')).toBeNull();
  expect(cardRequirementChecks(player, '406')[0]).toMatchObject({ required: 3, actual: 0, waived: 1, missing: 2, met: false });
  player.universities = ['science'];
  expect(cardRequirementChecks(player, '475').find(check => check.tag === 'animalsII')).toMatchObject({ waived: 0, met: false });
});

it('魅力上限的提示报告超出量，阈值处不误报未满足', () => {
  const player = createSession(arkGame, {}, 42).state.players[0]!;
  player.appeal = 28;
  expect(cardRequirementChecks(player, '264')[0]).toMatchObject({ maximum: true, required: 25, actual: 28, missing: 3, met: false });
  player.appeal = 25;
  expect(cardRequirementChecks(player, '264')[0]).toMatchObject({ missing: 0, met: true });
  expect(requirementError(player, '264')).toBeNull();
});
