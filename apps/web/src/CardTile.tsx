import { getCard } from '@eurogame/content';
import { BotanicalArt } from '@eurogame/ui-kit';

export const familyLabels = { habitat: '生境营造', research: '科学研究', infrastructure: '循环设施' };

export function CardTile({ instanceId, selected, onSelect, compact = false, disabled = false }: {
  instanceId: string;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const card = getCard(instanceId);
  return <button className={`game-card ${card.family} ${selected ? 'selected' : ''} ${compact ? 'compact' : ''}`}
    onClick={onSelect} disabled={disabled} aria-label={`查看 ${card.name}`} aria-pressed={Boolean(selected)}>
    <div className="card-topline"><span>{familyLabels[card.family]}</span><span className="cost-tag">{card.cost.credits} ◈{card.cost.energy ? ` / ${card.cost.energy} ✧` : ''}</span></div>
    <BotanicalArt variant={card.family} />
    <div className="card-text"><h3>{card.name}</h3><p>{card.description}</p></div>
    <div className="card-foot"><span>{card.id.replaceAll('-', ' ').toUpperCase()}</span><span>↗</span></div>
  </button>;
}
