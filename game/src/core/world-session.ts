import {initializeStamina} from './stamina';
import type {CommandResult,GameState,Pos,Unit} from './types';
import type {ExplorationDefinition,ExplorationMemory} from './exploration-types';
import {isPartyBody} from './exploration-party';
import {clearAutonomy} from './autonomy';
import {clearMotion,clearPersonalAction} from './personal';
import {cancelLoadout,interruptSkill} from './loadout';
import {cancelBasicAction} from './basic-runtime';
import {clearBasicInput} from './basic-chain';
import {pauseHunter} from './hunter-combat';
import {pauseAl} from './al-combat';
import {configureCombatTrace,recordCombatLifecycle,resetCombatTrace} from './combat-identity';
import {cancelEnemyAction} from './enemy-action';
import {syncEnemyPosture} from './enemy-posture';
import {canStop,distance,radius,segmentClear} from './spatial';
import {updateVision} from './visibility';

export type AreaVisit={placeId:number;generation:number;active:boolean;enteredAt:number;leftAt?:number};
export type WorldPlace={definition:ExplorationDefinition;memory:ExplorationMemory;checkpoint?:Pos;unloadedEnemies:Unit[]};
export type WorldSession={id:string;generation:number;elapsed:number;visit:AreaVisit;places:Record<number,WorldPlace>;lastUnload?:{generation:number;cancelled:import('./combat-identity').CombatTraceRecord[]};changes:{at:number;visit:number;kind:'begin'|'leave'|'continue'}[]};
const reject=(reason:string):CommandResult=>({ok:false,reason});
export function worldRewardKey(s:GameState,kind:string,source:string){return s.world?`${s.world.id}:place:${s.node}:${kind}:${source}`:undefined;}
function changed(s:GameState,kind:WorldSession['changes'][number]['kind']){const w=s.world!;w.elapsed=s.time;w.changes.push({at:s.time,visit:w.visit.generation,kind});if(w.changes.length>128)w.changes.splice(0,w.changes.length-128);}

/** Begin only after the first ordinary carry. Named fixture constructors remain independent. */
export function beginWorld(s:GameState){
 if(s.sessionMode!=='exploration'||s.world||!s.exploration)return;
 configureCombatTrace(s,s.combatIdentity?.enabled??true);
 const r=s.exploration,generation=(s.worldGeneration??0)+1;s.worldGeneration=generation;
 s.world={id:`world-${generation}`,generation,elapsed:s.time,visit:{placeId:r.definition.id,generation:1,active:true,enteredAt:s.time},places:{[r.definition.id]:{definition:r.definition,memory:r.memory,unloadedEnemies:[]}},changes:[]};
 // Permanent source IDs come from the definition, never the generated runtime unit ID.
 for(const e of s.units.filter(u=>u.team==='enemy')){const source=r.definition.enemies.find(d=>e.rewardKey?.endsWith(':enemy:'+d.id));if(source)e.rewardKey=worldRewardKey(s,'enemy',source.id);}
 initializeStamina(s,true);changed(s,'begin');s.notice='当前世界已建立 · 合法离开后可继续，刷新不存档';
}

/** Cancel visit-owned consumers, without resetPressure/resetPersonal/resetNodeSkills or refunds. */
function unloadActions(s:GameState){
 pauseHunter(s);pauseAl(s);
 for(const u of s.units){
  cancelBasicAction(s,u,'area-unload');clearBasicInput(u,true);u.basicAction=undefined;u.basicRelease=undefined;u.attackPending=undefined;
  recordCombatLifecycle(s,u.attackIntent?.combatContext,'action-cancelled','area-unload');u.attackIntent=undefined;cancelEnemyAction(s,u,'area-unload');
  clearAutonomy(u,s);clearPersonalAction(u);cancelLoadout(u);interruptSkill(u);clearMotion(u,s,'area-unload');u.forcedMotion=undefined;u.engagement=undefined;u.pursuitTargetId=undefined;u.commandDefense=undefined;u.lastManualBasic=undefined;
  if(u.evasion)u.evasion.action=undefined;
  if(u.hunterCombat){u.hunterCombat.hazards=[];u.hunterCombat.nextStage=0;u.hunterCombat.comboUntil=0;}
  if(u.alCombat){u.alCombat.entities=[];u.alCombat.nextStage=0;u.alCombat.comboUntil=0;}
  if(u.enemySense){u.enemySense.provoked=undefined;u.enemySense.lastSeen=undefined;u.enemySense.lostAt=undefined;u.enemyMotion='route';}
 }
 s.partyTactics={};s.partyTacticRequests={};s.controlRevision=(s.controlRevision??0)+1;s.explorationControl={commandFocusId:null};s.selectedBodyId=null;s.tacticalFocus=undefined;
 s.damageFloats=[];s.effects=[];s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.encounters=[];s.reveals={};s.lights=[];s.barricades=[];s.barrierHp={};s.combatHitstop=undefined;
 s.cards=s.cards.filter(c=>c.group!=='scene');s.economy.pending=s.economy.pending.filter(c=>c.group!=='scene');
 if(s.world)s.world.lastUnload={generation:s.combatIdentity?.generation??1,cancelled:(s.combatIdentity?.trace??[]).filter(row=>row.type==='action-cancelled').slice(-64)};
 resetCombatTrace(s);s.enemyRuntime=undefined;syncEnemyPosture(s);
 for(const u of s.units)if(u.enemyV2){const st=u.enemyV2;st.generation=s.combatIdentity?.generation??1;st.dash=undefined;st.knock=undefined;u.pursuitTargetId=undefined;u.enemyMotion='return';if(st.brain)st.brain={home:{...st.brain.home},decision:'idle',repathAt:s.time};}
}

