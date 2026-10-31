import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BASE_PROJECTS, DECK_PROJECTS, FINAL_CARDS, ZOO_CARDS } from './cards.js';
import corrections from '../../../content/ark-nova/source-corrections.json' with { type: 'json' };

interface SourceCard {
  id: string;
  raw: {
    size?: number; price?: number; appeal?: number; conservationPoint?: number; reputation?: number;
    rock?: number; water?: number; strength?: number; tags?: string[]; requirements?: string[];
    slots?: { indicator: number; bonuses: { bonusValue: number }[] }[];
    originalArray?: { requirement: number | string }[];
    scoreArray?: { requirement: number | string }[];
    specialEnclosures?: { arguments: [string, number] }[];
  };
}
const sourcePath = 'content/private/ark-nova.reference.json';
it.runIf(existsSync(sourcePath))('本地参考数据独立核对入池卡数值、条件、基础项目和原版终局阈值', () => {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as { cards: SourceCard[] };
  for (const card of ZOO_CARDS) {
    const raw = { ...source.cards.find(candidate => candidate.id === card.id)!.raw };
    for (const correction of corrections.corrections.filter(correction => correction.id === card.id)) Object.assign(raw, { [correction.field]: correction.value });
    expect(card.tags, card.id).toEqual(raw.tags ?? []);
    expect(card.requirements, card.id).toEqual(raw.requirements ?? []);
    expect(card.appeal, card.id).toBe(raw.appeal ?? 0);
    expect(card.conservation, card.id).toBe(raw.conservationPoint ?? 0);
    expect(card.reputation, card.id).toBe(raw.reputation ?? 0);
    expect(card.rock, card.id).toBe(raw.rock ?? 0);
    expect(card.water, card.id).toBe(raw.water ?? 0);
    if (card.kind === 'animal') {
      expect(card.size, card.id).toBe(raw.size);
      expect(card.price, card.id).toBe(raw.price);
      if (card.specialHousing) {
        const special = raw.specialEnclosures!.find(special => special.arguments[0] === (card.specialHousing!.kind === 'aviary' ? 'Large Bird Aviary' : 'Reptile House'))!;
        expect(card.specialHousing.space, card.id).toBe(special.arguments[1]);
      }
    } else if (card.kind === 'sponsor') expect(card.strength, card.id).toBe(raw.strength);
  }
  for (const project of BASE_PROJECTS) {
    const raw = source.cards.find(candidate => candidate.id === project.id)!.raw;
    expect(project.thresholds, project.id).toEqual(raw.slots!.map(slot => slot.indicator));
    expect(project.points, project.id).toEqual(raw.slots!.map(slot => slot.bonuses[0]!.bonusValue));
  }
  for (const project of DECK_PROJECTS) {
    const raw = source.cards.find(candidate => candidate.id === project.id)!.raw;
    expect(project.points, project.id).toEqual(raw.slots!.map(slot => slot.bonuses[0]!.bonusValue));
    if (project.mode === 'collect') expect(project.thresholds, project.id).toEqual(raw.slots!.map(slot => slot.indicator));
  }
  for (const final of FINAL_CARDS.filter(card => card.thresholds.length)) {
    const raw = source.cards.find(candidate => candidate.id === final.id)!.raw;
    expect(final.thresholds, final.id).toEqual((raw.originalArray ?? raw.scoreArray)!.map(row => row.requirement));
  }
});
