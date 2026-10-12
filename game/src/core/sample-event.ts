import type {GameState,CommandResult} from './types';
import {queryBackpack} from './world-inventory';
import {credit} from './economy';
import {worldRewardKey} from './world-session';
import {rightSkillAction} from './right-skill-state';
export const ECHO_EVENT=Object.freeze({id:'sample-echo-event',name:'异常回响',narration:'石壁中传来断续的低语。一个破损的铁匣静静躺在角落，里面似乎还留有什么东西……'});
export type EventState={status:'notStarted'|'offered'|'resolved';revision:number;choiceId:'salvage'|'listen'|null};
export type EventRequest={worldId:string;visit:number;placeId:number;eventId:string;actorId:string;controlRevision:number;expectedRevision:number};
export type EventChoiceRequest=EventRequest&{choiceId:'salvage'|'listen'};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function sampleEventView(s:GameState){const w=s.world,e=w?.places[w.visit.placeId]?.sampleEvent;return e?{...e,name:ECHO_EVENT.name,narration:ECHO_EVENT.narration}:undefined;}
export function sampleEventRequest(s:GameState):EventRequest|undefined{const w=s.world,e=sampleEventView(s);return w&&e?{worldId:w.id,visit:w.visit.generation,placeId:w.visit.placeId,eventId:ECHO_EVENT.id,actorId:s.controlledBodyId!,controlRevision:s.controlRevision??0,expectedRevision:e.revision}:undefined;}
function queryAccess(s:GameState,r:EventRequest):CommandResult{
 const gate=queryBackpack(s);if(!gate.ok)return gate;const w=s.world!,e=w.places[w.visit.placeId].sampleEvent;
 if(!e||r.worldId!==w.id||r.visit!==w.visit.generation||r.placeId!==w.visit.placeId||r.eventId!==ECHO_EVENT.id||r.controlRevision!==(s.controlRevision??0)||r.expectedRevision!==e.revision||!Number.isSafeInteger(e.revision)||e.revision<0||e.revision>=Number.MAX_SAFE_INTEGER)return reject('奇闻访问或进度已过期，请重新打开');
 const u=s.units.find(u=>u.id===r.actorId);if(!u||u.id!==s.controlledBodyId)return reject('需要当前存活的实控本体');const n=u.hunterCombat??u.alCombat;
 if(s.context!=='explorationIdle'||u.ready>0||u.stagger>0||u.posture<=0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||u.forcedMotion||u.crossing||u.skillLanding||u.transition||u.destination||u.direct||u.attackIntent||u.attackPending||u.basicAction||u.evasion?.action||u.offhand?.pending||u.offhand?.held||rightSkillAction(u)||u.loadout||Object.values(u.skillStates??{}).some(x=>x.run)||u.recall||u.partyTask||u.rescueTarget||n?.held||u.alCombat?.shotHeld||n?.special||n?.motion||s.time<(n?.hurtUntil??0)||s.time<(n?.finalRecoveryUntil??0))return reject('脱离交战并结束身体动作后再处理奇闻');
 return {ok:true};
}
export function querySampleEventTrigger(s:GameState,r:EventRequest):CommandResult{const gate=queryAccess(s,r);if(!gate.ok)return gate;const e=sampleEventView(s)!;return e.status==='notStarted'||e.status==='offered'?{ok:true}:reject('这段奇闻已经处理');}
export function triggerSampleEvent(s:GameState,r:EventRequest):CommandResult{const gate=querySampleEventTrigger(s,r);if(!gate.ok)return gate;const e=s.world!.places[r.placeId].sampleEvent!;if(e.status==='notStarted'){e.status='offered';e.revision++;}return {ok:true};}
export function querySampleEventChoice(s:GameState,r:EventChoiceRequest):CommandResult{
 const gate=queryAccess(s,r);if(!gate.ok)return gate;const w=s.world!,e=w.places[r.placeId].sampleEvent!;
 if(e.status!=='offered'||e.choiceId!==null)return reject('先打开尚未处理的奇闻');if(!['salvage','listen'].includes(r.choiceId))return reject('无效奇闻选项');
 if(r.choiceId==='salvage'){const rows=w.backpack!.stacks.filter(x=>x.itemId==='sample-al-regen');if(rows.length>1||rows.length===1&&(!Number.isSafeInteger(rows[0].quantity)||rows[0].quantity<0||!Number.isSafeInteger(rows[0].quantity+1)))return reject('团队药物库存异常或已满，选择尚未结算');}
 else{const key=worldRewardKey(s,'event',ECHO_EVENT.id)!;if(!s.economy.active||s.economy.settled!==null||!Number.isSafeInteger(s.fragments)||s.fragments<0||!Number.isSafeInteger(s.fragments+10)||s.economy.rewards.includes(key))return reject('随身奖励无法入账或已领取，选择尚未结算');}
 return {ok:true};
}
export function acceptSampleEventChoice(s:GameState,r:EventChoiceRequest):CommandResult{
 const gate=querySampleEventChoice(s,r);if(!gate.ok)return gate;const w=s.world!,e=w.places[r.placeId].sampleEvent!;
 if(r.choiceId==='salvage'){const stack=w.backpack!.stacks.find(x=>x.itemId==='sample-al-regen');if(stack)stack.quantity++;else w.backpack!.stacks.push({itemId:'sample-al-regen',quantity:1});s.notice='打开铁匣 · 团队实验缓回药 +1（SAMPLE）';}
 else{const key=worldRewardKey(s,'event',ECHO_EVENT.id)!;if(!credit(s,10,'sample-event-listen',key))return reject('随身奖励入账失败，选择尚未结算');s.economy.rewards.push(key);s.notice='回应低语 · 随身生命力 +10（SAMPLE）';}
 e.status='resolved';e.choiceId=r.choiceId;e.revision++;return {ok:true};
}