export function queryWorldLeave(s:GameState):CommandResult{
 const w=s.world,r=s.exploration;
 return w&&r&&s.phase==='battle'&&w.visit.active&&w.places[w.visit.placeId]?.definition===r.definition?{ok:true}:reject('当前地点记录失效或区域已离开');
}

/** Caller must first validate the complete legal-exit/abandonment transaction. */
export function leaveWorldArea(s:GameState):CommandResult{
 const check=queryWorldLeave(s);if(!check.ok)return check;
 const w=s.world!,r=s.exploration!;
 const place=w.places[w.visit.placeId];if(!place||place.definition!==r.definition)return reject('当前地点记录失效');
 unloadActions(s);place.checkpoint=r.checkpoint;place.unloadedEnemies=s.units.filter(u=>u.team==='enemy');s.units=s.units.filter(u=>u.team==='ally'&&!u.cloneOf);
 w.visit.active=false;w.visit.leftAt=s.time;s.phase='world';s.context='explorationIdle';s.result=null;s.economy.nodeOpen=false;changed(s,'leave');
 s.notice='已离开当前区域 · 世界、伤势、耐久、进度与随身资源保留；等待期间时间冻结';return {ok:true};
}

export function continueWorld(s:GameState,worldId:string,visit:number):CommandResult{
 const w=s.world;if(!w||w.id!==worldId||w.visit.generation!==visit||w.visit.active||s.phase!=='world')return reject('继续请求已失效，或当前区域仍在探索');
 const p=w.places[w.visit.placeId];if(!p||!p.definition.tiles.length||!s.economy.active||s.economy.settled)return reject('没有合法的当前地点可继续');
 const bodies=s.units.filter(u=>isPartyBody(s,u)&&u.life==='active'),positions=new Map<Unit,Pos>(),entry=p.definition.entry;
 // Plan every placement before mutation. No revival, no partial transition on failure.
 for(const u of bodies){const choices=u===bodies[0]?[entry]:Array.from({length:16},(_,i)=>({x:entry.x+Math.cos(Math.PI/2+i*Math.PI/8)*.85,y:entry.y+Math.sin(Math.PI/2+i*Math.PI/8)*.85}));
  const pos=choices.find(v=>canStop(s,v,u)&&segmentClear(s,entry,v,false,true,radius(u))&&[...positions].every(([other,x])=>distance(x,v)>=radius(other)+radius(u))&&!p.unloadedEnemies.some(e=>e.life==='active'&&distance(e.pos,v)<radius(e)+radius(u)));
  if(!pos)return reject('入口没有合法空间，当前世界状态保持不变');positions.set(u,{...pos});
 }
 if(!bodies.length)return reject('当前没有存活本体可以返回');
 s.units.push(...p.unloadedEnemies);p.unloadedEnemies=[];
 for(const [u,pos]of positions){u.pos=pos;u.drawPos={...pos};}
 s.exploration={definition:p.definition,memory:p.memory,checkpoint:p.checkpoint,visible:[],lastActivity:s.time-10,selectedId:null,visionAt:-1};
 s.phase='battle';s.context='explorationIdle';s.controlledBodyId=bodies.find(u=>u.id===s.controlledBodyId)?.id??bodies[0].id;s.economy.nodeOpen=true;s.economy.visit++;s.attempt++;
 w.visit={placeId:w.visit.placeId,generation:visit+1,active:true,enteredAt:s.time};resetCombatTrace(s);syncEnemyPosture(s);for(const u of s.units)if(u.enemyV2)u.enemyV2.generation=s.combatIdentity?.generation??1;updateVision(s,true);changed(s,'continue');
 s.notice='继续同一世界 · 固定敌人、已用篝火与资源进度保留，没有治疗或结算';return {ok:true};
}
