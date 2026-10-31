import { arkCoverage } from '@eurogame/content';

export { arkCoverage };
export const ARK_ACTIONS = ['animals', 'build', 'cards', 'association', 'sponsors'] as const;
export type ArkAction = typeof ARK_ACTIONS[number];

export function useAction(row: readonly ArkAction[], action: ArkAction): ArkAction[] {
  if (row.length !== 5 || new Set(row).size !== 5 || row.some(candidate => !ARK_ACTIONS.includes(candidate))) {
    throw new Error('行动槽位必须恰好包含五种不重复的行动。');
  }
  const index = row.indexOf(action);
  if (index < 0) throw new Error('未知行动。');
  return [action, ...row.slice(0, index), ...row.slice(index + 1)];
}

export function actionStrength(row: readonly ArkAction[], action: ArkAction): number {
  useAction(row, action);
  return row.indexOf(action) + 1;
}

export { arkGame, validateArkCommand, type ArkResult } from './engine.js';
export { arkActor, arkPlayer, tagsOf, animalCost, handLimit, availableWorkers, reputationRange, donationCost, finalCardPoints, housingError, buildCommands, projectMetric, projectById, projectRequirementError, projectRewardsFor, buildingUsedSpace, specialSpace, freedEnclosures, releaseHousing, PROJECT_REWARDS, PROJECT_REWARD_NAMES, UNIVERSITY_NAMES } from './rules.js';
export { MAP_A, MAP_0, mapCells, BUILDING_SHAPES, BUILDING_NAMES, buildingCells, placementError, appealIncome, victoryScore, crossingAppeal, type Building, type BuildingKind, type MapId } from './board.js';
export { ACTION_NAMES, cardActionTable, animalCapacity } from './foundation.js';
export { ZOO_CARDS, CARD_IDS, zooCard, BASE_PROJECTS, DECK_PROJECTS, projectDescription, FINAL_CARDS, CONTINENTS, TAG_NAMES, ABILITY_LABELS, sponsorDescription, ARK_LIMITATIONS, type ZooCard } from './cards.js';
export { BONUS_TILES, BONUS_NAMES } from './bonuses.js';
export type { ArkCommand, ArkConfig, ArkState, ArkView, ArkPlayer, ArkSession, ArkChoice } from './types.js';
export { chooseArkCommand } from './ai.js';
