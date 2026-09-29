import type {GameState,Pos} from './types';
import {SPACE,distance,near,segmentClear,terrainFits} from './spatial';
/** Grid-assisted navigation; every edge is swept, and the exact endpoint is retained. */
export function navigate(s:GameState,from:Pos,to:Pos,ground=false,avoidEnemies=true,r=SPACE.radius):Pos[]{const coarse=search(s,from,to,ground,avoidEnemies,1,r);return coarse.length||!avoidEnemies?coarse:search(s,from,to,ground,avoidEnemies,.25,r);}
function search(s:GameState,from:Pos,to:Pos,ground:boolean,avoidEnemies:boolean,stride:number,r:number):Pos[]{
 if(near(from,to)||!terrainFits(s,to,r,true,ground))return [];
 if(segmentClear(s,from,to,ground,avoidEnemies,r))return [{...to}];
 const key=(p:Pos)=>`${p.x},${p.y}`;
 const open=[{p:from,g:0}],prev=new Map<string,Pos>(),cost=new Map([[key(from),0]]),closed=new Set<string>();
 const starts:Pos[]=[];for(let y=Math.round(from.y/stride)-1;y<=Math.round(from.y/stride)+1;y++)for(let x=Math.round(from.x/stride)-1;x<=Math.round(from.x/stride)+1;x++)starts.push({x:x*stride,y:y*stride});
 while(open.length){open.sort((a,b)=>a.g+distance(a.p,to)-b.g-distance(b.p,to));const {p,g}=open.shift()!,k=key(p);if(closed.has(k))continue;closed.add(k);
  if(distance(p,to)<=1.5&&segmentClear(s,p,to,ground,avoidEnemies,r)){
   const out:Pos[]=[{...to}];let q:Pos|undefined=p;while(q&&!near(q,from)){out.unshift({x:q.x,y:q.y});q=prev.get(key(q));}return out;
  }
  const candidates=near(p,from)?starts:[{x:p.x-stride,y:p.y},{x:p.x+stride,y:p.y},{x:p.x,y:p.y-stride},{x:p.x,y:p.y+stride},{x:p.x-stride,y:p.y-stride},{x:p.x+stride,y:p.y-stride},{x:p.x-stride,y:p.y+stride},{x:p.x+stride,y:p.y+stride}];
  for(const n of candidates){const nk=key(n),ng=g+distance(p,n);if(closed.has(nk)||ng>=(cost.get(nk)??Infinity)||!terrainFits(s,n,r,true,ground)||!segmentClear(s,p,n,ground,avoidEnemies,r))continue;cost.set(nk,ng);prev.set(nk,p);open.push({p:{x:n.x,y:n.y},g:ng});}
 }return [];
}
