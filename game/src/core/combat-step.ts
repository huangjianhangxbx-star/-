import type {GameState,Pos,Unit} from './types';
import {distance,radius,surface,terrainFits} from './spatial';
/** Shared short-motion sampling. Each channel supplies its own body/limit policy. */
export function combatStep(s:GameState,u:Unit,from:Pos,to:Pos,layer:number|undefined,allowed:(p:Pos)=>boolean):Pos{
 const n=Math.max(1,Math.ceil(distance(from,to)/.025));let last={...from};
 for(let i=1;i<=n;i++){const p={x:from.x+(to.x-from.x)*i/n,y:from.y+(to.y-from.y)*i/n};if(surface(s,p)?.layer!==layer||!terrainFits(s,p,radius(u))||!allowed(p))break;last=p;}
 return last;
}
