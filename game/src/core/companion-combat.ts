import {cancelBasicAction} from './basic-runtime';
import {partyTacticFor,advanceTacticRoute,focusPathResult,effectiveTacticWeights,focusTargetLegal,bodyPending} from './party-tactics';
import {queryAbilityDefense} from './defense-query';
import {tacticalAutonomyAllowed} from './exploration-control';
import type {AITendency,GameState,Pos,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {activeEncounters,encounterEngaged,pathSafeFromInactiveEncounters} from './encounter-domain';
import {positionVisible} from './visibility';
import {areaHits,intersectsArea} from './attack-area';
import {canStop,clearShot,distance,radius} from './spatial';
import {navigate,type NavigationBudget} from './navigation';
import {movementSpeed} from './movement-speed';
import {professionOf} from './skill-catalog';
import {foregroundSkill} from './skill-slots';
import {DIRECTIONAL_PROFILES,hitDirection} from './directionality';
import {canHit} from './engine';
import {evadeAI,evadeEndpoint} from './evasion';
import {blink,blinkEndpoint} from './personal';
import {damageAfterDefense} from './combat-config';

export const COMBAT_AI={interval:.20,commit:.35,reaction:.18,regroupFar:5.5,regroupNear:3.5,improvement:.45,horizon:1,margin:.06} as const;
export type CompanionCombatState={intent:'hold'|'engage'|'flank'|'frontline'|'peel'|'retreat'|'evade'|'regroup';targetId?:string;point?:Pos;encounterRooms:number[];nextDecision:number;committedUntil?:number;hazardKey?:string;hazardSeenAt?:number;hazards?:Record<string,number>;rejectReason?:string;moving?:boolean;rangeBand?:[number,number];risk?:number;mobilityEscape?:'walk'|'evade'|'blink'|'unavailable';score?:number};
export const TACTICAL_WEIGHTS:Record<AITendency,{risk:number;flank:number;peel:number;separation:number}>={default:{risk:1,flank:1.5,peel:2,separation:.12},preserve:{risk:2.4,flank:.7,peel:1.8,separation:.2},rescue:{risk:1.4,flank:.7,peel:4,separation:.4},avoid:{risk:3,flank:.4,peel:1,separation:.2},aggressive:{risk:.65,flank:2.4,peel:1.4,separation:.08}};
export function rangeBand(u:Unit):[number,number]{const w=u.weapons[u.weaponIndex];return professionOf(u)==='shieldguard'?[.75,1.2]:w.remote?[w.range*.6,w.range*.85]:[w.range*.7,w.range*.95];}
export function visibleHazards(s:GameState){return s.units.filter(e=>e.life==='active'&&e.team==='enemy'&&e.attackIntent?.kind==='ability'&&e.enemyMotion!=='return'&&(positionVisible(s,e.pos)||encounterEngaged(s,e))).map(e=>e.attackIntent!).filter(a=>a.resolveAt>=s.time-1e-7);}
/** Deterministic urgency estimate, not a guaranteed damage/avoidance oracle. */
export function abilityThreat(s:GameState,u:Unit){
 const hit=visibleHazards(s).filter(h=>areaHits(s,h.area,u));
 const hp=hit.reduce((n,h)=>n+damageAfterDefense(h.weapon,u,h.damage,0),0),posture=hit.reduce((n,h)=>n+h.postureDamage,0);
 const shield=u.statuses.filter(a=>a.kind==='shield'&&a.remaining>0).reduce((n,a)=>n+a.power,0),loss=Math.max(0,hp-shield);
 const broken=posture>0&&(u.posture<=0||posture>=u.posture),lethal=loss>=u.hp;
 const score=loss/Math.max(1,u.maxHp)*4+posture/Math.max(1,u.maxPosture)*1.5+(1-u.hp/u.maxHp)*.5+(1-u.posture/u.maxPosture)*.5+(broken?1:0)+(lethal?2:0)+Math.max(0,hit.length-1)*.35;
 const thresholds={avoid:.35,preserve:broken?.35:.65,aggressive:1.25,default:.8,rescue:.9};
 return {score,threshold:thresholds[u.aiTendency||'default'],broken,lethal};
}
const key=(a:ReturnType<typeof visibleHazards>[number])=>a.sourceId+':'+a.startedAt;
const knownEnemy=(s:GameState,e:Unit)=>positionVisible(s,e.pos)||encounterEngaged(s,e);
export function tacticalTargets(s:GameState){const rooms=new Set(activeEncounters(s).map(a=>a.room));return s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&e.enemyMotion!=='return'&&rooms.has(e.encounterRoom!)&&knownEnemy(s,e));}
export function tacticalRisk(s:GameState,u:Unit,p:Pos){
 const hazard=visibleHazards(s).reduce((n,a)=>n+(intersectsArea(a.area,p,radius(u))&&clearShot(s,s.units.find(e=>e.id===a.sourceId)!.pos,p)?a.phase==='locked'?12:8:0),0);
 const enemies=tacticalTargets(s).reduce((n,e)=>n+(distance(e.pos,p)<=e.weapons[e.weaponIndex].range+radius(u)?e.role==='heavy'?1.5:.7:0),0);
 return (hazard+enemies)*(1+(1-u.hp/u.maxHp)*1.5+(1-u.posture/u.maxPosture));
}
function owned(s:GameState,u:Unit){return u.id===s.controlledBodyId||u.life!=='active'||u.shadowResident||u.ready>0||u.forcedMotion||u.stagger>0||u.posture<=0||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0)||u.direct||u.crossing||u.skillLanding||u.loadout||u.recall||u.partyTask||u.rescueTarget||u.evasion?.action||foregroundSkill(u)||Object.values(u.skillStates||{}).some(st=>st.run)||u.ai?.command==='move'&&(u.path.length||u.destination)||s.time<(u.ai?.commandUntil??0);}
function revoke(u:Unit,a:CompanionCombatState){if(a.moving&&!u.crossing){u.path=[];u.destination=null;if(u.intent==='move')u.intent=null;}a.moving=false;}
function route(s:GameState,u:Unit,p:Pos,regroup=false,budget?:NavigationBudget){if(distance(p,u.pos)<.04)return [];if(!canStop(s,p,u))return null;const path=navigate(s,u.pos,p,false,true,radius(u),budget);return path.length&&pathSafeFromInactiveEncounters(s,[u.pos,...path],!regroup)?path:null;}
function travel(u:Unit,path:Pos[]){let d=0,p=u.pos;for(const q of path){d+=distance(p,q);p=q;}return d;}
function move(s:GameState,u:Unit,a:CompanionCombatState,p:Pos,path:Pos[],intent:CompanionCombatState['intent']){revoke(u,a);a.intent=intent;a.point={...p};a.moving=path.length>0;a.committedUntil=s.time+COMBAT_AI.commit;u.path=path;u.destination=path.length?{...p}:null;u.intent=path.length?'move':null;u.following=false;const t=partyTacticFor(s,u);if(t?.kind==='focus')t.ownedPath=path;}
function candidateScore(s:GameState,u:Unit,e:Unit,p:Pos,direct:Unit,path:Pos[]){
 const w=effectiveTacticWeights(s,u,TACTICAL_WEIGHTS[u.aiTendency||'default']),band=rangeBand(u),d=distance(e.pos,p),rangePenalty=Math.max(band[0]-d,0,d-band[1])*2.5;
 const shield=professionOf(u)==='shieldguard',profile=DIRECTIONAL_PROFILES[e.directionalProfileId||'neutral'],weakBack=!!profile?.back.weakpointId;
 const support=['healer','cantor'].includes(professionOf(u)),flankWeight=support?.2:u.weapons[u.weaponIndex].remote?1:.6;
 const direction=hitDirection(e,p),front=direction==='front',flank=weakBack&&!shield?(direction==='back'?1:direction==='side'?.65:0)*flankWeight:0;
 const threaten=e.pursuitTargetId===direct.id||e.attackIntent?.targetId===direct.id;
 const peel=shield&&threaten?(front?1:.65):0;
 return travel(u,path)/Math.max(.1,movementSpeed(s,u))*.45+rangePenalty+tacticalRisk(s,u,p)*w.risk*(support?1.5:1)+distance(direct.pos,p)*w.separation-flank*w.flank-peel*w.peel;
}
function choosePosition(s:GameState,u:Unit,e:Unit,direct:Unit){
 const band=rangeBand(u),points:Pos[]=[{...u.pos}];for(const r of [band[0],(band[0]+band[1])/2,band[1]])for(let i=0;i<16;i++)points.push({x:e.pos.x+Math.cos(i*Math.PI/8)*r,y:e.pos.y+Math.sin(i*Math.PI/8)*r});
 const budget=partyTacticFor(s,u)?.kind==='focus'?{remaining:128}:undefined;let best:{point:Pos;path:Pos[];score:number}|undefined;
 for(const p of points){if(distance(p,direct.pos)>COMBAT_AI.regroupFar||!canHit(s,{...u,pos:p},e))continue;const path=route(s,u,p,false,budget);if(path===null)continue;const score=candidateScore(s,u,e,p,direct,path);if(!best||score<best.score)best={point:p,path,score};}
 return best;
}
function avoidHazard(s:GameState,u:Unit,a:CompanionCombatState){
 const plan=queryAbilityDefense(s,u,a);if(!plan)return false;
 if(plan.kind==='hold'){a.rejectReason=plan.reason;return plan.reason!=='low-threat';}
 if(plan.kind==='walk'){cancelBasicAction(s,u,'ai-walk');move(s,u,a,plan.point!,plan.path!,'evade');a.mobilityEscape='walk';s.stats.aiWalkingAvoids=(s.stats.aiWalkingAvoids||0)+1;return true;}
 const result=u.id==='hunter'?blink(s,u,plan.direction!):evadeAI(s,u,plan.direction!);
 if(result.ok){a.intent='evade';a.point=plan.point;a.moving=false;a.mobilityEscape=u.id==='hunter'?'blink':'evade';a.committedUntil=s.time+COMBAT_AI.commit;s.stats.aiMobilityEscapes=(s.stats.aiMobilityEscapes||0)+1;return true;}
 a.mobilityEscape='unavailable';a.rejectReason=result.reason;revoke(u,a);a.intent='hold';return true;
}

