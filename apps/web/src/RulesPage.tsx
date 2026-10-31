import { BotanicalArt, SectionHeading } from '@eurogame/ui-kit';

export function RulesPage({ hasMatch }: { hasMatch: boolean }) {
  return <article className="rules-page">
    <section className="rules-intro"><div><span className="eyebrow">HOW TO PLAY / GARDEN LAB</span><h1>植序工坊 · 游戏规则</h1><p>用六轮时间，经营你的微型生态工坊。把资金和能量变成设施、生境与研究成果，获得更多得分。</p><div className="rules-badges"><span className="pill green">2–4 人</span><span className="pill subtle">你 + 1–3 位 AI</span><span className="pill subtle">标准对局 6 轮</span></div></div><BotanicalArt /></section>
    <section className="panel winning-rule"><span className="winning-symbol">✦</span><div><span className="eyebrow">THE GOAL</span><h2>第 6 轮结束，得分最高者获胜</h2><p>每轮所有人行动后，先结算收入。最后一轮也结算，再比较得分。同分并列；剩余资金、能量、手牌不额外计分。</p></div></section>
    <section className="panel rules-section"><SectionHeading eyebrow="SETUP" title="开始时，你拥有什么？" />
      <div className="setup-resources"><div><strong>5 ◈</strong><span>起始资金</span></div><div><strong>1 ✧</strong><span>起始能量</span></div><div><strong>3 张</strong><span>私有起始手牌</span></div><div><strong>4 张</strong><span>公共展示区</span></div></div>
      <p>每个人的起始资源相同，起始得分为 0。所有玩家共用一副 24 张牌的牌库；每种卡牌有两个实例。你始终坐在第一个座位，其余座位由简单 AI 操作。</p>
    </section>
    <section className="rules-section actions-guide"><SectionHeading eyebrow="YOUR TURN" title="轮到你时，选择一个行动" />
      <div className="rule-action-grid"><section className="panel rule-action"><span className="action-number">01 / MANAGE</span><span className="rule-action-symbol">◈</span><h3>经营</h3><p>获得 <strong>2 资金 + 1 能量</strong>。</p><p>准备下一次建设所需的资源。这就是本回合的行动，不能接着建设或研究。</p></section>
        <section className="panel rule-action"><span className="action-number">02 / RESEARCH</span><span className="rule-action-symbol">▤</span><h3>研究</h3><p>从牌库抽取<strong>最多 2 张牌</strong>，加入手牌。</p><p>牌库只剩 1 张时抽 1 张；牌库为空时不能选择研究，不会重洗。抽到的牌通常留待之后回合建设。</p></section>
        <section className="panel rule-action"><span className="action-number">03 / BUILD</span><span className="rule-action-symbol">⌁</span><h3>建设一张卡牌</h3><p>从手牌或公共展示区选择<strong>一张</strong>卡，支付费用，再执行它的效果。</p><p>从展示区建设额外支付 <strong>1 资金</strong>。点击卡牌查看完整效果、总费用和是否满足资源条件，再确认。</p></section></div>
    </section>
    <div className="rule-detail-grid"><section className="panel rules-section"><SectionHeading eyebrow="RESOLVE COMPLETELY" title="卡牌效果如何结算？" /><ol>
      <li>确认建设后，支付一次费用，卡牌进入你的已建设区域。</li><li>按顺序执行卡牌效果：获得资源或得分、抽牌、建立收入，或者做出选择。</li><li>遇到选择时，先完成选择；有些卡牌会要求连续或嵌套选择。完成全部效果才结束这次行动。</li><li>行动结束后补充公共展示区，再轮到下一位。牌库为空时，展示位可以留空。</li>
    </ol><p className="rules-note">卡牌上的效果不是额外的常规行动；本回合仍只建设这一张牌。</p></section>
      <section className="panel rules-section"><SectionHeading eyebrow="ROUND & INCOME" title="一轮与一个回合，有什么区别？" /><p><strong>回合：</strong>轮到一位玩家，从经营、研究、建设中选择一个行动。</p><p><strong>一轮：</strong>每位玩家各完成一个回合。所有人行动后，自动结算已建立的持续收入。</p><p>收入从建立当轮的轮末开始获得。第 6 轮末照常结算收入，然后结束游戏。</p><p className="rules-note">例如 3 人对局，每轮依次是你、AI 1、AI 2，各行动一次，然后统一结算收入。</p></section></div>
    <section className="panel rules-section"><SectionHeading eyebrow="PLAY AT YOUR OWN PACE" title="和 AI 对战时" /><div className="rules-ai-copy"><p>AI 会选择合法行动，考虑当前资源、卡牌收益与剩余轮数，并自动完成自己的卡牌选择。它只使用自己能看到的信息，不查看你的手牌或隐藏牌序。</p><p>你不需要切换座位。看到“AI 正在思考”时稍等即可；轮到你后，按钮会恢复可用。离开牌桌或进入历史回放会暂停 AI，返回当前对局后继续。</p><p>对局会自动保存在当前浏览器。刷新后可从创建页继续，未完成的选择也会保留。导入旧的同机对局时，其他座位会由 AI 接管。</p></div></section>
    <div className="rules-bottom"><a className="primary" href={hasMatch ? '#/table' : '#/lobby'}>{hasMatch ? '返回当前对局' : '创建一局试试'}</a><a className="secondary" href="#/lobby">选择游戏与人数</a><span className="tiny">以上是原创 Demo 的规则；方舟动物园有独立的五行动、休息与计分规则。</span></div>
  </article>;
}
