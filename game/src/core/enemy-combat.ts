import type {GameState,Pos,Unit} from './types';
import {enemyKitForRole,ENEMY_KITS,ENEMY_ABILITIES,type EnemyKitId,type EnemyReactionId} from './enemy-abilities';
import {startIntent,validIntent} from './attack-intent';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {distance,radius,surface,clearShot} from './spatial';
import {combatStep} from './combat-step';
import {EXPLORE} from './exploration-content';
export type EnemyReactionAction={id:EnemyReactionId;phase:'pending'|'active';startedAt:number;activeAt:number;endsAt:number;from:Pos;to:Pos;layer:number|undefined};
export type EnemyCombatState={kitId:EnemyKitId;abilityReadyAt:number;reactionReadyAt:number;initialOffset:number;armed:boolean;reaction?:EnemyReactionAction;finishedAt?:number};
export const REACTIONS={
 'counter-step':{label:'侧移准备',delay:.15,duration:.18,distance:.55,cooldown:4,window:0},
 'backstep-evade':{label:'后撤准备',delay:.15,duration:.18,distance:.90,cooldown:5,window:.08},
 'front-brace':{label:'正面架防',delay:.15,duration:.65,distance:0,cooldown:6,window:0}
} as const;
export function initialAbilityOffset(id:string,seed:number){let n=seed>>>0;for(const c of id)n=(Math.imul(n^c.charCodeAt(0),16777619))>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return ((n^(n>>>16))>>>0)/4294967295*1.2;}
export function initializeEnemyCombat(s:GameState,u:Unit,identity=u.id){
 const kitId=enemyKitForRole(u.role);u.enemyCombat=isStandaloneExploration(s)&&u.team==='enemy'&&kitId?{kitId,abilityReadyAt:0,reactionReadyAt:0,initialOffset:initialAbilityOffset(identity,s.explorationSeed??s.seed),armed:false}:undefined;
}
const actionable=(u:Unit)=>u.life==='active'&&!u.forcedMotion&&!u.crossing&&u.posture>0&&u.stagger<=0&&u.ready<=0&&!u.statuses.some(st=>st.kind==='stun'&&st.remaining>0);
export function cancelEnemyReaction(u:Unit){if(u.enemyCombat)u.enemyCombat.reaction=undefined;}
export function enemyAvoidanceWindow(s:GameState,u:Unit){const a=u.enemyCombat?.reaction;return isStandaloneExploration(s)&&u.life==='active'&&!!a&&a.id==='backstep-evade'&&a.phase==='active'&&s.time>=a.activeAt&&s.time<a.activeAt+.08-1e-8&&actionable(u);}
export function braceActive(s:GameState,u:Unit){const a=u.enemyCombat?.reaction;return isStandaloneExploration(s)&&!!a&&a.id==='front-brace'&&a.phase==='active'&&s.time>=a.activeAt&&s.time<a.endsAt-1e-8&&actionable(u);}
function safeEndpoint(s:GameState,u:Unit,from:Pos,to:Pos,layer:number|undefined){return combatStep(s,u,from,to,layer,p=>distance(p,u.enemySense?.home??from)<=EXPLORE.leash+1e-7&&!s.units.some(b=>b!==u&&b.life==='active'&&!b.shadowResident&&surface(s,b.pos)?.layer===layer&&distance(b.pos,p)<radius(b)+radius(u)-1e-7));}
/** Reactions only consume committed simulation facts; no input or control queries. */
export function scheduleEnemyReaction(s:GameState,u:Unit,source:Unit){
 const c=u.enemyCombat;if(!isStandaloneExploration(s)||!c||c.reaction||s.time<c.reactionReadyAt-1e-8||!actionable(u)||u.attackIntent||u.attackPending||u.enemyMotion==='return')return false;
 const id=ENEMY_KITS[c.kitId].reaction,cfg=REACTIONS[id],from={...u.pos},layer=surface(s,from)?.layer;
 const dx=from.x-source.pos.x,dy=from.y-source.pos.y,len=Math.hypot(dx,dy);if(len<1e-8||layer===undefined)return false;
 let to={...from};
 if(id!=='front-brace'){
  const directions=id==='backstep-evade'?[{x:dx/len,y:dy/len}]:[{x:-dy/len,y:dx/len},{x:dy/len,y:-dx/len}];
  if(id==='counter-step'&&initialAbilityOffset(u.id,0)>.6)directions.reverse();
  const choices=directions.map(d=>safeEndpoint(s,u,from,{x:from.x+d.x*cfg.distance,y:from.y+d.y*cfg.distance},layer));
  to=choices.sort((a,b)=>distance(from,b)-distance(from,a))[0];
 }
 c.reactionReadyAt=s.time+cfg.cooldown;c.reaction={id,phase:'pending',startedAt:s.time,activeAt:s.time+cfg.delay,endsAt:s.time+cfg.delay+cfg.duration,from,to,layer};
 u.path=[];u.destination=null;u.moveFrom=undefined;u.moveProgress=0;s.stats.enemyReactions=(s.stats.enemyReactions||0)+1;return true;
}
export function reactToEnemyHit(s:GameState,u:Unit,source?:Unit,direct=false,front=false){
 if(!source||source.team!=='ally'||!direct||!u.enemyCombat)return false;
 const id=ENEMY_KITS[u.enemyCombat.kitId].reaction;if(id==='backstep-evade'||id==='front-brace'&&!front)return false;
 return scheduleEnemyReaction(s,u,source);
}
export function tickEnemyReaction(s:GameState,u:Unit):boolean{
 const c=u.enemyCombat,a=c?.reaction;if(!a)return false;
 if(!isStandaloneExploration(s)||s.phase!=='battle'||!actionable(u)||u.enemyMotion==='return'||u.attackIntent){cancelEnemyReaction(u);return false;}
 if(s.time<a.activeAt-1e-8)return true;
 if(a.id!=='front-brace'&&distance(a.from,a.to)<.05){cancelEnemyReaction(u);c!.finishedAt=s.time;return true;}
 a.phase='active';
 if(a.id!=='front-brace'){
  const t=Math.min(1,(s.time-a.activeAt)/REACTIONS[a.id].duration),wanted={x:a.from.x+(a.to.x-a.from.x)*t,y:a.from.y+(a.to.y-a.from.y)*t},next=safeEndpoint(s,u,u.pos,wanted,a.layer);
  u.pos=next;u.drawPos={...next};if(distance(next,wanted)>1e-6){cancelEnemyReaction(u);c!.finishedAt=s.time;return true;}
 }
 if(s.time>=a.endsAt-1e-8){cancelEnemyReaction(u);c!.finishedAt=s.time;}
 return true;
}
/** Choice only: exploration AI retains sensing, pursuit, patrol and return. */
export function chooseEnemyCombat(s:GameState,u:Unit,target?:Unit){
 const c=u.enemyCombat;if(!isStandaloneExploration(s)||!c||!target||!validIntent(s,u)||!actionable(u)||u.attackIntent||c.reaction||c.finishedAt===s.time)return false;
 if(!c.armed){c.armed=true;c.abilityReadyAt=s.time+c.initialOffset;u.attackTimer=Math.max(u.attackTimer,c.initialOffset);}
 if(ENEMY_KITS[c.kitId].reaction==='backstep-evade'&&s.time>=c.reactionReadyAt-1e-8){
  const near=s.units.filter(a=>isPartyBody(s,a)&&a.life==='active'&&!a.shadowResident&&a.ready<=0&&surface(s,a.pos)?.layer===surface(s,u.pos)?.layer&&distance(a.pos,u.pos)<=1.6&&clearShot(s,u.pos,a.pos)).sort((a,b)=>distance(a.pos,u.pos)-distance(b.pos,u.pos)||a.id.localeCompare(b.id))[0];
  if(near&&scheduleEnemyReaction(s,u,near))return true;
 }
 const id=ENEMY_KITS[c.kitId].ability,cfg=ENEMY_ABILITIES[id];
 if(id==='heavy-ground-slam')target=s.units.find(a=>isPartyBody(s,a)&&a.life==='active'&&!a.shadowResident&&a.ready<=0&&surface(s,a.pos)?.layer===surface(s,u.pos)?.layer&&distance(a.pos,u.pos)<=cfg.max&&clearShot(s,u.pos,a.pos))??target;
 const d=distance(u.pos,target.pos);
 if(s.time<c.abilityReadyAt-1e-8||u.attackTimer>0||d<cfg.min-1e-7||d>cfg.max+1e-7||u.role!=='ranged'&&surface(s,u.pos)?.layer!==surface(s,target.pos)?.layer)return false;
 if(!startIntent(s,u,target,id))return false;c.abilityReadyAt=s.time+cfg.cooldown;s.stats.enemyAbilitiesStarted=(s.stats.enemyAbilitiesStarted||0)+1;return true;
}
