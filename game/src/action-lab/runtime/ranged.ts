import {al03 as p} from '../profiles/al03';
import {sample} from '../profiles/sample';
import type {ProjectilePoint} from './projectiles';
/** Deterministic SAMPLE disk sampling, independent of frame timing or rendering. */
export function landingPoints(target:ProjectilePoint,actionId:number):ProjectilePoint[]{
 let seed=(p.sample.seed^actionId)>>>0;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 return p.reference.landingOffsets.map(offset=>{
  const angle=next()*Math.PI*2,r=Math.sqrt(next())*offset;
  let x=Math.max(-sample.arenaHalfWidth+.8,Math.min(sample.arenaHalfWidth-.8,target.x+Math.cos(angle)*r));
  let y=Math.max(-sample.arenaHalfHeight+.8,Math.min(sample.arenaHalfHeight-.8,target.y+Math.sin(angle)*r));
  // Explicit test-block landing policy; no unproved NavMesh or physical bounce.
  if(x>-1.1&&x<1.1&&y>2&&y<2.65)y=y<2.325?1.99:2.66;
  return {x,y};
 });
}
