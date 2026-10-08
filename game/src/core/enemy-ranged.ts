import type {GameState,Pos,Unit} from './types';
import type {EnemyRelease} from './enemy-action';
import {allocateRuntimeAction} from './combat-identity';
import {clipCapsule} from './attack-area';
import {terrainFits} from './spatial';
/** AL03 SOURCE 1+2 topology / .1 interval; SAMPLE seeded disk and main-terrain projection. */
export function rangedTransports(s:GameState,owner:Unit,r:EnemyRelease){
 const children=[2,3].map(n=>allocateRuntimeAction(s,owner,{executedAbilityId:r.profile.id+n},r.context,r.attack.releasedAt));
 let seed=(3107^r.context.actionId)>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return [.4,2,2].map((offset,i)=>{const angle=random()*Math.PI*2,range=Math.sqrt(random())*offset,candidate={x:r.point.x+Math.cos(angle)*range,y:r.point.y+Math.sin(angle)*range};
  const projected=clipCapsule(s,{kind:'capsule',from:r.point,to:candidate,radius:0}).to;
  const swept=clipCapsule(s,{kind:'capsule',from:r.origin,to:projected,radius:0}).to;
  const to:Pos=terrainFits(s,swept)?swept:{...r.point};
  const at=r.attack.releasedAt+(i===2?.1:0),context=allocateRuntimeAction(s,owner,{executedAbilityId:r.profile.id+'-transport'},children[i===0?0:1],at);
  return {to,at,context};
 });
}
