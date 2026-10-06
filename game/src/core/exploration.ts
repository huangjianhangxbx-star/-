import {initializeEnemyCombat} from './enemy-combat';
import {equipProfileSlots} from './skill-slots';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import type {ExplorationDefinition} from './exploration-types';
import {useCampfire} from './campfire';
import {initializeAnchor,clearAutonomy,stopAutonomous} from './autonomy';
import {COMBAT_CONFIG} from './combat-config';
import {resetPressure} from './pressure';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {explorationDefinition,validateExploration} from './exploration-content';
import {resetEvasion} from './evasion';
import {clearMotion,clearPersonalAction,resetPersonal} from './personal';
import {resetNodeSkills,resetExpeditionSkills} from './progression';
import {cancelLoadout,interruptSkill} from './loadout';
import {clearClones} from './clones';
import {eventCard} from './cards';
import {updateVision} from './visibility';
import {distance,clearShot,SPACE,radius,canStop,segmentClear} from './spatial';
import {navigate} from './navigation';
import {EXPLORE} from './exploration-content';
import {credit,settle} from './economy';
import {positionVisible} from './visibility';
import {actionable} from './personal';
export function queryExplorationExit(s:GameState,abandonIds:string[]=[]):CommandResult{
 const r=s.exploration,h=s.units.find(u=>u.id==='hunter');if(!r||s.phase!=='battle'||!s.economy.active)return {ok:false,reason:'当前没有探索节点可离开'};
 if(s.context!=='explorationIdle')return {ok:false,reason:'交战中不能离开，请先脱战'};
 if(!h||!actionable(h)||h.ready>0||h.crossing||h.skillLanding||distance(h.pos,r.definition.exit)>EXPLORE.exitRadius)return {ok:false,reason:'需要可行动猎人进入出口范围'};
 const down=s.units.filter(u=>isPartyBody(s,u)&&u.life==='downed');
 if(new Set(abandonIds).size!==abandonIds.length||abandonIds.some(id=>!down.some(u=>u.id===id)))return {ok:false,reason:'放弃名单已失效，请重新确认'};
 if(down.some(u=>!abandonIds.includes(u.id)))return {ok:false,reason:'存在濒死同行者，请救援或明确确认放弃'};
 if(s.units.some(u=>isPartyBody(s,u)&&u.id!=='hunter'&&u.life==='active'&&(u.crossing||u.skillLanding||distance(u.pos,r.definition.exit)>EXPLORE.partyExitRadius)))return {ok:false,reason:'其他在场本体需靠近出口或进入影庭'};
 if(s.units.some(e=>e.team==='enemy'&&e.life==='active'&&s.units.some(a=>isPartyBody(s,a)&&a.life==='active'&&distance(e.pos,a.pos)<=EXPLORE.detect&&clearShot(s,e.pos,a.pos))))return {ok:false,reason:'附近敌人已发现本体，先离开交战区域'};
 return {ok:true};
}
export function interactExploration(s:GameState,id:string):CommandResult{
 const r=s.exploration,h=s.units.find(u=>u.id==='hunter');const p=r?.definition.points.find(a=>a.id===id);
 if(!r||s.phase!=='battle'||!p||!h||!actionable(h)||h.crossing||!positionVisible(s,p.pos)||distance(h.pos,p.pos)>1.2)return {ok:false,reason:'猎人需靠近可见事件点'};
 if(r.memory.mechanisms.includes(id))return {ok:false,reason:'此事件已完成'};
 if(p.kind==='campfire')return useCampfire(s,p);
 if(p.kind==='resource'){const key=`${s.economy.serial}:exploration:${s.node}:resource:${p.id}`;if(!credit(s,p.reward,'exploration-resource',key))return {ok:false,reason:'资源领取失败'};s.economy.rewards.push(key);}else r.memory.objective=true;
 r.memory.mechanisms.push(id);s.notice=p.kind==='resource'?'取得10生命力 · 本副本不会重复领取':'静钟已激活 · 进度保存，合法离开后领取通关奖励';return {ok:true};
}
export function exitExploration(s:GameState,abandonIds:string[]=[],death:(u:Unit)=>void):CommandResult{
 const check=queryExplorationExit(s,abandonIds);if(!check.ok)return check;const r=s.exploration!;
 for(const id of abandonIds)death(s.units.find(u=>u.id===id)!);
 if(r.memory.objective&&!r.memory.cleared){const reward=r.definition.points.find(p=>p.kind==='objective')!.reward,key=`${s.economy.serial}:exploration:${s.node}:clear`;
  credit(s,reward,'exploration-clear',key);s.economy.rewards.push(key);r.memory.cleared=true;if(!s.completed.includes(s.node))s.completed.push(s.node);
 }
 clearClones(s,'node');s.units=s.units.filter(u=>u.team==='ally');
 for(const u of s.units){if(!isPartyBody(s,u))continue;clearAutonomy(u);resetPressure(u);clearPersonalAction(u);clearMotion(u);cancelLoadout(u);interruptSkill(u);u.statuses=[];if(u.id!=='hunter'&&u.life==='active'){u.life='withdrawn';u.shadowResident=true;}}
 s.tacticalFocus=undefined;s.damageFloats=[];s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.encounters=[];s.barricades=[];s.barrierHp={};s.lights=[];s.reveals={};
 s.economy.pending=s.economy.pending.filter(c=>c.group!=='scene'&&!c.ownerId?.startsWith('clone-'));s.cards=s.cards.filter(c=>c.group!=='scene'&&!c.ownerId?.startsWith('clone-'));
 if(r.definition.victoryCondition==='exit'){r.memory.cleared=true;settle(s,'success');resetExpeditionSkills(s);s.phase='ended';s.result='victory';s.endReason='victory';s.endedAttempt=s.attempt;s.notice='已离开暗牢 · 探索胜利，随身资源安全入库';return {ok:true};}
 // The map remains a trading context; returning here is not resource settlement.
 s.economy.nodeOpen=true;s.phase='nodes';s.context='explorationIdle';s.notice=r.memory.objective?'已返回地图 · 探索目标完成，资源仍随身':'已提前返回地图 · 未领取通关奖，进度与资源保留';return {ok:true};
}
export function attackCommit(s:GameState,source:Unit,target?:Unit){
 const r=s.exploration;if(!r)return;
 const hunter=source.id==='hunter'&&source.team==='ally'&&!source.cloneOf;
 const enemy=source.team==='enemy'&&!!target&&isPartyBody(s,target);
 if(!hunter&&!enemy)return;
 r.lastActivity=s.time;if(s.context==='explorationBattle')return;
 s.context='explorationBattle';r.combatReason=hunter?'猎人攻击提交':'敌人对本体攻击提交';
 for(const u of s.units.filter(a=>isPartyBody(s,a)&&a.life==='active')){if(u.following&&!u.crossing){clearMotion(u);u.following=false;}stopAutonomous(u);initializeAnchor(s,u);}
}
export function combatActivity(s:GameState,source?:Unit,target?:Unit,at=s.time){
 const r=s.exploration;if(!r||s.context!=='explorationBattle')return;
 const body=(u?:Unit)=>!!u&&isPartyBody(s,u);
 if(source?.team==='ally'&&!body(source)||!body(source)&&!(source?.team==='enemy'&&body(target)))return;
 r.lastActivity=Math.max(r.lastActivity,at);
 if(body(source)&&target?.team==='enemy'&&target.enemySense){target.enemySense.provoked=source!.id;target.enemySense.provokedAt=at;target.enemySense.lastSeen={...source!.pos};}
}
export function updatePartyCombat(s:GameState){const r=s.exploration;if(!r||s.context!=='explorationBattle')return;const chasing=s.units.some(e=>e.team==='enemy'&&e.life==='active'&&e.pursuitTargetId&&s.units.some(a=>a.id===e.pursuitTargetId&&isPartyBody(s,a)&&a.life==='active'));
 if(chasing)return;if(s.time-r.lastActivity>=EXPLORE.calm-1e-7){s.context='explorationIdle';for(const u of s.units.filter(a=>isPartyBody(s,a))){if(isStandaloneExploration(s)&&u.ai?.command==='move'&&(u.path.length||u.crossing||u.skillLanding)){u.ai.anchor=undefined;u.ai.task=undefined;}else clearAutonomy(u);}r.formationHeading=undefined;}
}
export function updateExplorationEnemy(s:GameState,e:Unit){
 const sense=e.enemySense;if(!sense)return;
 const bodies=s.units.filter(a=>isPartyBody(s,a)&&a.life==='active');
 const chaser=isStandaloneExploration(s)&&sense.pursuitPolicy!=='territorial',lost=chaser?4.5:EXPLORE.lost;
 const seen=(a:Unit,tracking=false)=>distance(e.pos,a.pos)<=(tracking&&chaser?18:EXPLORE.detect)&&clearShot(s,e.pos,a.pos);
 let target=bodies.find(a=>a.id===(e.engagement?.targetId||e.pursuitTargetId));
 const bounded=(a:Unit)=>chaser?distance(e.pos,a.pos)<=18:distance(a.pos,sense.home)<=EXPLORE.leash&&distance(e.pos,sense.home)<=EXPLORE.leash;
 if(target&&!bounded(target))target=undefined;
 if(target){if(seen(target,true)){sense.lastSeen={...target.pos};sense.lostAt=undefined;}else{sense.lostAt??=s.time;if(s.time-sense.lostAt>=lost)target=undefined;}}
 if(!target){delete e.engagement;delete e.pursuitTargetId;
  const provoked=bodies.find(a=>a.id===sense.provoked&&s.time-(sense.provokedAt??-10)<=lost&&bounded(a));
  target=provoked||bodies.filter(a=>seen(a)&&bounded(a)).sort((a,b)=>distance(e.pos,a.pos)-distance(e.pos,b.pos)||a.id.localeCompare(b.id))[0];
  if(target){sense.alertedAt=s.time;sense.lastSeen={...target.pos};sense.lostAt=seen(target)?undefined:s.time;e.path=[];}
 }
 if(target){e.pursuitTargetId=target.id;e.enemyMotion='engaged';
  const cost=e.engagementCost??(e.role==='heavy'?2:1),used=s.units.filter(a=>a!==e&&a.engagement?.targetId===target!.id).reduce((n,a)=>n+(a.engagementCost??(a.role==='heavy'?2:1)),0);
  if(!e.engagement&&target.ready<=0&&!target.crossing&&distance(e.pos,target.pos)<=SPACE.engageRadius&&used+cost<=target.block)e.engagement={targetId:target.id,anchor:{...sense.home}};
  return;
 }
 if(e.enemyMotion==='engaged'){e.path=[];e.attackPending=undefined;e.navWait=0;}
 if(e.enemyMotion==='engaged')e.enemyMotion='return';
 if(e.enemyMotion==='return'&&distance(e.pos,sense.home)<.08){e.enemyMotion='route';e.path=[];}else if(e.enemyMotion!=='return')e.enemyMotion='route';e.returnPoint={...sense.home};
 if(e.enemyMotion==='return'){if(!e.path.length)e.path=navigate(s,e.pos,sense.home,true,false,radius(e));return;}
 if(sense.patrol.length){const p=sense.patrol[sense.cursor%sense.patrol.length];if(distance(e.pos,p)<.08)sense.cursor=(sense.cursor+1)%sense.patrol.length;if(!e.path.length)e.path=navigate(s,e.pos,sense.patrol[sense.cursor],true,false,radius(e));}
}
export function enterExploration(s:GameState,make:(id:string,name:string,role:Unit['role'],pos:Pos,team:Unit['team'])=>Unit,d:ExplorationDefinition=explorationDefinition()){
 validateExploration(d);clearClones(s,'node');
 const memory=(s.explorationMemories??={})[d.id]??={seen:[],mechanisms:[],objective:false,cleared:false};s.explorationMemories[d.id]=memory;
 s.exploration={definition:d,memory,visible:[],lastActivity:-10,selectedId:null,visionAt:-1};
 s.explorationControl=d.kind==='standalone'?{commandFocusId:null}:undefined;s.tacticalFocus=undefined;s.controlledBodyId=d.kind==='standalone'?'hunter':null;s.selectedBodyId=null;s.node=d.id;s.ruleset='exploration';s.context='explorationIdle';s.phase='battle';s.result=null;s.time=0;s.attempt++;s.endedAttempt=undefined;s.endReason=undefined;
 s.width=d.width;s.height=d.height;s.tiles=d.tiles;s.goal={...d.exit};s.gate={...d.exit};s.spawns=[];s.deploymentCells=undefined;
 s.waves=[];s.waveState=null;s.spawned=0;s.totalEnemies=d.enemies.length;s.wave=0;s.kills=0;
 s.units=s.units.filter(u=>u.team==='ally'&&!u.cloneOf);
 for(const u of s.units){if(d.kind==='standalone')equipProfileSlots(s,u);else u.skillSlots=undefined;if(!isPartyBody(s,u)){u.evasion=undefined;u.life=['dead','departed','rescued'].includes(u.life)?u.life:'reserve';u.partyTask=undefined;u.following=false;clearAutonomy(u);clearMotion(u);continue;}clearAutonomy(u);cancelLoadout(u);interruptSkill(u);clearPersonalAction(u);clearMotion(u);resetPersonal(u);resetEvasion(s,u);resetNodeSkills(u);u.partyTask=undefined;u.following=false;
  if(u.life==='dead'||u.id==='hunter'&&u.life==='respawning')continue;
  if(s.rescueRestrictions?.[u.id]!==undefined&&s.rescueRestrictions[u.id]!==d.id){delete s.rescueRestrictions[u.id];u.hp=1;}
  u.life=s.rescueRestrictions?.[u.id]===d.id?'rescued':u.id==='hunter'?'active':'reserve';u.shadowResident=u.life==='rescued';
  u.pos={...d.entry};u.drawPos={...u.pos};u.ready=u.id==='hunter'?0:u.ready;u.attackTimer=0;u.statuses=[];u.poisonMeter=0;
 }
 for(const e of d.enemies){const u=make('explore-'+s.nextId++,e.role==='heavy'?'庭院守墓者':e.role==='ranged'?'钟楼铳手':'巡庭亡徒',e.role,e.pos,'enemy');
  u.directionalProfileId=d.kind==='standalone'?e.directionalProfileId:'neutral';u.speed=COMBAT_CONFIG.enemyExploreSpeed;u.hp=u.maxHp=e.hp;u.damage=e.damage;u.weapons.forEach(w=>w.damage=e.damage);u.asset=e.asset;u.ready=0;u.enemySense={pursuitPolicy:d.kind==='standalone'?'chaser':'territorial',home:{...e.pos},patrol:(e.patrol||[]).map(p=>({...p})),cursor:0};
  u.encounterRoom=e.encounterRoom;u.encounterId=e.encounterId;initializeEnemyCombat(s,u,e.id);u.rewardKey=`${s.economy.serial}:exploration:${d.id}:enemy:${e.id}`;s.units.push(u);
 }
 s.barricades=[];s.barrierHp={};s.lights=[];s.tacticalFocus=undefined;s.damageFloats=[];s.effects=[];s.recoveryBudgets={};s.skillEffects=[];s.combatEvents=[];s.weakpointEvents=[];s.encounters=[];s.reveals={};
 s.economy.nodeOpen=true;s.economy.visit++;s.economy.draws=0;eventCard(s,'scene:node:'+d.id,'dash','scene');
 if(d.victoryCondition==='exit'){for(const u of s.units.filter(u=>isPartyBody(s,u)&&u.life==='reserve')){const nearby=Array.from({length:16},(_,i)=>({x:d.entry.x+Math.cos(Math.PI/2+i*Math.PI/8)*.85,y:d.entry.y+Math.sin(Math.PI/2+i*Math.PI/8)*.85}));const p=(isStandaloneExploration(s)?nearby:[]).concat(s.tiles.filter(t=>!t.obstacle&&distance(t,d.entry)<=3).sort((a,b)=>distance(a,d.entry)-distance(b,d.entry))).find(t=>distance(t,d.entry)>.5&&canStop(s,t,u)&&segmentClear(s,d.entry,t,false,true,radius(u)))||(canStop(s,d.entry,u)?d.entry:undefined);if(p){u.life='active';u.ready=0;u.pos={x:p.x,y:p.y};u.drawPos={...u.pos};}}}
 updateVision(s,true);if(d.victoryCondition==='exit'){s.notice='暗牢探索 · 三处篝火可恢复，抵达安全出口完成探索';return;}s.notice='雾钟庭院 · 探索岔路，激活静钟；可从入口提前离开。';
}
