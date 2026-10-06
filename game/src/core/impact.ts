import type {GameState,Pos,Unit} from './types';
import {isStandaloneExploration} from './exploration-party';
import {radius,surface,terrainFits,distance} from './spatial';
export type ImpactSpec={distance:number;origin?:Pos;direction?:Pos;wallPin?:boolean;wallPinStagger?:number};
export type ImpactWeight='light'|'medium'|'heavy'|'immovable';
export type ForcedMotion={sourceId?:string;direction:Pos;remaining:number;speed:number;layer:number;wallPin:boolean;wallPinStagger:number};
export const IMPACT={speed:8,sample:.025,pinStagger:1.4,multiplier:{light:1,medium:.75,heavy:.4,immovable:0},basic:{hunter:.4,ranger:.45,fiorre:.3,ines:.75,melee:.45,ranged:.3,heavy:.9,guard:0}} as const;
const WEIGHTS:Record<Unit['role'],ImpactWeight>={hunter:'medium',ranger:'medium',fiorre:'medium',ines:'heavy',melee:'light',ranged:'light',heavy:'heavy',guard:'medium'};
export function impactWeight(u:Unit):ImpactWeight{return u.cloneOf?'immovable':WEIGHTS[u.role];}
export function atomicMotion(u:Unit){return !!(u.crossing||u.skillLanding||Object.values(u.skillStates||{}).some(st=>st.run?.spec.id==='reap'));}
export function interruptOrdinaryMotion(s:GameState,u:Unit){
 if(!atomicMotion(u)){u.path=[];u.destination=null;u.intent=null;u.moveFrom=undefined;u.moveProgress=0;u.afterCross=undefined;}
 u.direct=undefined;u.following=false;u.companionCombat=undefined;
 if(u.evasion?.action){u.evasion.action=undefined;u.evasion.finishedAt=s.time;}
 if(u.ai){u.ai.task=undefined;u.ai.targetId=undefined;u.ai.moving=false;u.ai.handoffPending=undefined;u.ai.command=undefined;u.ai.nextDecision=s.time;}
}
export function impactFeedback(s:GameState,u:Unit,kind:'break'|'wallImpact'|'wallPin'){
 s.stats[kind]=(s.stats[kind]||0)+1;
 s.effects.push({id:s.nextId++,from:{...u.pos},to:{...u.pos},kind,color:kind==='break'?'#ffdb87':kind==='wallPin'?'#ff8d65':'#d5eced',remaining:kind==='wallPin'?.7:.35});
}
/** Own movement channel; does not claim player control or change the classic anchor. */
export function startForcedMotion(s:GameState,u:Unit,spec:ImpactSpec,source?:Unit):boolean{
 if(!isStandaloneExploration(s)||u.life!=='active'||u.forcedMotion||atomicMotion(u)||!Number.isFinite(spec.distance)||spec.distance<=0)return false;
 const travel=spec.distance*IMPACT.multiplier[impactWeight(u)],origin=spec.origin??source?.pos;
 const d=spec.direction??(origin?{x:u.pos.x-origin.x,y:u.pos.y-origin.y}:undefined),len=d?Math.hypot(d.x,d.y):0,layer=surface(s,u.pos)?.layer;
 if(!travel||!d||!Number.isFinite(len)||len<1e-8||layer===undefined)return false;
 interruptOrdinaryMotion(s,u);
 u.forcedMotion={sourceId:source?.id,direction:{x:d.x/len,y:d.y/len},remaining:travel,speed:IMPACT.speed,layer,wallPin:!!spec.wallPin,wallPinStagger:Number.isFinite(spec.wallPinStagger)&&spec.wallPinStagger!>0?spec.wallPinStagger!:IMPACT.pinStagger};return true;
}
export function advanceForcedMotion(s:GameState,u:Unit,dt:number):boolean{
 const m=u.forcedMotion;if(!m)return false;
 if(u.life!=='active'||!isStandaloneExploration(s)){u.forcedMotion=undefined;u.wallPin=undefined;return false;}
 if(!Number.isFinite(dt)||dt<=0)return true;
 let travel=Math.min(m.remaining,m.speed*dt);
 while(travel>1e-8){const step=Math.min(travel,IMPACT.sample),p={x:u.pos.x+m.direction.x*step,y:u.pos.y+m.direction.y*step};
  const layer=surface(s,p)?.layer,terrain=terrainFits(s,p,radius(u),true);
  const layerStop=layer!==undefined&&layer!==m.layer||!terrain&&terrainFits(s,p,radius(u),false);
  const body=s.units.some(b=>b!==u&&b.life==='active'&&!b.shadowResident&&surface(s,b.pos)?.layer===m.layer&&distance(b.pos,p)<radius(b)+radius(u)-1e-7);
  if(!terrain||layerStop||body){u.forcedMotion=undefined;
   if(!body&&!layerStop){impactFeedback(s,u,'wallImpact');if(m.wallPin){u.wallPin={sourceId:m.sourceId,startedAt:s.time};u.stagger=Math.max(u.stagger,m.wallPinStagger);u.posture=0;impactFeedback(s,u,'wallPin');}}
   return true;
  }
  u.pos=p;u.drawPos={...p};m.remaining=Math.max(0,m.remaining-step);travel-=step;
 }
 if(m.remaining<1e-8)u.forcedMotion=undefined;return true;
}
