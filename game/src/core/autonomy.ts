import type {AIState,AITendency,GameState,Pos,Unit} from './types';
import {actionable,clearMotion} from './personal';
import {professionOf} from './skill-catalog';
import {positionVisible} from './visibility';
import {canStop,clearShot,distance,inWeaponRange,radius,segmentClear,surface} from './spatial';
import {navigate} from './navigation';

export const AUTONOMY={towerRadius:1,exploreRadius:2,interval:.35,dwell:.6,improvement:.3,directDistance:.75,commandGrace:.5};
export const TENDENCIES:Record<AITendency,string>={default:'默认',preserve:'保势',rescue:'救护优先',avoid:'规避优先',aggressive:'进攻积极'};
export function aiState(u:Unit):AIState{return u.ai??={intent:'hold',nextDecision:0,movedAt:-10,commandUntil:0,directTravel:0};}
export const activityRadius=(s:GameState)=>s.exploration?AUTONOMY.exploreRadius:AUTONOMY.towerRadius;
export function initializeAnchor(s:GameState,u:Unit){const ai=aiState(u);ai.anchor={...u.pos};ai.nextDecision=s.time;ai.directTravel=0;}
export function clearAutonomy(u:Unit){if(u.ai?.moving&&!u.crossing)clearMotion(u);u.ai=undefined;}
export function selectControl(s:GameState,id:string|null){s.selectedBodyId=id;const u=s.units.find(a=>a.id===id);if(!u)return;const ai=aiState(u);if((ai.moving||u.following)&&!u.crossing){clearMotion(u);ai.moving=false;u.following=false;}ai.intent='player';}
export function claimControl(s:GameState,u:Unit,kind:NonNullable<AIState['command']>){const ai=aiState(u);ai.moving=false;ai.intent='player';ai.command=kind;ai.commandUntil=s.time+AUTONOMY.commandGrace;ai.nextDecision=ai.commandUntil;if(!ai.anchor&&(!s.exploration||s.context==='explorationBattle'))initializeAnchor(s,u);}
export function completePlayerMove(s:GameState,u:Unit){const ai=u.ai;if(ai?.command==='move'&&!u.path.length&&!u.crossing&&!u.skillLanding){initializeAnchor(s,u);ai.command=undefined;ai.commandUntil=s.time+AUTONOMY.commandGrace;}}
export function recordDirectMove(s:GameState,u:Unit,travel:number){const ai=aiState(u);if(ai.command!=='direct')return;ai.directTravel+=travel;if(ai.directTravel+1e-7>=AUTONOMY.directDistance){ai.anchor={...u.pos};ai.directTravel=0;}}
export function playerOwns(s:GameState,u:Unit){const ai=aiState(u);return s.selectedBodyId===u.id||!!u.direct||!!u.recall||!!u.partyTask||!!u.rescueTarget||!!u.loadout||!!u.skillLanding||!!u.crossing||u.ready>0||!!u.attackPending||u.skillTime>0||!!u.skillStates?.[u.skillId||'']?.run||!!(u.path.length&&!ai.moving&&!u.following)||!!(u.destination&&!ai.moving&&!u.following)||s.time<ai.commandUntil;}
export function stopAutonomous(u:Unit){if(u.ai?.moving&&!u.crossing)clearMotion(u);if(u.ai)u.ai.moving=false;}

