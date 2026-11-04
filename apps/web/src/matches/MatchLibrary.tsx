import { useState } from 'react';
import { gameById } from '../catalog/games.js';
import type { MatchInfo } from './model.js';

export function MatchLibrary({ matches, edit, exportMatch }: { matches: MatchInfo[]; edit: (id: string, changes: { title?: string; archived?: boolean }) => Promise<boolean>; exportMatch: (id: string) => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const visible = matches.filter(match => match.archived === showArchived);
  return <section className="match-library"><div className="page-intro"><span className="eyebrow">YOUR LOCAL MATCHES</span><h1>我的对局</h1><p>每一局独立保存。继续、归档或导出，留住你的实验与进度。</p></div>
    <div className="match-library-tabs"><button aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>当前对局 {matches.filter(match => !match.archived).length}</button><button aria-pressed={showArchived} onClick={() => setShowArchived(true)}>已归档 {matches.filter(match => match.archived).length}</button><a className="secondary small" href="#/lobby">＋ 新建对局</a></div>
    {!visible.length && <div className="panel match-library-empty">{showArchived ? '暂无归档对局。' : '还没有对局，选择一款游戏开始。'}<a href="#/lobby">前往游戏大厅 ↗</a></div>}
    <div className="match-list">{visible.map(match => <article className="panel match-row" key={match.id} data-match-id={match.id} data-game-id={match.gameId}>
      <span className="match-symbol">{gameById(match.gameId).symbol}</span><div className="match-row-main">
        {renaming === match.id ? <form onSubmit={event => { event.preventDefault(); void edit(match.id, { title: name }).then(ok => { if (ok) setRenaming(null); }); }}><input aria-label="对局名称" maxLength={80} value={name} onChange={event => setName(event.target.value)} autoFocus /><button type="submit" className="secondary small">保存名称</button><button type="button" className="text-button" onClick={() => setRenaming(null)}>取消</button></form> : <h2>{match.title}</h2>}
        <p>{match.recovery ? '原始存档待恢复 · 可导出保留' : match.summary?.finished ? '对局已结束 · 可查看结果与回放' : match.summary?.progress ?? '等待恢复'} · {match.summary?.playerCount ?? '?'} 人 AI{match.summary?.map ? ` · 地图 ${match.summary.map}` : ''}{!match.summary?.finished && match.summary?.decision ? match.summary.decision === 'human' ? ' · 等待你操作' : ' · 继续后由 AI 行动' : ''}</p><small>{new Date(match.updatedAt).toLocaleString('zh-CN')} · 本地保存</small>
      </div><div className="match-row-actions"><a className="primary small" href={`#/matches/${match.id}`}>{match.summary?.finished ? '查看结果' : '继续'}</a><button className="text-button" onClick={() => { setRenaming(match.id); setName(match.title); }}>重命名</button><button className="text-button" onClick={() => exportMatch(match.id)}>导出</button><button className="text-button" onClick={() => { void edit(match.id, { archived: !match.archived }); }}>{match.archived ? '恢复归档' : '归档'}</button></div>
    </article>)}</div><p className="match-library-note">对局保存在当前浏览器中，不跨设备同步。导出 JSON 可以备份；归档不会删除存档。</p>
  </section>;
}
