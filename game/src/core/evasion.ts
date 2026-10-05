import {foregroundSkill} from './skill-slots';
import type {CommandResult,GameState,Pos,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {canStop,distance,faceToward,surface} from './spatial';
import {initializeAnchor} from './autonomy';

export const EVASION={charges:2,recharge:3,duration:.18,window:.10,distance:1.2,minDistance:.05,sample:.025} as const;
export const evasionName=(u:Unit)=>u.id==='ranger'?'侧步':u.id==='fiorre'?'滑步':'踏步';
export function resetEvasion(s:GameState,u:Unit){u.evasion=isStandaloneExploration(s)&&isPartyBody(s,u)&&u.id!=='hunter'?{charges:2,progress:0}:undefined;}
export function evasionWindow(s:GameState,u:Unit){return !!u.evasion?.action&&u.life==='active'&&s.time-u.evasion.action.startedAt<EVASION.window-1e-8;}
export function queryEvade(s:GameState,u:Unit):CommandResult {
 if(!isStandaloneExploration(s)||s.phase!=='battle'||!isPartyBody(s,u)||u.id==='hunter'||s.controlledBodyId!==u.id||!u.evasion)return {ok:false,reason:'仅当前操控的同行伙伴可闪避'};
 if(u.life!=='active'||!!u.forcedMotion||u.shadowResident||u.ready>0||u.posture<=0||u.stagger>0||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0))return {ok:false,reason:'当前无法行动'};
 if(u.evasion.action||s.time<(u.evasion.readyAt??0)-1e-8||!!foregroundSkill(u)||Object.values(u.skillStates||{}).some(st=>st.run)||u.skillLanding||u.crossing||u.loadout||u.recall||u.partyTask||u.rescueTarget)return {ok:false,reason:'当前动作尚未结束'};
 return u.evasion.charges>0?{ok:true}:{ok:false,reason:'闪避次数恢复中'};
}
/** Sample the whole segment: endpoint-only checks permit tunnelling through walls. */
function reachable(s:GameState,u:Unit,from:Pos,to:Pos,layer:number|undefined):Pos {
 const n=Math.max(1,Math.ceil(distance(from,to)/EVASION.sample));let last={...from};
 for(let i=1;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n};if(surface(s,p)?.layer!==layer||!canStop(s,p,u))break;last=p;}
 return last;
}
export function evade(s:GameState,u:Unit,direction:Pos):CommandResult {
 const check=queryEvade(s,u);if(!check.ok)return check;
 const len=Math.hypot(direction.x,direction.y);if(!Number.isFinite(len)||len<1e-6)return {ok:false,reason:'需要有效闪避方向'};
 const from={...u.pos},layer=surface(s,from)?.layer,to=reachable(s,u,from,{x:from.x+direction.x/len*EVASION.distance,y:from.y+direction.y/len*EVASION.distance},layer);
 if(distance(from,to)<EVASION.minDistance)return {ok:false,reason:'闪避方向被阻挡'};
 if(u.attackPending)s.stats.windupsCancelledByEvade=(s.stats.windupsCancelledByEvade||0)+1;
 u.attackPending=undefined;u.attackFlash=0;u.direct=undefined;u.path=[];u.destination=null;u.intent=null;u.moveProgress=0;u.moveFrom=undefined;u.following=false;u.afterCross=undefined;
 faceToward(u,to);u.evasion!.charges--;u.evasion!.readyAt=s.time+EVASION.duration;u.evasion!.action={from,to,startedAt:s.time,layer};
 s.stats.evadeUses=(s.stats.evadeUses||0)+1;
 s.effects.push({id:s.nextId++,kind:'evade',sourceId:u.id,from,to:{...from},remaining:EVASION.duration,color:'#84b8b4'});
 return {ok:true};
}
export function tickEvasion(s:GameState,u:Unit,dt:number){
 const e=u.evasion;if(!e)return;
 if(u.life!=='active'||u.shadowResident){e.action=undefined;return;}
 if(e.charges<EVASION.charges){e.progress+=dt;while(e.progress>=EVASION.recharge-1e-8&&e.charges<EVASION.charges){e.progress=Math.max(0,e.progress-EVASION.recharge);e.charges++;}if(e.charges===EVASION.charges)e.progress=0;}
 const a=e.action;if(!a)return;
 if(u.posture<=0||u.stagger>0||u.statuses.some(st=>st.kind==='stun'&&st.remaining>0)){e.action=undefined;e.finishedAt=s.time;initializeAnchor(s,u);return;}
 const t=Math.min(1,(s.time-a.startedAt)/EVASION.duration),to={x:a.from.x+(a.to.x-a.from.x)*t,y:a.from.y+(a.to.y-a.from.y)*t};
 const next=reachable(s,u,u.pos,to,a.layer),blocked=distance(next,to)>1e-6;
 u.pos=next;u.drawPos={...next};
 if(t>=1-1e-8||blocked||u.posture<=0||u.stagger>0||u.statuses.some(st=>st.kind==='stun')){e.action=undefined;e.finishedAt=s.time;initializeAnchor(s,u);}
}
