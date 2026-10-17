import {initializeHomeResident} from './home-resident';
import {makePlace,resumeEnemy} from './map-place';
import {resolveMap,mapEdges,ensureChallengeRun} from './map-runs';
import {capturePursuers} from './enemy-map-transfer';
import {MAPS,MAP_EDGES,inPortal,portalCrossed,validateMaps,type MapDefinition,type Portal} from './map-definitions';
import {unloadActions,type WorldPlace} from './world-session';
import {isPartyBody} from './exploration-party';
import {terrainFits,distance,radius} from './spatial';
import {clearManualDrops} from './inventory-manual-drop';
import {updateVision} from './visibility';
import {rightSkillAction} from './right-skill-state';
import type {GameState,Pos,Unit} from './types';
/** Ordinary locomotion owns the segment; a leftover held key does not own an attack/dodge displacement. */
function ordinaryMotion(u:Unit){return u.ready<=0&&u.stagger<=0&&!u.forcedMotion&&!u.crossing&&!u.skillLanding&&!u.evasion?.action&&!rightSkillAction(u)&&!u.hunterCombat?.motion&&!u.alCombat?.motion&&(!u.hunterCombat?.special||u.hunterCombat.special.kind==='guard')&&!u.alCombat?.special&&(!u.basicAction||u.basicAction.moveReady&&(u.basicAction.dashLeft??0)<=0)&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0);}
export function mapRemaining(s:GameState){const d=resolveMap(s),r=s.world?.places[d?.id??0]?.mapRoster;return d?d.required.filter(id=>!r?.ready||!r.dead.includes(id)).length:0;}
export function syncMapDeaths(s:GameState){const d=resolveMap(s),r=s.world?.places[d?.id??0]?.mapRoster;if(!d||!r?.ready)return;for(const id of d.required){const u=s.units.find(u=>u.id===r.ids[id]);if(u?.life==='dead'&&!r.dead.includes(id))r.dead.push(id);}if(d.required.every(id=>r.dead.includes(id)))s.exploration!.memory.cleared=true;}
function bindPlace(s:GameState,p:WorldPlace){const d=p.definition;s.node=d.id;s.width=d.width;s.height=d.height;s.tiles=d.tiles;s.goal={...d.exit};s.gate={...d.exit};s.spawns=[];s.waves=[];s.waveState=null;s.totalEnemies=d.enemies.length;s.exploration={definition:d,memory:p.memory,checkpoint:p.checkpoint,visible:[],lastActivity:s.time-10,selectedId:null,visionAt:-1};s.context='explorationIdle';s.phase='battle';s.result=null;}
export function initializeMapWorld(s:GameState){if(!s.world||s.world.places[101])return;const errors=validateMaps(MAPS,MAP_EDGES);if(errors.length)throw Error(errors.join('; '));unloadActions(s);s.units=s.units.filter(u=>isPartyBody(s,u));const p=makePlace(s,MAPS[101]);s.world.places={101:p};s.world.visit={placeId:101,generation:1,active:true,enteredAt:s.time};bindPlace(s,p);let i=0;for(const u of s.units){u.pos={x:5,y:6+i++*.85};u.drawPos={...u.pos};}initializeHomeResident(s);s.inputEpoch=(s.inputEpoch??0)+1;updateVision(s,true);s.notice='芙蕾茜娅的家 · 可独自出门，或点击组队';}
export type TravelTicket={id:number;worldId:string;placeId:number;visit:number;actor:string;control:number;edge:Portal};
export type TravelCandidate={ticket:TravelTicket;place:WorldPlace;positions:Map<Unit,Pos>};
export function validTravel(s:GameState,t:TravelTicket){return !!s.world&&s.world.id===t.worldId&&s.world.visit.active&&s.world.visit.placeId===t.placeId&&s.world.visit.generation===t.visit&&s.controlledBodyId===t.actor&&(s.controlRevision??0)===t.control;}
export function prepareTravel(s:GameState,t:TravelTicket,prepared?:WorldPlace):TravelCandidate{if(!validTravel(s,t))throw Error('旅行请求已失效');const d=resolveMap(s,t.edge.target);if(!d||!d.spawns[t.edge.spawn])throw Error('目的地或到达点不存在');if(t.edge.clear&&(!s.world!.places[t.placeId]?.mapRoster?.ready||mapRemaining(s)>0))throw Error(`尚有${mapRemaining(s)}名敌人`);const p=prepared??s.world!.places[d.id]??makePlace(s,d),spawn=d.spawns[t.edge.spawn],party=s.units.filter(u=>isPartyBody(s,u)&&u.life==='active'),positions=new Map<Unit,Pos>();if(!party.some(u=>u.id===t.actor))throw Error('主控本体无法旅行');const probe={...s,width:d.width,height:d.height,tiles:d.tiles,barricades:[],units:p.unloadedEnemies.concat(p.residents??[])};for(const u of party){const choices=[spawn,...Array.from({length:48},(_,i)=>({x:spawn.x+Math.cos(i*Math.PI/8)*(.85+Math.floor(i/16)*.4),y:spawn.y+Math.sin(i*Math.PI/8)*(.85+Math.floor(i/16)*.4)}))];const pos=choices.find(pos=>terrainFits(probe,pos,radius(u))&&!mapEdges(s,d.id).some(e=>inPortal(pos,e.trigger))&&[...positions].every(([a,p])=>distance(p,pos)>radius(a)+radius(u)+.05)&&probe.units.every(e=>e.life!=='active'||distance(e.pos,pos)>radius(e)+radius(u)+.05));if(!pos)throw Error('到达点没有合法空间');positions.set(u,{...pos});}return {ticket:t,place:p,positions};}
/** All fallible preparation precedes this synchronous publication. Keep the actual party/inventory objects. */
export function commitTravel(s:GameState,c:TravelCandidate){const t=c.ticket;if(!validTravel(s,t))throw Error('旅行请求已过期');const w=s.world!,old=w.places[t.placeId];syncMapDeaths(s);capturePursuers(s,t.edge);clearManualDrops(s);unloadActions(s);old.checkpoint=s.exploration?.checkpoint;old.unloadedEnemies=s.units.filter(u=>u.team==='enemy');old.residents=s.units.filter(u=>!isPartyBody(s,u)&&u.team!=='enemy');old.inactiveAt=s.time;for(const u of old.unloadedEnemies)u.mapClockAt=s.time;const p=c.place;for(const u of p.unloadedEnemies)resumeEnemy(s,u,p.inactiveAt);p.inactiveAt=undefined;
 for(const u of p.unloadedEnemies)if(u.enemyV2)u.enemyV2.generation=s.combatIdentity?.generation??1;s.units=s.units.filter(u=>isPartyBody(s,u)).concat(p.unloadedEnemies,p.residents??[]);p.unloadedEnemies=[];p.residents=[];w.places[t.edge.target]=p;w.visit={placeId:t.edge.target,generation:t.visit+1,active:true,enteredAt:s.time};bindPlace(s,p);for(const [u,pos]of c.positions){u.pos=pos;u.drawPos={...pos};}const d=resolveMap(s,t.edge.target);if(d?.runId){const run=w.mapRuns!.runs[d.runId];run.currentFloor=d.floorIndex!-1;}if(t.edge.finishRun){const oldDef=resolveMap(s,t.placeId);if(oldDef?.runId)w.mapRuns!.runs[oldDef.runId].status='completed';}s.economy.visit++;s.inputEpoch=(s.inputEpoch??0)+1;updateVision(s,true);s.notice=`已到达${p.definition.name}`;
}
/** Detect only swept, deliberate locomotion of the current body. No click/AI/knockback authority. */
export class MapTravel{
 simulatePrepareDelayMs=0;failNextPrepare=false;stage='idle';history:{ticket:number;target:number;stage:string;at:number;diagnosticDelayMs:number}[]=[];
 phase:'idle'|'prepare'|'commit'='idle';error='';ticket?:TravelTicket;private serial=0;private voluntary=false;private previous?:{visit:number;actor:string;pos:Pos};
 constructor(private state:()=>GameState,private resources:(d:MapDefinition,p:WorldPlace,positions:Map<Unit,Pos>)=>Promise<void>,private publish:(d:MapDefinition)=>void,private release:()=>void,private presentation:(stage:string,d:MapDefinition)=>Promise<void>=async()=>{}){}
 observeInput(){const s=this.state(),u=s.units.find(u=>u.id===s.controlledBodyId);this.voluntary=!!u&&u.life==='active'&&ordinaryMotion(u)&&!!(u.direct||s.explorationControl?.moveOrders?.[u.id]?.state==='moving');}
 get busy(){return this.phase!=='idle';}
 sample(){const s=this.state(),w=s.world,u=s.units.find(u=>u.id===s.controlledBodyId);syncMapDeaths(s);if(!w||!resolveMap(s)||!u)return;const prior=this.previous;this.previous={visit:w.visit.generation,actor:u.id,pos:{...u.pos}};if(this.busy||!prior||prior.visit!==w.visit.generation||prior.actor!==u.id||u.life!=='active'||u.forcedMotion||u.crossing||u.skillLanding||u.stagger>0||!ordinaryMotion(u)||!this.voluntary||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0))return;const edge=mapEdges(s).find(e=>portalCrossed(prior.pos,u.pos,e.trigger));if(!edge)return;if(edge.clear&&mapRemaining(s)>0){s.notice=`尚有${mapRemaining(s)}名敌人 · 清场后开放进度门`;return;}void this.request(edge);}

 async request(edge:Portal){
  if(this.busy)return;const s=this.state(),w=s.world;if(!w||w.visit.placeId!==edge.from||!s.controlledBodyId)return;
  if(edge.challengeEntry){const run=ensureChallengeRun(s);edge={...edge,target:run.floors[run.currentFloor],spawn:'entry'};}
  const ticket:TravelTicket={id:++this.serial,worldId:w.id,placeId:w.visit.placeId,visit:w.visit.generation,actor:s.controlledBodyId,control:s.controlRevision??0,edge};
  this.ticket=ticket;this.phase='prepare';if(w.homeResident)w.homeResident.busy='travel';this.error='';
  const mark=(stage:string)=>{this.stage=stage;this.history.push({ticket:ticket.id,target:edge.target,stage,at:performance.now(),diagnosticDelayMs:this.simulatePrepareDelayMs});if(this.history.length>64)this.history.shift();};
  try{
   const c=prepareTravel(s,ticket),definition=resolveMap(s,edge.target)!;
   mark('fade-out');await this.presentation('fade-out',definition);
   mark('resources');if(this.simulatePrepareDelayMs>0)await new Promise(r=>setTimeout(r,Math.min(3000,Math.max(0,this.simulatePrepareDelayMs))));
   if(this.failNextPrepare){this.failNextPrepare=false;throw Error('诊断：一次准备失败');}
   await this.resources(definition,c.place,c.positions);mark('first-frame');await this.presentation('first-frame',definition);
   if(!validTravel(this.state(),ticket))throw Error('旧旅行已失效');
   const ready=prepareTravel(s,ticket,c.place);this.phase='commit';mark('commit');this.release();if(!validTravel(this.state(),ticket))throw Error('提交身份已变化');
   try{this.publish(definition);}catch(error){this.publish(resolveMap(s,ticket.placeId)!);throw error;}
   commitTravel(s,ready);mark('reveal');try{await this.presentation('reveal',definition);mark('fade-in');await this.presentation('fade-in',definition);}catch(error){s.notice='已到达 · 转场表现异常：'+String(error);}
  }catch(error){this.error=String(error);s.notice='旅行失败：'+this.error+' · 离开门口后可重试';mark('failed');await this.presentation('failed',resolveMap(s)!);}
  finally{if(w.homeResident?.busy==='travel')w.homeResident.busy=undefined;this.phase='idle';this.stage='idle';this.previous=undefined;}
 }
}