export function advanceCompanionCombat(s:GameState){
 const direct=s.units.find(u=>u.id===s.controlledBodyId&&isPartyBody(s,u)&&u.life==='active');
 for(const u of s.units){if(!isPartyBody(s,u))continue;
  if(!isStandaloneExploration(s)||s.context!=='explorationBattle'&&partyTacticFor(s,u)?.kind!=='rally'||u.life!=='active'||u.shadowResident){if(u.companionCombat){revoke(u,u.companionCombat);u.companionCombat=undefined;}continue;}
  if(u.id===direct?.id){if(u.companionCombat){revoke(u,u.companionCombat);u.companionCombat=undefined;}continue;}
  const a=u.companionCombat??={intent:'hold',encounterRooms:[],nextDecision:0};a.encounterRooms=activeEncounters(s).map(e=>e.room);a.rangeBand=rangeBand(u);a.risk=tacticalRisk(s,u,u.pos);
  if(!tacticalAutonomyAllowed(s,u)){a.rejectReason='command-reserved';continue;}
  if(bodyPending(u)&&partyTacticFor(s,u)){const t=partyTacticFor(s,u)!;t.execution='pending-body';continue;}
  if(owned(s,u)){if(a.moving&&!u.crossing&&!u.skillLanding)revoke(u,a);a.committedUntil=undefined;continue;}
  if(avoidHazard(s,u,a))continue;
  if(u.attackPending)continue;
  if(advanceTacticRoute(s,u))continue;
  const target=s.units.find(e=>e.id===a.targetId&&tacticalTargets(s).includes(e));
  const routeValid=!a.moving||!u.path.length||pathSafeFromInactiveEncounters(s,[u.pos,...u.path],a.intent!=='regroup');
  if(!routeValid){revoke(u,a);a.committedUntil=undefined;a.rejectReason='路线将越界或引出未交战敌人';}
  if(a.moving&&u.path.length&&(target||a.intent==='regroup')&&s.time<(a.committedUntil??0)&&routeValid)continue;
  if(s.time<a.nextDecision&&routeValid&&(!a.targetId||target))continue;a.nextDecision=s.time+COMBAT_AI.interval;a.rejectReason=undefined;
  if(!direct){revoke(u,a);a.intent='hold';continue;}
  const focus=partyTacticFor(s,u)?.kind==='focus'?partyTacticFor(s,u)?.targetId:undefined;
  if(!focus&&(distance(u.pos,direct.pos)>COMBAT_AI.regroupFar||a.intent==='regroup'&&distance(u.pos,direct.pos)>COMBAT_AI.regroupNear)){
   const points:Pos[]=[];for(let i=0;i<16;i++)points.push({x:direct.pos.x+Math.cos(i*Math.PI/8)*1.3,y:direct.pos.y+Math.sin(i*Math.PI/8)*1.3});points.sort((x,y)=>distance(x,u.pos)-distance(y,u.pos));
   const p=points.find(p=>route(s,u,p,true)!==null);if(p)move(s,u,a,p,route(s,u,p,true)!,'regroup');else{revoke(u,a);a.intent='hold';a.rejectReason='集结路线受阻';}a.targetId=undefined;continue;
  }
  const targets=tacticalTargets(s).filter(e=>!focus||e.id===focus&&focusTargetLegal(s,e.id)).sort((x,y)=>targetRank(u,y,direct)-targetRank(u,x,direct)||x.id.localeCompare(y.id));
  let selected:Unit|undefined,best:ReturnType<typeof choosePosition>;
  for(const e of targets){const position=choosePosition(s,u,e,direct);if(position){selected=e;best=position;break;}}
  if(!selected||!best){focusPathResult(s,u,false);revoke(u,a);a.intent='hold';a.targetId=undefined;a.rejectReason=targets.length?'无安全攻击位':'无活动可知目标';continue;}
  focusPathResult(s,u,true);const current=candidateScore(s,u,selected,u.pos,direct,[]),band=rangeBand(u),d=distance(u.pos,selected.pos),comfortable=d>=band[0]-.1&&d<=band[1]+.1;
  const currentSafe=a.risk!<4&&canHit(s,u,selected)&&comfortable;
  if(currentSafe&&current-best.score<COMBAT_AI.improvement){revoke(u,a);a.intent='engage';a.point={...u.pos};}
  else if(a.moving&&u.path.length&&a.targetId===selected.id&&a.point&&distance(a.point,best.point)<.5){}
  else {const shield=professionOf(u)==='shieldguard',flank=!!DIRECTIONAL_PROFILES[selected.directionalProfileId||'neutral']?.back.weakpointId&&hitDirection(selected,best.point)!=='front';move(s,u,a,best.point,best.path,shield?(selected.pursuitTargetId===direct.id?'peel':'frontline'):a.risk!>3?'retreat':flank?'flank':'engage');}
  a.targetId=selected.id;a.score=best.score;
 }
}
function targetRank(u:Unit,e:Unit,direct:Unit){return Number(e.pursuitTargetId===direct.id||e.attackIntent?.targetId===direct.id)*5+Number(e.pursuitTargetId===u.id)*3+Number(!!e.attackIntent?.enemyAbilityId)*2+Number(e.posture<=0||!!e.wallPin)*2-distance(u.pos,e.pos)*.25;}
