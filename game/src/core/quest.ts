import type {GameState,CommandResult} from './types';
import type {ExplorationPoint} from './exploration-types';
import {queryBackpack} from './world-inventory';
import {distance,surface,segmentClear,terrainFits} from './spatial';
import {positionVisible} from './visibility';
import {rightSkillAction} from './right-skill-state';
import {credit} from './economy';
import {worldRewardKey} from './world-session';

export type QuestState={status:'notStarted'|'active'|'completed';revision:number};
export type QuestRequest={worldId:string;visit:number;placeId:number;pointId:string;expectedRevision:number;actorId:string;controlRevision:number};
export const WAREHOUSE_QUEST=Object.freeze({id:'sample-warehouse-investigation',name:'失火储藏室调查',reward:10,reach:1.2,accept:'quest-warehouse-accept',investigate:'quest-warehouse-investigate'});
const reject=(reason:string):CommandResult=>({ok:false,reason});
/** One place-owned record; no legacy objective or DOM progress authority. */
export function worldQuestView(s:GameState){const w=s.world,q=w?.places[w.visit.placeId]?.quest;return q?{...q,name:WAREHOUSE_QUEST.name,progress:q.status==='completed'?1:0}:undefined;}
export function questPointLabel(p:Pick<ExplorationPoint,'id'>){return p.id===WAREHOUSE_QUEST.accept?'调查委托 · 接取任务':'调查记录 · 失火储藏室';}
export function questRequest(s:GameState,pointId:string):QuestRequest|undefined{const w=s.world,q=w?.places[w.visit.placeId]?.quest;return w&&q?{worldId:w.id,visit:w.visit.generation,placeId:w.visit.placeId,pointId,expectedRevision:q.revision,actorId:s.controlledBodyId!,controlRevision:s.controlRevision??0}:undefined;}
export function queryQuestInteraction(s:GameState,r:QuestRequest):CommandResult{
 const gate=queryBackpack(s);if(!gate.ok)return gate;
 const w=s.world!,place=w.places[w.visit.placeId],q=place.quest,p=place.definition.points.find(p=>p.id===r.pointId);
 if(r.worldId!==w.id||r.visit!==w.visit.generation||r.placeId!==w.visit.placeId||!q||!Number.isSafeInteger(q.revision)||q.revision<0||q.revision>=Number.MAX_SAFE_INTEGER||r.expectedRevision!==q.revision||r.controlRevision!==(s.controlRevision??0))return reject('任务访问或进度已过期，请重新操作');
 if(!p||p.kind!=='quest'||!(p.id===WAREHOUSE_QUEST.accept&&p.questAction==='accept'||p.id===WAREHOUSE_QUEST.investigate&&p.questAction==='investigate'))return reject('调查事件点无效');
 const u=s.units.find(u=>u.id===r.actorId);if(!u||u.id!==s.controlledBodyId)return reject('需要当前存活的实控本体');
 const n=u.hunterCombat??u.alCombat;
 if(!['explorationIdle','explorationBattle'].includes(s.context??'')||u.ready>0||u.stagger>0||u.posture<=0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||u.forcedMotion||u.crossing||u.skillLanding||u.transition||u.destination||u.attackIntent||u.attackPending||u.basicAction||u.evasion?.action||u.offhand?.pending||u.offhand?.held||rightSkillAction(u)||u.loadout||Object.values(u.skillStates??{}).some(x=>x.run)||u.recall||u.partyTask||u.rescueTarget||n?.held||u.alCombat?.shotHeld||n?.special||n?.motion||s.time<(n?.hurtUntil??0)||s.time<(n?.finalRecoveryUntil??0))return reject('先结束当前动作再调查');
 if(!positionVisible(s,p.pos))return reject('事件点当前不可见');
 if(surface(s,u.pos)?.layer!==surface(s,p.pos)?.layer||!terrainFits(s,p.pos,.08,true,true)||distance(u.pos,p.pos)>WAREHOUSE_QUEST.reach+1e-7||!segmentClear(s,u.pos,p.pos,true,true,.18))return reject('靠近同层调查点（1.2米），不能隔墙操作');
 if(p.questAction==='accept')return q.status==='notStarted'?{ok:true}:reject(q.status==='completed'?'任务已经完成':'任务已经接取');
 if(q.status!=='active')return reject(q.status==='completed'?'任务已经完成，不重复领奖':'先在前厅接取调查委托');
 const key=worldRewardKey(s,'quest',WAREHOUSE_QUEST.id)!;
 if(s.economy.rewards.includes(key))return reject('该任务奖励已领取');
 if(!s.economy.active||s.economy.settled!==null||!Number.isSafeInteger(s.fragments)||s.fragments<0||!Number.isSafeInteger(s.fragments+WAREHOUSE_QUEST.reward))return reject('随身奖励无法入账，任务保持进行中');
 return {ok:true};
}
export function acceptQuestInteraction(s:GameState,r:QuestRequest):CommandResult{
 const check=queryQuestInteraction(s,r);if(!check.ok)return check;
 const q=s.world!.places[r.placeId].quest!;
 if(r.pointId===WAREHOUSE_QUEST.accept){q.status='active';q.revision++;s.notice='已接取：失火储藏室调查 · 前往储藏室西侧调查记录（SAMPLE）';return {ok:true};}
 const key=worldRewardKey(s,'quest',WAREHOUSE_QUEST.id)!;
 if(!credit(s,WAREHOUSE_QUEST.reward,'quest-investigation',key))return reject('随身奖励入账失败，任务保持进行中');
 s.economy.rewards.push(key);q.status='completed';q.revision++;s.notice='失火储藏室调查完成 · 随身生命力 +10（SAMPLE）';return {ok:true};
}
