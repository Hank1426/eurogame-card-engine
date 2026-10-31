import { ABILITY_LABELS, TAG_NAMES, zooCard, sponsorDescription } from '@eurogame/game-ark-nova';

export const TAG_SYMBOLS: Record<string, string> = { predator: '🐾', herbivore: '♞', primate: '♟', reptile: '◇', bird: '🪽', bear: '●', pet: '♡', africa: 'AF', americas: 'AM', australia: 'AU', asia: 'AS', europe: 'EU', science: '⚗' };
export function ArkCard({ id, assets, selected = false, onClick, compact = false }: {
  id: string; assets: Record<string, string>; selected?: boolean; onClick: () => void; compact?: boolean;
}) {
  const card = zooCard(id);
  const art = assets[id];
  return <button className={`ark-card ${card.kind} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''}`} onClick={onClick} aria-label={`查看 ${card.name}`} aria-pressed={selected}>
    <div className="ark-card-art">{art ? <img src={art} alt="" loading="lazy" /> : <span className="ark-fallback-art">{TAG_SYMBOLS[card.tags[0] ?? 'science'] ?? '⌁'}</span>}
      <div className="ark-card-stat">{card.kind === 'animal' ? <><span>⬡ {card.size}</span><span>{card.price} ◈</span></> : <span>强度 {card.strength}</span>}</div>
      <span className="ark-card-number">{card.id}</span>
    </div>
    <div className="ark-card-name">{card.name}</div>
    <div className="ark-card-tags">{card.tags.map((tag, index) => <span key={`${tag}-${index}`} title={TAG_NAMES[tag]}>{TAG_SYMBOLS[tag] ?? tag}</span>)}{card.water > 0 && <span title="相邻水域">≈ {card.water}</span>}{card.rock > 0 && <span title="相邻岩石">▲ {card.rock}</span>}</div>
    {!compact && <p>{card.kind === 'animal' ? card.abilities.length ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${typeof ability.value === 'number' && ability.value > 1 ? ` ${ability.value}` : ''}`).join('；') : '满足条件并支付费用后安置，获得卡面收益。' : sponsorDescription(id)}</p>}
    <div className="ark-card-rewards"><span>{card.appeal > 0 ? `♟ ${card.appeal}` : ''}</span><span>{card.conservation > 0 ? `⬟ ${card.conservation}` : ''}</span><span>{card.reputation > 0 ? `◆ ${card.reputation}` : ''}</span></div>
  </button>;
}
