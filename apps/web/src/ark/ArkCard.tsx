import { ABILITY_LABELS, TAG_NAMES, zooCard, sponsorDescription, projectDescription } from '@eurogame/game-ark-nova';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkIcon } from './ArkIcon.js';
import { ArkRequirements } from './ArkRequirements.js';

export const TAG_SYMBOLS: Record<string, string> = { predator: '🐾', herbivore: '♞', primate: '♟', reptile: '◇', bird: '🪽', bear: '●', pet: '♡', africa: 'AF', americas: 'AM', australia: 'AU', asia: 'AS', europe: 'EU', science: '⚗' };
export function ArkCard({ id, assets, selected = false, onClick, compact = false }: {
  id: string; assets: Record<string, string>; selected?: boolean; onClick: () => void; compact?: boolean;
}) {
  const card = zooCard(id);
  return <button className={`ark-card ${card.kind} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`} onClick={onClick} aria-label={`查看 ${card.name}`} aria-pressed={selected}>
    <div className="ark-card-art"><ArkArtwork id={id} assets={assets} />
      <div className="ark-card-stat">{card.kind === 'animal' ? <><span>⬡ {card.size}</span><span>{card.price} ◈</span></> : <span>{card.kind === 'project' ? '⬟ 保护项目' : `强度 ${card.strength}`}</span>}</div>
      <span className="ark-card-number">{card.id}</span>
    </div>
    <div className="ark-card-name">{card.name}</div>
    <div className="ark-card-tags">{card.tags.map((tag, index) => <span key={`${tag}-${index}`} title={TAG_NAMES[tag]}><ArkIcon name={tag} assets={assets} /></span>)}</div>
    <ArkRequirements card={card} assets={assets} />
    {!compact && <p>{card.kind === 'animal' ? card.abilities.length ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${typeof ability.value === 'number' && ability.value > 1 ? ` ${ability.value}` : ''}`).join('；') : '满足条件并支付费用后安置，获得卡面收益。' : card.kind === 'project' ? projectDescription(id) : sponsorDescription(id)}</p>}
    <div className="ark-card-rewards"><span>{card.appeal > 0 ? `♟ ${card.appeal}` : ''}</span><span>{card.conservation > 0 ? `⬟ ${card.conservation}` : ''}</span><span>{card.reputation > 0 ? `◆ ${card.reputation}` : ''}</span></div>
  </button>;
}