function danger(s:GameState,u:Unit,p:Pos,enemies:Unit[]){let value=0;for(const e of enemies){const w=e.weapons[e.weaponIndex];if(!w||!clearShot(s,e.pos,p)||!w.remote&&surface(s,p)?.layer!==surface(s,e.pos)?.layer)continue;const near=Math.max(0,w.range+.65-distance(e.pos,p));value+=near*(e.attackPending?.targetId===u.id?2:1);}return value;}
function score(s:GameState,u:Unit,p:Pos,enemies:Unit[],support:Unit[]){
 const ai=aiState(u),w=u.weapons[u.weaponIndex],profession=professionOf(u),t=u.aiTendency||'default';
 const shielding=profession==='shieldguard',healing=profession==='healer'||profession==='cantor';
 const attackWeight=t==='aggressive'?1.6:shielding?.85:1;
 const riskWeight=(t==='avoid'?2.2:t==='preserve'?1+4*(1-u.posture/Math.max(1,u.maxPosture)):.25)*(shielding?.6:1);
 let offense=0;for(const e of enemies){const firing=inWeaponRange(s,{...u,pos:p},e.pos,w);offense=Math.max(offense,firing?4:Math.max(0,2-Math.max(0,distance(p,e.pos)-w.range)*2));}
 let coverage=0;for(const a of support){const need=(1-a.hp/a.maxHp)+(1-a.posture/a.maxPosture)*.35;if(need<=.2)continue;const range=healing?Math.max(w.range,3):1.5;coverage+=need*(distance(p,a.pos)<=range&&clearShot(s,p,a.pos)?3:Math.max(0,range+1-distance(p,a.pos)));}
 const separated=s.units.filter(a=>a!==u&&a.team==='ally'&&a.life==='active'&&surface(s,a.pos)?.layer===surface(s,p)?.layer).reduce((n,a)=>n+Math.max(0,.65-distance(p,a.pos)),0);
 return offense*attackWeight+coverage*(t==='rescue'?2:healing?1.3:shielding?.5:0)-danger(s,u,p,enemies)*riskWeight-distance(p,ai.anchor!)*(shielding?.7:.35)-separated*.6;
}
/** Fixed-rate local decisions; paths and all endpoints stay inside the immutable player anchor. */
export function advanceAutonomy(s:GameState,_dt:number){
 for(const u of s.units){if(u.team!=='ally'||u.cloneOf)continue;
  if(u.life!=='active'||u.shadowResident){clearAutonomy(u);continue;}
  const ai=aiState(u);if(s.exploration&&s.context!=='explorationBattle'){stopAutonomous(u);continue;}
  ai.anchor??={...u.pos};if(!actionable(u)||playerOwns(s,u)){if(ai.moving)stopAutonomous(u);continue;}
  if(s.time+1e-7<ai.nextDecision)continue;ai.nextDecision=s.time+AUTONOMY.interval;
  if(ai.moving&&u.path.length||s.time-ai.movedAt<AUTONOMY.dwell)continue;
  ai.moving=false;ai.command=undefined;
  const r=activityRadius(s),w=u.weapons[u.weaponIndex];if(!w)continue;
  const targets=s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&(!s.exploration||positionVisible(s,e.pos))&&distance(ai.anchor!,e.pos)<=w.range+r+.6).sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)).slice(0,8);
  const support=s.units.filter(a=>a!==u&&a.team==='ally'&&!a.cloneOf&&a.life==='active'&&distance(ai.anchor!,a.pos)<=r+4);
  ai.targetId=targets.slice().sort((a,b)=>distance(u.pos,a.pos)-distance(u.pos,b.pos)||a.id.localeCompare(b.id))[0]?.id;
  const healing=professionOf(u)==='healer'||professionOf(u)==='cantor',needsSupport=(healing||professionOf(u)==='shieldguard'||u.aiTendency==='rescue')&&support.some(a=>a.hp/a.maxHp<.8);
  if((!targets.length&&!needsSupport&&distance(u.pos,ai.anchor)<.12)||targets.some(e=>inWeaponRange(s,u,e.pos,w))&&!needsSupport&&(!u.aiTendency||u.aiTendency==='default'||u.aiTendency==='aggressive')){ai.intent='hold';continue;}
  let candidates:Pos[]=[{...ai.anchor}];
  if(targets.length||needsSupport){for(let ring=.5;ring<=r+1e-7;ring+=.5)for(let i=0;i<16;i++)candidates.push({x:ai.anchor.x+Math.cos(i*Math.PI/8)*ring,y:ai.anchor.y+Math.sin(i*Math.PI/8)*ring});}
  const current=score(s,u,u.pos,targets,support),hasWork=targets.length||needsSupport;
  const scores=new Map<Pos,number>();candidates=candidates.filter(p=>surface(s,p)?.layer===surface(s,ai.anchor!)?.layer&&canStop(s,p,u));for(const p of candidates)scores.set(p,score(s,u,p,targets,support));candidates.sort((a,b)=>hasWork?scores.get(b)!-scores.get(a)!||distance(a,u.pos)-distance(b,u.pos):distance(a,ai.anchor!)-distance(b,ai.anchor!));
  for(const p of candidates){if(distance(p,u.pos)<.12)continue;if(hasWork&&scores.get(p)!<current+AUTONOMY.improvement)break;
   const path=segmentClear(s,u.pos,p,false,true,radius(u))?[{...p}]:navigate(s,u.pos,p,false,true,radius(u));
   if(!path.length||path.some(q=>distance(q,ai.anchor!)>r+1e-7||surface(s,q)?.layer!==surface(s,ai.anchor!)?.layer))continue;
   u.path=path;u.destination={...p};u.intent='move';u.attackPending=undefined;ai.moving=true;ai.movedAt=s.time;ai.intent=!hasWork?'return':u.aiTendency==='preserve'||u.aiTendency==='avoid'?'evade':professionOf(u)==='healer'||u.aiTendency==='rescue'?'support':'approach';break;
  }
  if(!ai.moving)ai.intent='hold';
 }
}
