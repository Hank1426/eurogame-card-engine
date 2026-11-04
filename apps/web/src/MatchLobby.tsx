import { useState } from 'react';
import { BotanicalArt, LeafMark } from '@eurogame/ui-kit';
import { GAMES, gameById } from './catalog/games.js';
import type { MatchSettings } from './catalog/types.js';
import type { MatchInfo } from './matches/model.js';
export type { MatchSettings } from './catalog/types.js';

export function MatchLobby({ matches, onStart, busy = false }: {
  matches: MatchInfo[]; onStart: (settings: MatchSettings) => void; busy?: boolean;
}) {
  const [game, setGame] = useState('garden-lab');
  const [playerCount, setPlayerCount] = useState(2);
  const [seed, setSeed] = useState('');
  const [error, setError] = useState('');
  const [map, setMap] = useState('A');
  const descriptor = gameById(game);

  function start() {
    const numericSeed = seed.trim() ? Number(seed.trim()) : crypto.getRandomValues(new Uint32Array(1))[0]!;
    if ((seed.trim() && !/^\d+$/.test(seed.trim())) || !Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffff_ffff) {
      setError('请输入 0–4294967295 的整数种子，或留空随机生成。');
      return;
    }
    setError('');
    if (busy) return;
    onStart({ game, mode: 'ai', playerCount, seed: numericSeed, ...(descriptor.maps ? { map } : {}) });
  }

  return <div className="match-lobby">
    <div className="lobby-intro"><div><span className="eyebrow">A SEAT AT THE TABLE</span><h1>好想法，从一局开始。</h1><p>选一款游戏，邀请 AI 入座。你只需要专注自己的每一步。</p></div><LeafMark /></div>
    {matches.map(match => <section className="continue-match panel" aria-label="已保存的对局" key={match.id}>
      <span className="continue-icon">{gameById(match.gameId).symbol}</span><div><strong>{match.title}</strong><p>{match.recovery ? '原始存档保留，可从对局库导出。' : match.summary?.finished ? '上次对局已结束，可以查看结果和回放。' : `已保存至${match.summary?.progress ?? '当前进度'}，随时可以继续。`}</p></div>
      <a className="secondary" href={`#/matches/${match.id}`}>{match.summary?.finished ? '查看上局结果' : match.gameId === 'ark-nova' ? '继续方舟对局' : '继续对局'}</a>
    </section>)}
    {matches.length > 0 && <a className="lobby-all-matches" href="#/matches">查看全部对局 ↗</a>}
    <div className="lobby-columns">
      <section className="game-picker" aria-labelledby="game-picker-title">
        <div className="lobby-section-heading"><span>01</span><h2 id="game-picker-title">今天，玩点什么？</h2></div>
        {GAMES.map(entry => <button key={entry.id} className={`game-choice ${entry.art === 'botanical' ? 'garden-choice' : 'ark-choice'} ${game === entry.id ? 'selected' : ''}`} aria-pressed={game === entry.id} onClick={() => { setGame(entry.id); setPlayerCount(entry.playerCounts[0]!); setMap(entry.maps?.[0]?.id ?? ''); setError(''); }}>
          <div className="game-choice-heading"><span className="pill green">{entry.status}</span><span className="choice-indicator">{game === entry.id ? '✓' : ''}</span></div>
          {entry.art === 'botanical' ? <BotanicalArt /> : <span className="ark-emblem" aria-hidden="true">{entry.symbol}</span>}<span className="eyebrow">{entry.category}</span><h3>{entry.name}</h3><p>{entry.description}</p>
          <div className="game-choice-meta"><span>{entry.playerCounts.join(' / ')} 人</span><span>本地 AI</span>{entry.maps && <span>地图 {entry.maps.map(map => map.id).join(' / ')}</span>}</div>
        </button>)}
      </section>
      <section className="panel match-settings" aria-labelledby="match-settings-title">
        <div className="lobby-section-heading"><span>02</span><h2 id="match-settings-title">准备这一桌</h2></div>
        <fieldset className="mode-picker"><legend>对战方式</legend>
          <label className="mode-option selected"><input type="radio" name="match-mode" value="ai" checked readOnly /><span><strong>和 AI 对战</strong><small>本地运行，自动行动，无需等待真人</small></span><span className="mode-symbol">✧</span></label>
          <label className="mode-option unavailable"><input type="radio" name="match-mode" value="matchmaking" disabled /><span><strong>在线匹配</strong><small>暂未开放</small></span><span className="pill subtle">筹备中</span></label>
        </fieldset>
        <label className="player-count-label" htmlFor="match-player-count">对局人数</label>
        <select id="match-player-count" value={playerCount} onChange={event => setPlayerCount(Number(event.target.value))}>
          {descriptor.playerCounts.map(count => <option value={count} key={count}>{count} 人 · 你 + {count - 1} 位 AI</option>)}
        </select>
        {descriptor.maps && <><label className="player-count-label" htmlFor="ark-map-choice" style={{ marginTop: 18 }}>动物园地图</label><select id="ark-map-choice" value={map} onChange={event => setMap(event.target.value)}>{descriptor.maps.map(map => <option key={map.id} value={map.id}>地图 {map.id} · {map.name}</option>)}</select><p className="muted" data-testid="ark-map-description" style={{ marginTop: 8 }}>{descriptor.maps.find(candidate => candidate.id === map)?.description}</p></>}
        <div className="seat-preview" aria-label={`${playerCount} 个座位`}><span className="seat human"><span>你</span><small>玩家</small></span>{Array.from({ length: playerCount - 1 }, (_, index) => <span className="seat bot" key={index}><span>AI</span><small>电脑 {index + 1}</small></span>)}</div>
        <div className="match-brief"><strong>这一局如何获胜？</strong><p>{descriptor.brief}</p><a href={`#/${descriptor.rulesRoute}`}>第一次玩？阅读完整规则 ↗</a></div>
        <details className="seed-settings"><summary>高级设置</summary><label>随机种子<input value={seed} onChange={event => setSeed(event.target.value)} inputMode="numeric" placeholder="留空则随机生成" /></label><p className="tiny">相同种子和相同行动，可以重现同一局。</p></details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary full start-match" onClick={start} disabled={busy}>{busy ? '正在创建对局…' : descriptor.id === 'ark-nova' ? '创建方舟对局 · 与 AI 开始' : '创建对局 · 与 AI 开始'}</button>
        <p className="match-footnote">AI 会自动完成回合和卡牌选择，你始终操作自己的手牌。</p>
      </section>
    </div>
  </div>;
}
