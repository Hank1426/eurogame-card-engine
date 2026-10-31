import { useState } from 'react';
import { PROJECT_REWARD_NAMES, TAG_NAMES, UNIVERSITY_NAMES, projectById, zooCard, type ArkCommand } from '@eurogame/game-ark-nova';

type Association = Extract<ArkCommand, { type: 'association' }>;
export function ArkAssociation({ options, disabled, send }: { options: Association[]; disabled: boolean; send: (command: ArkCommand) => void }) {
  const [task, setTask] = useState<Association['task']>('project');
  const [target, setTarget] = useState('');
  const [tier, setTier] = useState(0);
  const [release, setRelease] = useState('');
  const [reward, setReward] = useState('money-12');
  const [rewardFirst, setRewardFirst] = useState(false);
  const [wildcard, setWildcard] = useState('');
  const tasks = [...new Set(options.map(option => option.task))];
  const activeTask = tasks.includes(task) ? task : tasks[0];
  const taskOptions = options.filter(option => option.task === activeTask);
  const targets = [...new Set(taskOptions.map(option => `${option.source ?? 'board'}:${option.target}`))];
  const activeTarget = targets.includes(target) ? target : targets[0];
  const targetOptions = taskOptions.filter(option => `${option.source ?? 'board'}:${option.target}` === activeTarget);
  const tiers = [...new Set(targetOptions.map(option => option.tier))];
  const activeTier = tiers.includes(tier) ? tier : tiers[0];
  const tierOptions = targetOptions.filter(option => option.tier === activeTier);
  const releases = [...new Set(tierOptions.map(option => option.releaseAnimal ?? ''))];
  const activeRelease = releases.includes(release) ? release : releases[0];
  const releaseOptions = tierOptions.filter(option => (option.releaseAnimal ?? '') === activeRelease);
  const rewards = [...new Set(releaseOptions.map(option => option.reward))];
  const activeReward = rewards.includes(reward) ? reward : rewards[0];
  const matchingRewards = releaseOptions.filter(option => option.reward === activeReward);
  const wildcardKey = (option: Association) => option.wildcards?.join('+') ?? option.wildcard ?? '';
  const wildcards = [...new Set(matchingRewards.map(wildcardKey))];
  const activeWildcard = wildcards.includes(wildcard) ? wildcard : wildcards[0];
  const command = matchingRewards.find(option => wildcardKey(option) === activeWildcard);
  const taskNames = { reputation: '声望 +2', partner: '合作动物园', university: '合作大学', project: '支持保护项目' };
  return <form id="ark-association-form" className="ark-association-options" onSubmit={event => { event.preventDefault(); if (command && !disabled) send({ ...command, rewardFirst }); }}>
    {!options.length ? <p className="muted">当前强度或事务员不足。可以结束行动。</p> : <>
      <label>协会任务<select aria-label="协会任务" value={activeTask} onChange={event => setTask(event.target.value as Association['task'])}>{tasks.map(task => <option key={task} value={task}>{taskNames[task]}</option>)}</select></label>
      {activeTask !== 'reputation' && <label>任务目标<select aria-label="任务目标" value={activeTarget} onChange={event => setTarget(event.target.value)}>{targets.map(target => {
        const option = taskOptions.find(option => `${option.source ?? 'board'}:${option.target}` === target)!;
        const name = activeTask === 'project' ? projectById(option.target).name : activeTask === 'university' ? UNIVERSITY_NAMES[option.target] : `${TAG_NAMES[option.target]}合作动物园`;
        return <option value={target} key={target}>{name}{option.source === 'hand' ? ' · 从手牌打出' : option.source === 'market' ? ' · 从展示区打出' : ''}</option>;
      })}</select></label>}
      {activeTask === 'project' && command && <>
        <label>支持等级<select aria-label="支持等级" value={activeTier} onChange={event => setTier(Number(event.target.value))}>{tiers.map(tier =>
          <option key={tier} value={tier}>等级 {tier + 1} · 获得 {projectById(command.target).points[tier]} 保护点</option>)}</select></label>
        {releases.some(Boolean) && <label>放归动物<select aria-label="放归动物" value={activeRelease} onChange={event => setRelease(event.target.value)}>{releases.map(id => <option key={id} value={id}>{zooCard(id).name}</option>)}</select></label>}
        <label>边缘奖励<select aria-label="边缘奖励" value={activeReward} onChange={event => setReward(event.target.value)}>{rewards.map(reward => <option key={reward} value={reward}>{PROJECT_REWARD_NAMES[reward]}</option>)}</select></label>
        {wildcards.some(Boolean) && <label>繁育通配标记<select aria-label="繁育通配标记" value={activeWildcard} onChange={event => setWildcard(event.target.value)}>{wildcards.map(id => <option key={id} value={id}>{id ? id.split('+').map(source => `${zooCard(source).name} ×1`).join(' + ') : '不使用标记'}</option>)}</select></label>}
        <label className="ark-reward-order"><input type="checkbox" checked={rewardFirst} onChange={event => setRewardFirst(event.target.checked)} />先领取边缘奖励，再获得保护点</label>
      </>}
    </>}
  </form>;
}
