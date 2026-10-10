import type {GameState,Pos,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {ensureControlledBody,switchControlledBody} from './direct-control';
import {cancelBasicAction} from './basic-runtime';
import {clearBasicInput} from './basic-chain';
import {cancelHunterSpecial} from './hunter-state';
import {cancelAl} from './al-combat';
import {cancelXX} from './xx-combat';
import {clearAutonomy,initializeAnchor} from './autonomy';
import {clearMotion,clearPersonalAction} from './personal';
import {cancelLoadout,interruptSkill} from './loadout';
import {resetPressure} from './pressure';
import {restoreRevivedStamina} from './stamina';
import {canStop,distance,radius,segmentClear,surface} from './spatial';
import {enemyEntityArea} from './enemy-attack-entity';
import {areaHits} from './attack-area';
import {cancelEnemyAction} from './enemy-action';

/** LT-01 prototype values; simulation seconds, never wall-clock timers. */
export const LIFE_SAMPLE=Object.freeze({wait:10,wipeTransition:.5,retry:.25,searchRadius:3});
export type PartyLifecycle={wipeAt?:number;retryAt?:number;wipeCount:number};
export const usesPartyLifecycle=(s:GameState)=>s.sessionMode==='exploration'&&isStandaloneExploration(s);
const bodies=(s:GameState)=>s.units.filter(u=>isPartyBody(s,u));
function stopBody(s:GameState,u:Unit){
 cancelBasicAction(s,u,'party-death',true);clearBasicInput(u,true);clearAutonomy(u,s);clearMotion(u,s,'party-death');clearPersonalAction(u);cancelLoadout(u);interruptSkill(u);
 u.attackPending=undefined;u.attackIntent=undefined;u.forcedMotion=undefined;u.commandDefense=undefined;u.lastManualBasic=undefined;u.engagement=undefined;u.pursuitTargetId=undefined;u.companionCombat=undefined;
 if(u.evasion)u.evasion.action=undefined;
 if(u.hunterCombat){cancelHunterSpecial(s,u,'party-death');u.hunterCombat.held=false;u.hunterCombat.edgeUntil=-Infinity;u.hunterCombat.hazards=[];}
 if(u.alCombat){cancelAl(s,u,'party-death');u.alCombat.held=u.alCombat.shotHeld=false;u.alCombat.edgeUntil=-Infinity;u.alCombat.entities=[];}
 if(u.xxCombat)cancelXX(s,u,'party-death');
}
/** Called only by the authoritative lethal HP transaction, not by presentation. */
export function partyDeath(s:GameState,u:Unit){
 if(!usesPartyLifecycle(s)||!isPartyBody(s,u)||u.life!=='active')return;
 const owned=s.controlledBodyId===u.id;
 u.life='respawning';u.hp=0;u.downTimer=0;u.respawnAt=s.time+LIFE_SAMPLE.wait;u.respawnTimer=LIFE_SAMPLE.wait;u.reviveRetryAt=undefined;u.shadowResident=false;stopBody(s,u);u.posture=0;u.grayHp=0;u.statuses=[];
 delete s.partyTactics?.[u.id];delete s.partyTacticRequests?.[u.id];
 const rt=s.partyLifecycle??={wipeCount:0};
 if(owned){s.inputEpoch=(s.inputEpoch??0)+1;s.explorationControl={commandFocusId:null};s.selectedBodyId=null;s.tacticalFocus=undefined;}
 if(!bodies(s).some(a=>a.life==='active')){rt.wipeAt??=s.time+LIFE_SAMPLE.wipeTransition;s.notice='双人全灭 · 正在返回出生点';}
 else s.notice=u.name+' 已退场 · 10秒后等待安全位置复活';
 ensureControlledBody(s);
}
function safe(s:GameState,u:Unit,p:Pos,center:Pos,planned:Map<Unit,Pos>){
 if(surface(s,p)?.layer!==surface(s,center)?.layer||!canStop(s,p,u)||!segmentClear(s,center,p,false,true,radius(u)))return false;
 if(s.units.some(a=>a!==u&&a.life==='active'&&a.team==='ally'&&surface(s,a.pos)?.layer===surface(s,p)?.layer&&distance(a.pos,p)<radius(a)+radius(u)+.05))return false;
 if([...planned].some(([a,q])=>distance(p,q)<radius(a)+radius(u)+.05))return false;
 const sample={...u,pos:p};
 // Future arrow destinations are unsafe too: don't respawn under a queued landing.
 return !(s.enemyRuntime?.entities??[]).some(e=>e.expireAt>s.time&&(e.kind==='transport'?distance(e.to,p)<=e.profile.radius+radius(u)+.15:areaHits(s,enemyEntityArea(e),sample)));
}
function place(s:GameState,u:Unit,center:Pos,planned=new Map<Unit,Pos>()){
 const candidates:Pos[]=[{...center}];
 for(let r=.85;r<=LIFE_SAMPLE.searchRadius;r+=.35)for(let i=0;i<24;i++)candidates.push({x:center.x+Math.cos(i*Math.PI/12)*r,y:center.y+Math.sin(i*Math.PI/12)*r});
 return candidates.find(p=>safe(s,u,p,center,planned));
}
function revive(s:GameState,u:Unit,p:Pos){
 stopBody(s,u);u.pos={...p};u.drawPos={...p};u.life='active';u.hp=u.maxHp;resetPressure(u);restoreRevivedStamina(s,u);u.statuses=[];u.poisonMeter=0;u.wallPin=undefined;u.shadowResident=false;u.protectedRecall=false;u.respawnTimer=0;u.respawnAt=undefined;u.reviveRetryAt=undefined;u.downTimer=0;u.ready=0;u.hitFlash=u.attackFlash=0;u.attackTimer=0;
 if(u.hunterCombat){const h=u.hunterCombat;h.nextStage=0;h.comboUntil=0;h.finalRecoveryUntil=0;h.hurtUntil=0;h.invulnerableUntil=0;}
 if(u.alCombat){const h=u.alCombat;h.nextStage=0;h.comboUntil=0;h.finalRecoveryUntil=0;h.hurtUntil=0;h.invulnerableUntil=0;}
 initializeAnchor(s,u);if(u.ai){u.ai.command=undefined;u.ai.commandUntil=s.time;u.ai.intent='hold';u.ai.phase='hold';}
}
function clearWipeHazards(s:GameState){
 if(s.enemyRuntime)s.enemyRuntime.entities=[];
 for(const e of s.units.filter(u=>u.team==='enemy')){cancelEnemyAction(s,e,'party-wipe');e.attackPending=undefined;e.attackIntent=undefined;e.engagement=undefined;e.pursuitTargetId=undefined;e.path=[];e.destination=null;if(e.enemyV2){e.enemyV2.dash=undefined;e.enemyV2.knock=undefined;if(e.enemyV2.brain){e.enemyV2.brain.known=undefined;e.enemyV2.brain.seenId=undefined;e.enemyV2.brain.decision='idle';}}}
 s.skillEffects=[];s.effects=[];s.combatHitstop=undefined;s.encounters=[];
}
export function tickPartyLifecycle(s:GameState){
 if(!usesPartyLifecycle(s)||s.phase!=='battle')return;
 const party=bodies(s),rt=s.partyLifecycle??={wipeCount:0};
 for(const u of party)if(u.life==='respawning')u.respawnTimer=Math.max(0,(u.respawnAt??s.time)-s.time);
 if(rt.wipeAt!==undefined){
  if(s.time<rt.wipeAt||s.time<(rt.retryAt??0))return;
  const positions=new Map<Unit,Pos>(),entry=s.exploration!.definition.entry;
  for(const u of party){const p=place(s,u,entry,positions);if(!p){rt.retryAt=s.time+LIFE_SAMPLE.retry;s.notice='出生点受阻 · 等待双人安全返场';return;}positions.set(u,p);}
  clearWipeHazards(s);for(const [u,p]of positions)revive(s,u,p);rt.wipeAt=rt.retryAt=undefined;rt.wipeCount++;s.inputEpoch=(s.inputEpoch??0)+1;
  switchControlledBody(s,'hunter',false);s.context='explorationIdle';s.exploration!.lastActivity=s.time;s.notice='双人已返回出生点 · 当前世界进度保留';return;
 }
 const survivor=party.find(u=>u.life==='active');if(!survivor)return;
 for(const u of party){if(u.life!=='respawning'||u.respawnTimer>1e-8||s.time<(u.reviveRetryAt??0))continue;const p=place(s,u,survivor.pos);
  if(!p){u.reviveRetryAt=s.time+LIFE_SAMPLE.retry;s.notice=u.name+' 等待安全位置';continue;}revive(s,u,p);s.notice=u.name+' 已在同伴附近复活 · 满基础状态';
 }
}
