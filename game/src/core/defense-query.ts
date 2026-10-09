import type {GameState,Pos,Unit} from './types';
import {COMBAT_AI,visibleHazards,abilityThreat,tacticalTargets} from './companion-combat';
import {areaHits,intersectsArea} from './attack-area';
import {canStop,clearShot,distance,radius} from './spatial';
import {movementSpeed} from './movement-speed';
import {navigate} from './navigation';
import {pathSafeFromInactiveEncounters} from './encounter-domain';
import {blinkEndpoint} from './personal';
import {evadeEndpoint} from './evasion';
export type DefenseObservation={hazards?:Record<string,number>;hazardKey?:string;hazardSeenAt?:number};
export type DefensePlan={kind:'hold'|'walk'|'mobility';point?:Pos;path?:Pos[];direction?:Pos;reason:string};
function pathLength(u:Unit,path:Pos[]){let p=u.pos,total=0;for(const q of path){total+=distance(p,q);p=q;}return total;}
export function defenseRoute(s:GameState,u:Unit,p:Pos,maxLength=Infinity){if(!canStop(s,p,u))return null;const path=navigate(s,u.pos,p,false,true,radius(u));return path.length&&pathLength(u,path)<=maxLength&&pathSafeFromInactiveEncounters(s,[u.pos,...path])?path:null;}
/** Pure candidate evaluation; observation timestamps are the only state written. */
export function queryAbilityDefense(s:GameState,u:Unit,o:DefenseObservation,maxWalk=Infinity):DefensePlan|null{
 const hazards=visibleHazards(s),key=(h:typeof hazards[number])=>h.observationKey??h.sourceId+':'+h.startedAt;o.hazards??={};const live=new Set(hazards.map(key));for(const k in o.hazards)if(!live.has(k))delete o.hazards[k];for(const h of hazards)o.hazards[key(h)]??=s.time;
 const danger=hazards.filter(h=>areaHits(s,h.area,u)).sort((a,b)=>a.resolveAt-b.resolveAt)[0];if(!danger){o.hazardKey=undefined;o.hazardSeenAt=undefined;return null;}
 o.hazardKey=key(danger);o.hazardSeenAt=o.hazards[o.hazardKey];if(s.time-o.hazardSeenAt<COMBAT_AI.reaction-1e-7)return {kind:'hold',reason:'reaction'};
 const safe=(p:Pos)=>!hazards.some(h=>{if(h.observationKey)return areaHits(s,h.area,{...u,pos:p});const e=s.units.find(e=>e.id===h.sourceId);return e&&intersectsArea(h.area,p,radius(u))&&clearShot(s,e.pos,p);});
 const duration=(path:Pos[])=>{let p=u.pos,d=0;for(const q of path){d+=distance(p,q);p=q;}return d/Math.max(.1,movementSpeed(s,u));};
 if(u.path.length&&safe(u.path.at(-1)!)&&duration(u.path)<danger.resolveAt-s.time-COMBAT_AI.margin)return {kind:'hold',reason:'route-already-safe'};
 const options:{point:Pos;path:Pos[];time:number}[]=[];
 for(const r of [.5,1,1.5])for(let i=0;i<24;i++){const point={x:u.pos.x+Math.cos(i*Math.PI/12)*r,y:u.pos.y+Math.sin(i*Math.PI/12)*r};if(!safe(point))continue;const path=defenseRoute(s,u,point,maxWalk);if(path)options.push({point,path,time:duration(path)});}
 options.sort((a,b)=>a.time-b.time);const walk=options.find(x=>x.time<danger.resolveAt-s.time-COMBAT_AI.margin);if(walk)return {kind:'walk',...walk,reason:'ability'};
 const threat=abilityThreat(s,u);if(threat.score<threat.threshold&&!threat.lethal)return {kind:'hold',reason:'low-threat'};
 for(let i=0;i<24;i++){const direction={x:Math.cos(i*Math.PI/12),y:Math.sin(i*Math.PI/12)},point=u.id==='hunter'?blinkEndpoint(s,u,direction):evadeEndpoint(s,u,direction);if(safe(point)&&canStop(s,point,u)&&pathSafeFromInactiveEncounters(s,[u.pos,point]))return {kind:'mobility',point,direction,reason:'ability'};}
 return {kind:'hold',reason:'no-safe-route'};
}
/** Observed proximity only: no hidden Basic lock or Release timestamp. */
export function queryProximityDefense(s:GameState,u:Unit):DefensePlan|null{
 const enemies=tacticalTargets(s).filter(e=>e.ready<=0&&e.stagger<=0&&!e.statuses.some(st=>st.kind==='stun'&&st.remaining>0)&&!e.weapons[e.weaponIndex].remote&&distance(e.pos,u.pos)<e.weapons[e.weaponIndex].range+radius(u)+.25&&clearShot(s,e.pos,u.pos));if(!enemies.length)return null;
 const score=(p:Pos)=>Math.min(...enemies.map(e=>distance(e.pos,p)));const current=score(u.pos);let best:DefensePlan|null=null,gain=.45;
 for(let i=0;i<24;i++){const point={x:u.pos.x+Math.cos(i*Math.PI/12)*.7,y:u.pos.y+Math.sin(i*Math.PI/12)*.7};const improvement=score(point)-current;if(improvement<gain)continue;const path=defenseRoute(s,u,point,1.4);if(!path)continue;gain=improvement;best={kind:'walk',point,path,reason:'visible-proximity'};}return best;
}
