import type {GameState,Pos,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {clearShot,distance} from './spatial';
import {EXPLORE} from './exploration-content';
import {positionVisible} from './visibility';

/** Runtime identity survives renaming; activity is live engagement, never remembered visibility. */
export function encounterEngaged(s:GameState,e:Unit){
 if(e.enemyV2){const danger=s.enemyRuntime?.entities.some(x=>x.context.actorId===e.id&&x.generation===s.combatIdentity?.generation);return !!danger||e.life==='active'&&e.enemyMotion!=='return'&&!!(e.enemyV2.action||e.enemyV2.brain?.known);}
 if(e.team!=='enemy'||e.life!=='active'||e.enemyMotion==='return')return false;
 const party=(id?:string)=>s.units.some(u=>u.id===id&&isPartyBody(s,u)&&u.life==='active');
 return party(e.pursuitTargetId)||party(e.engagement?.targetId)||party(e.attackIntent?.targetId)||party(e.enemySense?.provoked)&&s.time-(e.enemySense?.provokedAt??-Infinity)<=EXPLORE.lost;
}
export function activeEncounters(s:GameState){
 if(!isStandaloneExploration(s)||s.context!=='explorationBattle')return [];
 const rooms=new Set(s.units.filter(e=>encounterEngaged(s,e)).map(e=>e.encounterRoom));
 return (s.exploration!.definition.encounters||[]).filter(a=>rooms.has(a.room));
}
export function combatDomains(s:GameState){
 const groups=activeEncounters(s);if(!groups.length)return [];
 const bubbles=s.units.filter(u=>u.id===s.controlledBodyId&&isPartyBody(s,u)&&u.life==='active'||encounterEngaged(s,u)&&u.enemySense?.pursuitPolicy==='chaser').map(u=>({center:u.pos,tacticalRadius:3}));
 return [...groups,...bubbles];
}
export function inCombatDomain(s:GameState,p:Pos){return combatDomains(s).some(a=>distance(a.center,p)<=a.tacticalRadius+1e-7);}
/** Autonomous background attacks obey the same encounter boundary as ordinary locomotion. */
export function autonomousTargetAllowed(s:GameState,u:Unit,e:Unit){return !u.companionCombat||activeEncounters(s).some(a=>a.room===e.encounterRoom)&&e.enemyMotion!=='return'&&(positionVisible(s,e.pos)||encounterEngaged(s,e));}
export function pathSafeFromInactiveEncounters(s:GameState,path:Pos[],domain=true){
 const groups=combatDomains(s),rooms=new Set(activeEncounters(s).map(a=>a.room));
 const inactive=s.units.filter(e=>e.team==='enemy'&&e.life==='active'&&e.encounterRoom!==undefined&&!rooms.has(e.encounterRoom));
 for(let j=0;j<path.length;j++){
  const from=path[Math.max(0,j-1)],to=path[j],n=Math.max(1,Math.ceil(distance(from,to)/.15));
  for(let i=0;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n};
   if(domain&&!groups.some(a=>distance(a.center,p)<=a.tacticalRadius+1e-7))return false;
   if(inactive.some(e=>distance(e.pos,p)<=EXPLORE.detect+.2&&clearShot(s,e.pos,p)))return false;
  }
 }
 return true;
}
