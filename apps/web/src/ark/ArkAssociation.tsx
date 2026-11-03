import { useEffect, useState } from 'react';
import { PROJECT_REWARD_NAMES, TAG_NAMES, UNIVERSITY_NAMES, projectById, zooCard, type ArkCommand } from '@eurogame/game-ark-nova';
import { ArkOptions } from './ArkOptions.js';
import { ArkIcon } from './ArkIcon.js';

type Association = Extract<ArkCommand, { type: 'association' }>;
const taskNames = { reputation: '声望 +2', partner: '合作动物园', university: '合作大学', project: '支持保护项目' };
const taskIcons = { reputation: 'reputation', partner: 'Partner Zoo', university: 'science', project: 'conservation' };
const rewardIcons: Record<string, string> = { snap: 'cards', 'free-2': 'enclosure', 'income-5': 'income', 'income-cp': 'conservation', 'draw-2': 'cards', 'money-12': 'money', 'x-3': 'x', worker: 'worker', 'income-sponsor': 'sponsors' };
const rewardNames: Record<string, string> = { snap: '精选 1 张', 'free-2': '免费 2 格区', 'income-5': '5 资金收入', 'income-cp': '1 保护收入', 'draw-2': '抽取 2 张', 'money-12': '12 资金', 'x-3': '3 枚 X', worker: '解锁事务员', 'income-sponsor': '付费赞助商' };
export function ArkAssociation({ options, disabled, send, assets = {}, onDraftChange }: {
  options: Association[]; disabled: boolean; send: (command: ArkCommand) => void; assets?: Record<string, string>;
  onDraftChange: (command: Association | null) => void;
}) {
  const [task, setTask] = useState<Association['task']>('project');
  const [target, setTarget] = useState('');
  const [tier, setTier] = useState(0);
  const [release, setRelease] = useState('');
  const [reward, setReward] = useState('money-12');
  const [rewardFirst, setRewardFirst] = useState(false);
  const [wildcard, setWildcard] = useState('');
  const [step, setStep] = useState('task');
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
  const steps = ['task', ...(activeTask !== 'reputation' ? ['target'] : []), ...(activeTask === 'project' ? ['tier', ...(releases.some(Boolean) ? ['release'] : []), 'reward', ...(wildcards.some(Boolean) ? ['wildcard'] : [])] : []), 'review'];
  const names: Record<string, string> = { task: '任务', target: '目标', tier: '等级', release: '放归', reward: '奖励', wildcard: '通配', review: '确认' };
  const activeStep = steps.includes(step) ? step : 'task';
  const next = (current: string) => setStep(steps[steps.indexOf(current) + 1] ?? 'review');
  const draft = command && activeStep === 'review' ? { ...command, rewardFirst } : null;
  const signature = JSON.stringify(draft);
  useEffect(() => { onDraftChange(JSON.parse(signature) as Association | null); }, [signature, onDraftChange]);
  const targetName = (option: Association) => option.task === 'project' ? projectById(option.target).name : option.task === 'university' ? UNIVERSITY_NAMES[option.target]! : `${TAG_NAMES[option.target]}合作动物园`;
  return <form id="ark-association-form" className="ark-association-options" data-task={activeTask} onSubmit={event => { event.preventDefault(); if (draft && !disabled) send(draft); }}>
    {!options.length ? <p className="muted">当前强度或事务员不足。可以结束行动。</p> : <>
      <nav className="ark-association-steps" aria-label="协会选择步骤">{steps.map((id, index) => <button type="button" key={id} aria-current={activeStep === id ? 'step' : undefined} onClick={() => setStep(id)} disabled={disabled || index > steps.indexOf(activeStep)}>{index + 1} {names[id]}</button>)}</nav>
      {activeStep === 'task' && <ArkOptions label="协会任务" value={activeTask} disabled={disabled} assets={assets} options={tasks.map(task => ({ value: task, label: taskNames[task], icon: taskIcons[task] }))} onChange={value => { setTask(value as Association['task']); setTarget(''); setStep(value === 'reputation' ? 'review' : 'target'); }} />}
      {activeStep === 'target' && <ArkOptions label="任务目标" value={activeTarget} disabled={disabled} assets={assets} options={targets.map(target => {
        const option = taskOptions.find(option => `${option.source ?? 'board'}:${option.target}` === target)!;
        return { value: target, label: activeTask === 'university' ? option.target === 'science' ? '研究大学' : option.target === 'hand' ? '手牌大学' : '声望大学' : targetName(option), ...(activeTask === 'partner' ? { displayLabel: TAG_NAMES[option.target]! } : {}), icon: activeTask === 'project' ? projectById(option.target).tag : activeTask === 'university' ? option.target === 'hand' ? 'cards' : 'science' : option.target, detail: activeTask === 'university' ? UNIVERSITY_NAMES[option.target]! : option.source === 'hand' ? '从手牌打出' : option.source === 'market' ? '从展示区打出' : '公共供应' };
      })} onChange={value => { setTarget(value); next('target'); }} />}
      {activeStep === 'tier' && command && <ArkOptions label="支持等级" value={activeTier} disabled={disabled} assets={assets} options={tiers.map(tier => ({ value: String(tier), label: `等级 ${tier + 1}`, icon: 'conservation', badge: `+${projectById(command.target).points[tier]}` }))} onChange={value => { setTier(Number(value)); setStep(targetOptions.some(option => option.tier === Number(value) && option.releaseAnimal) ? 'release' : 'reward'); }} />}
      {activeStep === 'release' && <ArkOptions label="放归动物" value={activeRelease} disabled={disabled} assets={assets} options={releases.filter(Boolean).map(id => ({ value: id, label: zooCard(id).name, icon: zooCard(id).tags[0] ?? 'animals', detail: `${zooCard(id).size} 格 · 退还卡面魅力 ${zooCard(id).appeal}` }))} onChange={value => { setRelease(value); next('release'); }} />}
      {activeStep === 'reward' && <ArkOptions label="边缘奖励" value={activeReward} disabled={disabled} assets={assets} options={rewards.map(reward => ({ value: reward, label: rewardNames[reward] ?? reward, icon: rewardIcons[reward] ?? 'conservation', detail: PROJECT_REWARD_NAMES[reward]! }))} onChange={value => { setReward(value); next('reward'); }} />}
      {activeStep === 'wildcard' && <ArkOptions label="繁育通配标记" value={activeWildcard} disabled={disabled} assets={assets} options={wildcards.map(id => ({ value: id, label: id ? id.split('+').map(source => `${zooCard(source).name} ×1`).join(' + ') : '不使用标记', icon: 'conservation' }))} onChange={value => { setWildcard(value); next('wildcard'); }} />}
      {activeStep === 'review' && command && <div className="ark-association-review"><strong><ArkIcon name={taskIcons[command.task]} assets={assets} />{taskNames[command.task]}{command.task !== 'reputation' ? ` · ${targetName(command)}` : ''}</strong>
        {command.task === 'project' && <><p>等级 {command.tier + 1} · {projectById(command.target).points[command.tier]} 保护 · {PROJECT_REWARD_NAMES[command.reward]}</p>{command.releaseAnimal && <p>放归：{zooCard(command.releaseAnimal).name}</p>}{activeWildcard && <p>通配：{activeWildcard.split('+').map(id => zooCard(id).name).join('、')}</p>}<ArkOptions label="奖励顺序" value={String(rewardFirst)} disabled={disabled} options={[{ value: 'false', label: '先保护点，再边缘奖励' }, { value: 'true', label: '先边缘奖励，再保护点' }]} onChange={value => setRewardFirst(value === 'true')} /></>}
        <small>选择草稿尚未执行，在操作台右侧确认。</small>
      </div>}
    </>}
  </form>;
}
