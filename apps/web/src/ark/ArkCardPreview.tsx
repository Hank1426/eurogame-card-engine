import { ABILITY_LABELS, zooCard, sponsorDescription, projectDescription } from '@eurogame/game-ark-nova';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkIcon } from './ArkIcon.js';
import { ArkRequirements } from './ArkRequirements.js';
import { useArkGuide } from './ArkGuide.js';

export function ArkCardPreview({ id, assets, tooltipId, left, top, staticConditions = false }: {
  id: string; assets: Record<string, string>; tooltipId: string; left: number; top: number; staticConditions?: boolean;
}) {
  const card = zooCard(id);
  const context = useArkGuide();
  const guide = staticConditions ? null : context;
  return <aside className={`ark-card-preview ${card.kind}`} id={tooltipId} role="tooltip" style={{ left, top }}>
    <div className="ark-preview-art"><ArkArtwork id={id} assets={assets} /><span>{card.kind === 'animal' ? `卡面费用 ${card.price} · ${card.size} 格` : card.kind === 'sponsor' ? `赞助商等级 ${card.strength}` : '保护项目'} / {id}</span></div>
    <div className="ark-preview-body"><h2>{card.name}</h2><div className="ark-preview-tags">{card.tags.map((tag, index) => <ArkIcon name={tag} assets={assets} key={`${tag}-${index}`} />)}<span><ArkIcon name="appeal" assets={assets} />{card.appeal}</span><span><ArkIcon name="conservation" />{card.conservation}</span><span><ArkIcon name="reputation" assets={assets} />{card.reputation}</span></div>
      <strong>{guide ? '当前条件 · 卡面仍需实际行动校验' : '卡面条件'}</strong><ArkRequirements card={card} assets={assets} interactive={false} useGuide={!staticConditions} {...(guide ? { player: guide.player, state: { market: guide.market } } : {})} />
      <p>{card.kind === 'animal' ? card.abilities.map(ability => `${ABILITY_LABELS[ability.key]}${ability.value !== 1 ? ` ${ability.value}` : ''}`).join('；') || '安置后获得卡面收益。' : card.kind === 'project' ? projectDescription(id) : sponsorDescription(id)}</p>
      <small>点击卡牌，查看实际费用、合法目标并操作。</small>
    </div>
  </aside>;
}
