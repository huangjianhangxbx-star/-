import type {CommandResult,GameState,Unit} from './types';
import {equipmentBusy} from './equipment';
import {inventoryQuantity,queryBackpack} from './world-inventory';
import {trialState,trialProfession,acquireTrialSource,cancelTrialPending,removeTrialSource,replaceTrialSource,SOURCE_DEFINITIONS} from './ability-trial';
export type TrialKey='Q'|'E'|'R';
export type TrialRoot='rush'|'rocket'|'precision';
export const TRIAL_ROOTS={rush:{name:'破阵猛冲',profession:'blue'},rocket:{name:'火箭弹射',profession:'yellow'},precision:{name:'精准装填',profession:'yellow'}} as const;
export const ACTIVE_TOKEN='sample-cr-active-upgrade',PASSIVE_TOKEN='sample-cr-passive-upgrade';
export type TrialPlan={slots:Record<TrialKey,TrialRoot|null>;choices:Partial<Record<TrialRoot,string[]>>};
export type TrialPreparation=Record<'hunter'|'ranger',TrialPlan>;
export type TrialLoadout=TrialPlan&{skills:Partial<Record<TrialRoot,{id:string;level:number;branches:string[]}>>};
export type TrialQuote={bodyId:string;worldId:string;visit:number;mainId:string;revision:number};
const reject=(reason:string):CommandResult=>({ok:false,reason});
const keys:TrialKey[]=['Q','E','R'];
export function trialPreparation(s:GameState):TrialPreparation{return s.trialPreparation??={hunter:{slots:{Q:null,E:'rush',R:null},choices:{rush:['破阵猛冲1']}},ranger:{slots:{Q:'precision',E:'rocket',R:null},choices:{}}};}
function belongs(root:TrialRoot|null,profession:string){return root===null||Object.hasOwn(TRIAL_ROOTS,root)&&TRIAL_ROOTS[root].profession===profession;}
function swap(plan:TrialPlan,key:TrialKey,root:TrialRoot|null){const other=root&&keys.find(k=>k!==key&&plan.slots[k]===root);if(other)plan.slots[other]=plan.slots[key];plan.slots[key]=root;}
export function prepareTrialSlot(s:GameState,owner:'hunter'|'ranger',key:TrialKey,root:TrialRoot|null):CommandResult{
 if(!s.trialProgression||!s.abilityTrial||s.phase!=='account'||s.world||!['hunter','ranger'].includes(owner)||!keys.includes(key)||!belongs(root,owner==='hunter'?'blue':'yellow'))return reject('出征准备请求无效');
 swap(trialPreparation(s)[owner],key,root);return {ok:true};
}
export function prepareTrialBranch(s:GameState,owner:'hunter'|'ranger',root:TrialRoot,tier:number,branch:string|null):CommandResult{
 if(!s.trialProgression||!s.abilityTrial||s.phase!=='account'||s.world||!['hunter','ranger'].includes(owner)||!belongs(root,owner==='hunter'?'blue':'yellow')||!root||!Number.isInteger(tier)||tier<1||tier>3)return reject('分支准备请求无效');
 const b=branch&&EXECUTABLE_BRANCHES[branch];if(branch&&(!b||b.root!==root||b.tier!==tier))return reject('分支消费者尚未实现');
 const plan=trialPreparation(s)[owner];plan.choices[root]??=[];plan.choices[root]![tier-1]=branch??'';return {ok:true};
}
function chosenBranch(s:GameState,q:TrialQuote,key:TrialKey,branch?:string){const c=check(s,q),root=c?.loadout.slots[key],skill=root&&c!.loadout.skills[root];return branch??(root&&skill?c!.loadout.choices[root]?.[skill.level]:undefined)??'';}
export function initializeTrialLoadout(s:GameState,u:Unit){const t=trialState(u);if(!s.trialProgression||!t||t.loadout)return;
 const plan=structuredClone(trialPreparation(s)[u.id as 'hunter'|'ranger']);
 t.loadout={...plan,skills:Object.fromEntries(Object.entries(TRIAL_ROOTS).filter(([,d])=>d.profession===trialProfession(u)).map(([id])=>[id,{id:t.mainId+':skill:'+id,level:0,branches:[]}]))};
 t.sources=t.sources.filter(x=>SOURCE_DEFINITIONS[x.definitionId].origin==='rune');
 const bag=s.world?.backpack;if(bag&&!bag.trialUpgradeGranted){bag.trialUpgradeGranted=true;bag.stacks.push({itemId:ACTIVE_TOKEN,quantity:6},{itemId:PASSIVE_TOKEN,quantity:2});}
}
export function quoteTrial(s:GameState,u:Unit):TrialQuote{return {bodyId:u.id,worldId:s.world?.id??'',visit:s.world?.visit.generation??-1,mainId:trialState(u)?.mainId??'',revision:trialState(u)?.revision??-1};}
function check(s:GameState,q:TrialQuote){const u=s.units.find(x=>x.id===q.bodyId),t=u&&trialState(u);
 if(!s.trialProgression||!s.abilityTrial||!u||!t?.loadout||s.units.filter(x=>x.id===q.bodyId).length!==1||!queryBackpack(s).ok||q.worldId!==s.world!.id||q.visit!==s.world!.visit.generation||q.mainId!==t.mainId||q.revision!==t.revision||s.controlledBodyId!==u.id||s.context!=='explorationIdle'||u.ready>0||equipmentBusy(u))return;
 return {u,t,loadout:t.loadout};
}
export function configureTrialSlot(s:GameState,q:TrialQuote,key:TrialKey,root:TrialRoot|null):CommandResult{
 const c=check(s,q);if(!c||!keys.includes(key)||!belongs(root,trialProfession(c.u)!))return reject('配置失效、动作未结束或技能未实现');
 swap(c.loadout,key,root);cancelTrialPending(c.u);c.t.revision++;trialPreparation(s)[c.u.id as 'hunter'|'ranger'].slots={...c.loadout.slots};return {ok:true};
}
// Native identities, not six generic damage multipliers. Unclosed consumers cannot be selected.
export const EXECUTABLE_BRANCHES:Readonly<Record<string,{root:TrialRoot;tier:number;source:string}>>=Object.freeze({'破阵猛冲1':{root:'rush',tier:1,source:'rush-frost'},'破阵猛冲2':{root:'rush',tier:1,source:'rush-force'},'破阵猛冲3':{root:'rush',tier:2,source:'rush-frost-power'},'破阵猛冲4':{root:'rush',tier:2,source:'rush-cooldown'},'破阵猛冲5':{root:'rush',tier:3,source:'rush-ice'},'破阵猛冲6':{root:'rush',tier:3,source:'rush-through'},'火箭弹射5':{root:'rocket',tier:3,source:'rocket-reset'},'火箭弹射6':{root:'rocket',tier:3,source:'rocket-speed'},'火箭弹射1':{root:'rocket',tier:1,source:'rocket-stun'},'火箭弹射2':{root:'rocket',tier:1,source:'rocket-power'},'精准装填6':{root:'precision',tier:3,source:'precision-critical'},'精准装填2':{root:'precision',tier:1,source:'precision-speed'},'精准装填4':{root:'precision',tier:2,source:'precision-damage'},'精准装填1':{root:'precision',tier:1,source:'precision-cooldown'},'精准装填3':{root:'precision',tier:2,source:'precision-instant'},'精准装填5':{root:'precision',tier:3,source:'precision-more'},'火箭弹射3':{root:'rocket',tier:2,source:'rocket-launch'}});
export function queryTrialSkillUpgrade(s:GameState,q:TrialQuote,key:TrialKey,branch?:string):CommandResult{
 const c=check(s,q),root=c&&c.loadout.slots[key],skill=root&&c!.loadout.skills[root],b=EXECUTABLE_BRANCHES[chosenBranch(s,q,key,branch)];
 if(!c||!keys.includes(key)||!skill||!b||b.root!==root||skill.level>=3||b.tier!==skill.level+1)return reject('需要当前装备技能的下一层已实现分支');
 return inventoryQuantity(s.world!.backpack,ACTIVE_TOKEN)>=1?{ok:true}:reject('实验技能升阶石不足');
}
function spend(s:GameState,id:string){s.world!.backpack!.stacks.find(x=>x.itemId===id)!.quantity--;}
export function upgradeTrialSkill(s:GameState,q:TrialQuote,key:TrialKey,branch?:string):CommandResult{
 branch=chosenBranch(s,q,key,branch);const gate=queryTrialSkillUpgrade(s,q,key,branch);if(!gate.ok)return gate;const c=check(s,q)!,root=c.loadout.slots[key]!,skill=c.loadout.skills[root]!;
 spend(s,ACTIVE_TOKEN);skill.level++;skill.branches.push(branch);c.loadout.choices[root]??=[];c.loadout.choices[root]![skill.level-1]=branch;
 acquireTrialSource(c.u,EXECUTABLE_BRANCHES[branch].source);trialPreparation(s)[c.u.id as 'hunter'|'ranger'].choices=structuredClone(c.loadout.choices);return {ok:true};
}
export function queryTrialPassiveUpgrade(s:GameState,q:TrialQuote,id:string):CommandResult{
 const c=check(s,q),source=c?.t.sources.find(x=>x.id===id);
 const definition=source&&SOURCE_DEFINITIONS[source.definitionId],target=definition?.upgradesTo&&SOURCE_DEFINITIONS[definition.upgradesTo];
 if(!c||!source||source.upgraded||!definition||definition.effect==='unresolved'||definition.origin!=='rune'||!target||!target.upgraded||target.effect==='unresolved'||target.origin!=='rune'||target.profession!==definition.profession||target.nativeId!==definition.nativeId+'+')return reject('该来源没有可执行的未升级版本');
 return inventoryQuantity(s.world!.backpack,PASSIVE_TOKEN)>=1?{ok:true}:reject('实验符文升级石不足');
}
export function upgradeTrialPassive(s:GameState,q:TrialQuote,id:string):CommandResult{
 const gate=queryTrialPassiveUpgrade(s,q,id);if(!gate.ok)return gate;const c=check(s,q)!,source=c.t.sources.find(x=>x.id===id)!;
 spend(s,PASSIVE_TOKEN);replaceTrialSource(c.u,source.id,SOURCE_DEFINITIONS[source.definitionId].upgradesTo!);return {ok:true};
}
export function acquireTrialRune(s:GameState,q:TrialQuote,id:string):CommandResult{
 const c=check(s,q),d=SOURCE_DEFINITIONS[id];
 if(!c||!d||d.origin!=='rune'||d.upgraded||d.profession!==trialProfession(c.u)||c.t.sources.some(x=>x.definitionId===id||x.definitionId===d.upgradesTo))return reject('该符文已持有或不能在此获取');
 acquireTrialSource(c.u,id);return {ok:true};
}

export function removeTrialRune(s:GameState,q:TrialQuote,id:string):CommandResult{const c=check(s,q),source=c?.t.sources.find(x=>x.id===id);if(!c||!source||SOURCE_DEFINITIONS[source.definitionId]?.origin!=='rune')return reject('符文卸除请求已失效');removeTrialSource(c.u,id);return {ok:true};}
