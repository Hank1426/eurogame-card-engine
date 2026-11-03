import { ANIMAL_TAGS, CONTINENTS, TAG_NAMES, zooCard, type ArkPlayer } from '@eurogame/game-ark-nova';

export type GuideFocus = { id: string; kind: 'icon' | 'terrain' | 'housing'; key: string; cardId?: string };
export interface IconSource { label: string; count: number; cardId?: string }
export function relatedTags(key: string, cardId?: string): string[] {
  if (key === 'all-animals') return [...ANIMAL_TAGS];
  if (key === 'all-continents') return [...CONTINENTS];
  if (key === 'Partner Zoo') return cardId && zooCard(cardId).kind === 'animal' ? zooCard(cardId).tags.filter(tag => CONTINENTS.some(continent => continent === tag)) : [...CONTINENTS];
  return [key];
}
export function iconSources(player: ArkPlayer, key: string, cardId?: string): IconSource[] {
  const tags = relatedTags(key, cardId);
  const sources: IconSource[] = [...player.animals, ...player.sponsors].flatMap(id => {
    const card = zooCard(id);
    const count = key === 'Partner Zoo' ? 0 : key === 'animal-size-2' || key === 'animal-size-4'
      ? Number(card.kind === 'animal' && (key === 'animal-size-2' ? card.size <= 2 : card.size >= 4))
      : tags.reduce((sum, tag) => sum + (tag === 'water' ? card.water : tag === 'rock' ? card.rock : card.tags.filter(value => value === tag).length), 0);
    return count ? [{ cardId: id, label: card.name, count }] : [];
  });
  for (const tag of player.partners) if (tags.includes(tag)) sources.push({ label: `${TAG_NAMES[tag]}合作动物园`, count: 1 });
  if (tags.includes('science')) {
    if (player.universities.includes('science')) sources.push({ label: '研究大学', count: 2 });
    if (player.universities.includes('reputation')) sources.push({ label: '声望大学', count: 1 });
  }
  return sources;
}
