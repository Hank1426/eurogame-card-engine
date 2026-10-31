import { useState } from 'react';
import {
  appealIncome, crossingAppeal, victoryScore, availableWorkers, tagsOf, projectById, projectMetric,
  DECK_PROJECTS, projectDescription, FINAL_CARDS, BONUS_NAMES, TAG_NAMES, UNIVERSITY_NAMES,
  zooCard, donationCost, type ArkView
} from '@eurogame/game-ark-nova';
import { ArkArtwork } from './ArkArtwork.js';
import { ArkIcon } from './ArkIcon.js';

const tabs = { projects: '保护项目', zoo: '我的园区', association: '协会', scores: '轨道与目标', opponent: 'AI 园区' };
export function ArkOverview({ view, assets, inspect }: {
  view: ArkView; assets: Record<string, string>; inspect: (id: string, source: 'tableau') => void;
}) {
  const [tab, setTab] = useState<keyof typeof tabs>('projects');
  const player = view.players[0]!;
  const other = view.players[1]!;
  const active = tab;
  return <section className="ark-overview panel" aria-label="公共信息">
    <div className="ark-info-tabs" role="tablist" aria-label="牌桌信息">{Object.entries(tabs).map(([id, label]) =>
      <button key={id} id={`ark-tab-${id}`} role="tab" aria-selected={active === id} aria-controls={`ark-info-${id}`} onClick={() => setTab(id as keyof typeof tabs)}>{label}</button>)}</div>
    <div className="ark-overview-scroll" role="tabpanel" id={`ark-info-${active}`} aria-labelledby={`ark-tab-${active}`}>
      <div hidden={active !== 'projects'}>
        <div className="ark-mini-heading"><strong>基础保护项目</strong><small>每人每项一次 · 灰色等级为双人封锁</small></div>
        <div className="ark-project-grid">{view.projects.map(current => {
          const project = projectById(current.id);
          return <article className="ark-project-card" key={current.id}>
            <div className="ark-project-art"><ArkArtwork id={project.id} assets={assets} /><strong>{project.name}</strong></div>
            <div className="ark-project-tiers">{project.thresholds.map((threshold, tier) =>
              <div className={current.blocked === tier ? 'blocked' : current.claimed[tier] ? `claimed ${current.claimed[tier]}` : ''} key={tier} title={`${threshold} ${TAG_NAMES[project.tag]}，奖励 ${project.points[tier]} 保护点`}>
                <strong><ArkIcon name={project.tag} assets={assets} />{threshold}</strong><span>⬟ {project.points[tier]}</span>
                <small>{current.blocked === tier ? '封锁' : current.claimed[tier] === 'p1' ? '你已支持' : current.claimed[tier] ? 'AI 已支持' : `你有 ${projectMetric(player, project.tag)}`}</small>
              </div>)}</div>
          </article>;
        })}</div>
        <div className="ark-mini-heading"><strong>牌库保护项目</strong><small>双人最多两张</small></div>
        <div className="ark-project-grid" data-testid="ark-active-projects">{view.activeProjects.length ? view.activeProjects.map(current => {
          const project = DECK_PROJECTS.find(project => project.id === current.id)!;
          return <article className="ark-project-card" key={current.id}><div className="ark-project-art"><ArkArtwork id={project.id} assets={assets} /><strong>{project.name}</strong></div>
            <p className="ark-project-description">{projectDescription(project.id)}</p>
            <div className="ark-project-tiers">{project.thresholds.map((need, tier) =>
              <div className={current.claimed[tier] ? `claimed ${current.claimed[tier]}` : ''} key={tier}>
                <strong>{project.mode === 'release' ? ['4–5 格', '3 格', '1–2 格'][tier] : project.mode === 'breed' ? '动物 + 合作' : `${need} ${TAG_NAMES[project.tag]}`}</strong>
                <span>⬟ {project.points[tier]}</span><small>{current.claimed[tier] === 'p1' ? '你已支持' : current.claimed[tier] ? 'AI 已支持' : '可竞争'}</small>
              </div>)}</div></article>;
        }) : <p className="muted">协会行动可从手牌打出项目并立即支持。</p>}</div>
      </div>
      <div hidden={active !== 'zoo'}>
        <div className="ark-mini-heading"><strong>已安置动物与赞助商</strong><small>{player.animals.length} 动物 / {player.sponsors.length} 赞助商</small></div>
        <div className="ark-tableau-cards">{[...player.animals, ...player.sponsors].map(id => <button key={id} onClick={() => inspect(id, 'tableau')}><ArkIcon name={zooCard(id).tags[0] ?? 'science'} assets={assets} />{zooCard(id).name}</button>)}</div>
        {!player.animals.length && !player.sponsors.length && <p className="muted">点击底部手牌，在右侧查看条件与打出。</p>}
        <div className="ark-tag-summary">{Object.entries(tagsOf(player)).filter(([, count]) => count > 0).map(([tag, count]) => <span key={tag}><ArkIcon name={tag} assets={assets} />{count}</span>)}</div>
        <div className="ark-mini-heading"><strong>合作动物园与大学</strong></div>
        <div className="ark-tag-summary">{player.partners.map(tag => <span key={tag}><ArkIcon name={tag} assets={assets} />{TAG_NAMES[tag]}</span>)}</div>
        {player.universities.map(id => <p className="muted" key={id}>{UNIVERSITY_NAMES[id]}</p>)}
      </div>
      <div className="ark-association" hidden={active !== 'association'}>
        <div className="ark-mini-heading"><strong>动物园协会</strong><small>可用事务员 {availableWorkers(player)}/{player.workers}</small></div>
        <div className="ark-association-tasks">{[[2, '声望 +2'], [3, '合作动物园'], [4, '合作大学'], [player.sponsors.includes('203') ? 4 : 5, '保护项目']].map(([strength, label]) => <div key={label}><b>{strength}</b><span>{label}</span></div>)}</div>
        <div className="ark-supply"><span>合作动物园供应</span><div>{view.partnerSupply.map(tag => <ArkIcon key={tag} name={tag} assets={assets} />)}</div></div>
        <div className="ark-supply"><span>大学供应</span><div>{view.universitySupply.map(id => <span title={UNIVERSITY_NAMES[id]} key={id}>{id === 'science' ? '⚗⚗' : id === 'hand' ? '▤5' : '⚗◆'}</span>)}</div></div>
        <p className="muted">协会 II 可捐赠 · 下一格 {donationCost(view.donations)} 资金。选择协会行动后，在固定操作栏分步选择任务和奖励。</p>
      </div>
      <div hidden={active !== 'scores'}>
        <div className="ark-tracks" aria-label="公共计分轨道">
          <div className="ark-mini-heading"><strong>魅力与保护交会触发终局</strong>{view.finalTurns !== null && <small>最后 {view.finalTurns} 回合</small>}</div>
          {view.players.map(candidate => <div className={`ark-track-row ${candidate.id}`} key={candidate.id}>
            <span className="ark-track-name">{candidate.id === 'p1' ? '你' : 'AI'} {victoryScore(candidate.appeal, candidate.conservation)} 分</span>
            <div className="ark-score-rail"><span className="ark-appeal-fill" style={{ width: `${candidate.appeal / 114 * 100}%` }} /><span className="ark-conservation-fill" style={{ left: `${Math.max(0, crossingAppeal(candidate.conservation)) / 114 * 100}%` }} />
              <span className="ark-score-token appeal-token" style={{ left: `${Math.min(97, candidate.appeal / 114 * 100)}%` }}>♟{candidate.appeal}</span>
              <span className="ark-score-token conservation-token" style={{ left: `${Math.min(97, Math.max(0, crossingAppeal(candidate.conservation)) / 114 * 100)}%` }}>⬟{candidate.conservation}</span></div>
          </div>)}
          <p className="muted">你的休息收入：{appealIncome(player.appeal)} 资金 + 建筑、赞助商与项目奖励。</p>
        </div>
        <div className="ark-final-cards"><strong>✦ 你的秘密终局目标</strong>{player.finals.map(id => {
          const final = FINAL_CARDS.find(card => card.id === id)!;
          return <div key={id}><strong>{final.name}</strong><small>{final.thresholds.length ? `达成 ${final.thresholds.join(' / ')} → 1 / 2 / 3 / 4 保护点` : final.metric === 'architecture' ? '连接全部水域 / 全部岩石 / 覆盖边界 / 覆盖地图，各 1 点' : '动物图标多于对手，每类 1 点，最多 4 点'}</small></div>;
        })}</div>
      </div>
      <div className="ark-opponent" hidden={active !== 'opponent'}>
        <div className="ark-mini-heading"><strong>{other.name}</strong><small>手牌 {other.handCount}</small></div>
        <p>◈ {other.money} · ♟ {other.appeal} · ⬟ {other.conservation} · ◆ {other.reputation}</p>
        <p>事务员 {availableWorkers(other)}/{other.workers} · 动物 {other.animals.length}</p>
        <div className="ark-opponent-row">{other.row.map(action => <span key={action}><ArkIcon name={action} assets={assets} />{other.upgrades.includes(action) ? 'II' : 'I'}</span>)}</div>
        <div className="ark-tableau-cards">{[...other.animals, ...other.sponsors].map(id => <button key={id} onClick={() => inspect(id, 'tableau')}>{zooCard(id).name}</button>)}</div>
      </div>
    </div>
    <div className="ark-bonus-tiles" role="region" aria-label="本局随机保护奖励">{view.bonusTiles.map(tile =>
      <span className={tile.claimedBy ? 'claimed' : ''} title={`${BONUS_NAMES[tile.reward]} · ${tile.claimedBy === 'p1' ? '你已领取' : tile.claimedBy ? 'AI 已领取' : '仅一人可领'}`} key={`${tile.point}-${tile.reward}`}>
        <b>⬟{tile.point}</b><small>{BONUS_NAMES[tile.reward]}</small>
      </span>)}</div>
  </section>;
}
