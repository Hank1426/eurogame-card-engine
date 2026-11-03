import { FINAL_CARDS, TAG_NAMES, projectById, type ArkView } from '@eurogame/game-ark-nova';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkIcon } from './ArkIcon.js';
import { ArkHint } from './ArkHint.js';
import { ArkProjectCheck } from './ArkProjectCheck.js';

export function ArkOpeningGoals({ view, assets }: { view: ArkView; assets: Record<string, string> }) {
  const player = view.players.find(player => player.id === 'p1')!;
  return <section className="ark-opening-goals" aria-label="留牌参考目标" data-testid="ark-opening-goals">
    <div className="ark-opening-public"><div className="ark-strip-heading"><strong>公共保护项目</strong><small>参照图标与门槛留牌</small></div>
      <div className="ark-opening-projects">{view.projects.map(current => {
        const project = projectById(current.id);
        return <article className="ark-opening-project" key={current.id} aria-label={project.name}>
          <div className="ark-opening-project-title"><ArkArtwork id={project.id} assets={assets} /><strong>{project.name}</strong></div>
          <div className="ark-opening-tiers">{project.thresholds.map((threshold, tier) => <ArkProjectCheck key={tier} id={project.id} tag={project.tag} needed={threshold} player={player} blocked={current.blocked === tier} className={current.blocked === tier ? 'blocked' : ''}>
            <span><ArkIcon name={project.tag} assets={assets} /><b>{threshold}</b></span><span>{current.blocked === tier ? '×' : '→'}<ArkIcon name="conservation" assets={assets} />{project.points[tier]}</span>
          </ArkProjectCheck>)}</div>
        </article>;
      })}</div>
    </div>
    <div className="ark-opening-private"><div className="ark-strip-heading"><strong>你的终局目标</strong><small>仅自己可见</small></div><div className="ark-opening-finals">{player.finals.map(id => {
      const card = FINAL_CARDS.find(card => card.id === id)!;
      const explanation = card.thresholds.length ? `${TAG_NAMES[card.metric] ?? card.name}达成 ${card.thresholds.join(' / ')}，依次获得 1 / 2 / 3 / 4 保护点。` : card.metric === 'architecture' ? '连接全部水域、全部岩石、覆盖边界、覆盖地图，各得 1 保护点。' : '动物图标多于对手，每类 1 保护点，最多 4 点。';
      return <ArkHint key={id} label={card.name} detail={<><p>{explanation}</p><small>首次达到 10 保护点时弃一张终局卡；额外获得的终局卡按规则保留。</small></>} className="ark-opening-final"><ArkIcon name={TAG_NAMES[card.metric] ? card.metric : 'conservation'} assets={assets} /><span><strong>{card.name}</strong><small>{card.thresholds.length ? `${card.thresholds.join(' / ')} → 1–4` : '悬停查看计分条件'}</small></span></ArkHint>;
    })}</div></div>
  </section>;
}
