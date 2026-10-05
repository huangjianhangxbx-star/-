import {participates} from './exploration-party';
import {updateExplorationEnemy} from './exploration';
import type {GameState,Unit} from './types';
import {distance,near,inWeaponRange,radius,SPACE} from './spatial';
import {navigate} from './navigation';
function reachable(s:GameState,e:Unit,t:Unit){const w=e.weapons[e.weaponIndex];return !!w&&inWeaponRange(s,e,t.pos,w)||near(e.pos,t.pos)||navigate(s,e.pos,t.pos,true,false,radius(e)).length>0;}
export function participants(s:GameState,_u:Unit){return s.units.filter(a=>a.team==='ally'&&participates(s,a)&&a.life==='active'&&a.ready<=0&&!(s.ruleset==='exploration'&&a.cloneOf));}
export function usedCapacity(s:GameState,id:string){return s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&e.engagement?.targetId===id).reduce((n,e)=>n+(e.engagementCost??(e.role==='heavy'?2:1)),0);}
export function releaseEngagement(s:GameState,e:Unit){if(!e.engagement)return;delete e.engagement;delete e.pursuitTargetId;if(s.exploration){e.enemyMotion='return';e.returnPoint={...e.enemySense!.home};}e.attackPending=undefined;e.path=[];if(s.ruleset!=='exploration'){e.enemyMotion='return';e.returnPoint={...(e.route[e.routeIndex]||s.goal)};}else if(!s.exploration)e.enemyMotion='route';}
export function updateEngagement(s:GameState,e:Unit){
 if(s.exploration){updateExplorationEnemy(s,e);return;}
 if(e.engagement){const t=s.units.find(a=>a.id===e.engagement!.targetId);if(!t||t.life!=='active'||s.ruleset==='exploration'&&t.cloneOf||distance(t.pos,e.engagement.anchor)>SPACE.pursuitRadius||!reachable(s,e,t))releaseEngagement(s,e);}
 if(e.enemyMotion==='return')return;
 if(!e.engagement){const candidates=participants(s,e).filter(a=>!a.crossing&&distance(a.pos,e.pos)<=SPACE.engageRadius&&usedCapacity(s,a.id)+(e.engagementCost??(e.role==='heavy'?2:1))<=a.block).sort((a,b)=>distance(a.pos,e.pos)-distance(b.pos,e.pos)||a.id.localeCompare(b.id));
 const t=candidates.find(a=>reachable(s,e,a));if(t){e.engagement={targetId:t.id,anchor:{...e.pos}};e.enemyMotion='engaged';e.path=[];}}
 e.pursuitTargetId=e.engagement?.targetId;
 if(s.ruleset==='exploration'&&!e.pursuitTargetId){e.pursuitTargetId=participants(s,e).filter(a=>reachable(s,e,a)).sort((a,b)=>distance(a.pos,e.pos)-distance(b.pos,e.pos)||a.id.localeCompare(b.id))[0]?.id;}
}
export function cleanEngagements(s:GameState){for(const e of s.units.filter(a=>a.team==='enemy')){if(e.life!=='active'){delete e.engagement;delete e.pursuitTargetId;}else if(e.engagement&&!s.units.some(a=>a.id===e.engagement!.targetId&&a.life==='active'))releaseEngagement(s,e);}}
/** Output contract for future party state: copies never count as an exploration encounter participant. */
export function encounterParticipant(s:GameState,u:Unit){return u.team==='ally'&&participates(s,u)&&!(s.ruleset==='exploration'&&u.cloneOf);}
