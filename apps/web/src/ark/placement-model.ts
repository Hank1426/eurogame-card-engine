import { arkGame, buildingCells, mapCells, type ArkCommand, type ArkState, type ArkView, type BuildingKind } from '@eurogame/game-ark-nova';
import { hexKey } from '@eurogame/mechanisms';

export type BuildCommand = Extract<ArkCommand, { type: 'build' }>;
export type PlacementOption = NonNullable<ArkView['pending']>['options'][number] & { placement: BuildCommand };
export function placementKey(command: BuildCommand): string {
  return `${command.kind}:${buildingCells(command.kind, command, command.rotation, command.flip).map(hexKey).sort().join('/')}`;
}
export function placementOptions(pending: ArkView['pending']): PlacementOption[] {
  return pending?.options.filter((option): option is PlacementOption => Boolean(option.placement)) ?? [];
}
export function recommendedPlacements(options: PlacementOption[]): PlacementOption[] {
  const seen = new Set<string>();
  return options.filter(option => {
    const key = `${option.placement.kind}:${option.placement.q},${option.placement.r}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
}
export function legalBuildAnchors(state: ArkState, actor: string, kind: BuildingKind, rotation: number, flip: boolean): string[] {
  const player = state.players.find(player => player.id === actor)!;
  return mapCells(player.map).filter(cell => !arkGame.validateCommand(state, actor, { type: 'build', kind, q: cell.q, r: cell.r, rotation, flip })).map(hexKey);
}
