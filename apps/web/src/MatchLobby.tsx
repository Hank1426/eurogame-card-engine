import { useState } from 'react';
import { BotanicalArt, LeafMark } from '@eurogame/ui-kit';
import { MAP_IDS, MAP_INFO, type MapId } from '@eurogame/game-ark-nova';

export interface MatchSettings {
  game: 'garden-lab' | 'ark-nova';
  mode: 'ai';
  playerCount: number;
  seed: number;
  map?: MapId;
}

export interface CurrentMatch {
  playerCount: number;
  round: number;
  roundLimit: number;
  finished: boolean;
  map?: MapId;
}

export function MatchLobby({ currentMatch, arkMatch = null, onStart }: {
  currentMatch: CurrentMatch | null;
  arkMatch?: CurrentMatch | null;
  onStart: (settings: MatchSettings) => void;
}) {
  const [game, setGame] = useState<'garden-lab' | 'ark-nova'>('garden-lab');
  const [playerCount, setPlayerCount] = useState(2);
  const [seed, setSeed] = useState('');
  const [error, setError] = useState('');
  const [map, setMap] = useState<MapId>('A');
  const isDemo = game === 'garden-lab';

  function start() {
    const numericSeed = seed.trim() ? Number(seed.trim()) : crypto.getRandomValues(new Uint32Array(1))[0]!;
    if ((seed.trim() && !/^\d+$/.test(seed.trim())) || !Number.isInteger(numericSeed) || numericSeed < 0 || numericSeed > 0xffff_ffff) {
      setError('请输入 0–4294967295 的整数种子，或留空随机生成。');
      return;
    }
    setError('');
    onStart({ game, mode: 'ai', playerCount: isDemo ? playerCount : 2, seed: numericSeed, map });
  }

  return <div className="match-lobby">
    <div className="lobby-intro"><div><span className="eyebrow">A SEAT AT THE TABLE</span><h1>好想法，从一局开始。</h1><p>选一款游戏，邀请 AI 入座。你只需要专注自己的每一步。</p></div><LeafMark /></div>
    {currentMatch && <section className="continue-match panel" aria-label="已保存的对局">
      <span className="continue-icon">◈</span><div><strong>植序工坊 · {currentMatch.playerCount} 人 AI 对局</strong><p>{currentMatch.finished ? '上次对局已结束，可以查看结果和回放。' : `已保存至第 ${currentMatch.round} / ${currentMatch.roundLimit} 轮，随时可以继续。`}</p></div>
      <a className="secondary" href="#/table">{currentMatch.finished ? '查看上局结果' : '继续对局'}</a>
    </section>}
    {arkMatch && <section className="continue-match panel" aria-label="已保存的方舟对局"><span className="continue-icon">⬡</span><div><strong>方舟动物园 · 双人 AI 对局</strong><p>{arkMatch.finished ? '上次方舟对局已结束，可以查看结果与回放。' : `已保存至第 ${arkMatch.round} 回合，当前地图 ${arkMatch.map ?? 'A'}。`}</p></div><a className="secondary" href="#/ark">{arkMatch.finished ? '查看方舟结果' : '继续方舟对局'}</a></section>}
    <div className="lobby-columns">
      <section className="game-picker" aria-labelledby="game-picker-title">
        <div className="lobby-section-heading"><span>01</span><h2 id="game-picker-title">今天，玩点什么？</h2></div>
        <button className={`game-choice garden-choice ${isDemo ? 'selected' : ''}`} aria-pressed={isDemo} onClick={() => { setGame('garden-lab'); setError(''); }}>
          <div className="game-choice-heading"><span className="pill green">可立即游玩</span><span className="choice-indicator">{isDemo ? '✓' : ''}</span></div>
          <BotanicalArt /><span className="eyebrow">GARDEN LAB / ORIGINAL DEMO</span><h3>植序工坊</h3><p>经营微型生态工坊，用卡牌、资源与持续收入，培育自己的得分引擎。</p>
          <div className="game-choice-meta"><span>2–4 人</span><span>6 轮</span><span>简单 AI</span></div>
        </button>
        <button className={`game-choice ark-choice ${!isDemo ? 'selected' : ''}`} aria-pressed={!isDemo} onClick={() => { setGame('ark-nova'); setPlayerCount(2); setError(''); }}>
          <div className="game-choice-heading"><span className="pill green">基础全牌库 · 实验验收中</span><span className="choice-indicator">{!isDemo ? '✓' : ''}</span></div>
          <span className="ark-emblem" aria-hidden="true">⬡</span><span className="eyebrow">ARK NOVA / BASE LIBRARY</span><h3>方舟动物园</h3><p>使用 128 张动物与 64 张赞助商，体验群居、互动、独有建筑与保护项目。选择基础地图或观测塔、户外营地，与 AI 完成双人对局。</p>
          <div className="game-choice-meta"><span>双人 AI</span><span>地图 A / 0 / 1 / 2</span></div>
        </button>
      </section>
      <section className="panel match-settings" aria-labelledby="match-settings-title">
        <div className="lobby-section-heading"><span>02</span><h2 id="match-settings-title">准备这一桌</h2></div>
        <fieldset className="mode-picker"><legend>对战方式</legend>
          <label className="mode-option selected"><input type="radio" name="match-mode" value="ai" checked readOnly /><span><strong>和 AI 对战</strong><small>本地运行，自动行动，无需等待真人</small></span><span className="mode-symbol">✧</span></label>
          <label className="mode-option unavailable"><input type="radio" name="match-mode" value="matchmaking" disabled /><span><strong>在线匹配</strong><small>暂未开放</small></span><span className="pill subtle">筹备中</span></label>
        </fieldset>
        <label className="player-count-label" htmlFor="match-player-count">对局人数</label>
        <select id="match-player-count" value={playerCount} onChange={event => setPlayerCount(Number(event.target.value))}>
          <option value={2}>2 人 · 你 + 1 位 AI</option>{isDemo && <><option value={3}>3 人 · 你 + 2 位 AI</option><option value={4}>4 人 · 你 + 3 位 AI</option></>}
        </select>
        {!isDemo && <><label className="player-count-label" htmlFor="ark-map-choice" style={{ marginTop: 18 }}>动物园地图</label><select id="ark-map-choice" value={map} onChange={event => setMap(event.target.value as MapId)}>{MAP_IDS.map(id => <option key={id} value={id}>地图 {id} · {MAP_INFO[id].name}</option>)}</select><p className="muted" data-testid="ark-map-description" style={{ marginTop: 8 }}>{MAP_INFO[map].description}</p></>}
        <div className="seat-preview" aria-label={`${playerCount} 个座位`}><span className="seat human"><span>你</span><small>玩家</small></span>{Array.from({ length: playerCount - 1 }, (_, index) => <span className="seat bot" key={index}><span>AI</span><small>电脑 {index + 1}</small></span>)}</div>
        {isDemo ? <div className="match-brief"><strong>这一局如何获胜？</strong><p>每轮每人行动一次。第 6 轮收入结算后，得分最高者获胜；同分并列。</p><a href="#/rules">第一次玩？阅读完整规则 ↗</a></div> : <div className="match-brief"><strong>经营动物园，让魅力与保护相遇</strong><p>五行动强度由槽位决定，没有固定轮数。两条轨道相遇后进入最后回合，再结算终局目标。基础 235 张内容均已接入，逐卡人工复核与完整试玩仍单独验收。</p><a href="#/ark-rules">阅读方舟规则与支持范围 ↗</a></div>}
        <details className="seed-settings"><summary>高级设置</summary><label>随机种子<input value={seed} onChange={event => setSeed(event.target.value)} inputMode="numeric" placeholder="留空则随机生成" /></label><p className="tiny">相同种子和相同行动，可以重现同一局。</p></details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary full start-match" onClick={start}>{isDemo ? '创建对局 · 与 AI 开始' : '创建方舟对局 · 与 AI 开始'}</button>
        <p className="match-footnote">AI 会自动完成回合和卡牌选择，你始终操作自己的手牌。</p>
      </section>
    </div>
  </div>;
}
