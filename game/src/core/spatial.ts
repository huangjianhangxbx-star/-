import type {GameState,Pos,Unit,Weapon} from './types';
import {getWorkbenchSample} from './workbench-map';
export const SPACE={radius:.18,gap:.08,engageRadius:1.5,pursuitRadius:3,exploreDeployRadius:3,crossSeconds:.75,layerHeight:.58,eyeHeight:.45,wallHeight:2.5};
export const distance=(a:Pos,b:Pos)=>Math.hypot(a.x-b.x,a.y-b.y);
export const near=(a:Pos,b:Pos)=>distance(a,b)<1e-6;
export const cell=(p:Pos):Pos=>({x:Math.floor(p.x+.5),y:Math.floor(p.y+.5)});
export function surface(s:GameState,p:Pos){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return undefined;const c=cell(p),indexed=s.tiles[c.y*s.width+c.x];return indexed?.x===c.x&&indexed.y===c.y?indexed:s.tiles.find(t=>t.x===c.x&&t.y===c.y);}
export function terrainHeight(s:GameState,p:Pos){const t=surface(s,p);if(!t)return 0;
  if(s.mode==='workbench'&&s.node===1)return getWorkbenchSample().heights[t.y*s.width+t.x];
  return t.obstacle?SPACE.wallHeight:t.layer*SPACE.layerHeight;
}
export const radius=(u?:Unit)=>u?.bodyRadius??SPACE.radius;
function circleTouches(p:Pos,r:number,t:Pos){return Math.hypot(Math.max(0,Math.abs(p.x-t.x)-.5),Math.max(0,Math.abs(p.y-t.y)-.5))<r-1e-7;}
export function terrainFits(s:GameState,p:Pos,r=SPACE.radius,sameLayer=true,ground=false){
 const own=surface(s,p);if(!own||own.obstacle||ground&&own.layer!==0)return false;
 for(let y=Math.floor(p.y-r+.5);y<=Math.floor(p.y+r+.5);y++)for(let x=Math.floor(p.x-r+.5);x<=Math.floor(p.x+r+.5);x++){
  const q={x,y};if(!circleTouches(p,r,q))continue;const t=surface(s,q);
  if(!t||t.obstacle||ground&&t.layer!==0||sameLayer&&t.layer!==own.layer||s.barricades.some(b=>near(b,q)))return false;
 }return true;
}
export function occupiedAt(s:GameState,p:Pos,id='',r=SPACE.radius){const mover=s.units.find(u=>u.id===id);const bodyPass=!!s.exploration&&mover?.team==='ally'&&!mover.cloneOf;return s.units.some(u=>u.id!==id&&!(bodyPass&&!u.cloneOf)&&u.team==='ally'&&['active','downed'].includes(u.life)&&(surface(s,u.pos)?.layer===surface(s,p)?.layer&&distance(u.pos,p)<r+radius(u)+SPACE.gap-1e-7||!!u.destination&&surface(s,u.destination)?.layer===surface(s,p)?.layer&&distance(u.destination,p)<r+radius(u)+SPACE.gap-1e-7));}
export function enemyContact(s:GameState,p:Pos,r=SPACE.radius){return s.units.some(u=>u.team==='enemy'&&u.life==='active'&&surface(s,u.pos)?.layer===surface(s,p)?.layer&&distance(u.pos,p)<r+radius(u)-1e-7);}
export function canStop(s:GameState,p:Pos,u?:Unit){return terrainFits(s,p,radius(u))&&!occupiedAt(s,p,u?.id,radius(u))&&!enemyContact(s,p,radius(u));}
export function canDeployAt(s:GameState,p:Pos,u?:Unit){const h=s.units.find(a=>a.id==='hunter'&&a.life==='active');return canStop(s,p,u)&&(!s.deploymentCells||s.deploymentCells.some(t=>near(t,cell(p))))&&(s.ruleset!=='exploration'||!!h&&distance(h.pos,p)<=SPACE.exploreDeployRadius);}
export function segmentClear(s:GameState,a:Pos,b:Pos,ground=false,avoidEnemies=true,r=SPACE.radius){
 const len=distance(a,b),n=Math.max(1,Math.ceil(len/.08));const la=surface(s,a)?.layer,lb=surface(s,b)?.layer;
 if(la!==lb&&(len>1.01||Math.abs(cell(a).x-cell(b).x)+Math.abs(cell(a).y-cell(b).y)!==1))return false;
 for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!terrainFits(s,p,r,false,ground)||avoidEnemies&&enemyContact(s,p,r))return false;if(la===lb&&surface(s,p)?.layer!==la)return false;}
 return true;
}
/** Line of sight uses the same physical height convention as the scene, from unit centres. */
export function clearShot(s:GameState,a:Pos,b:Pos,view=false){
 const ta=surface(s,a),tb=surface(s,b);if(!ta||!tb||ta.obstacle||tb.obstacle&&!view)return false;
 const dx=b.x-a.x,dy=b.y-a.y,za=terrainHeight(s,a)+SPACE.eyeHeight,zb=terrainHeight(s,b)+SPACE.eyeHeight;
 // Partition at every grid boundary. Sampling the midpoint of each exact interval
 // cannot jump over a thin corner; height is linear, so its minimum is an endpoint.
 const cuts=[0,1];
 for(const [from,delta] of [[a.x,dx],[a.y,dy]])if(Math.abs(delta)>1e-12){
  const end=from+delta;
  for(let boundary=Math.floor(Math.min(from,end)+.5)+.5;boundary<Math.max(from,end);boundary++){
   const f=(boundary-from)/delta;if(f>0&&f<1)cuts.push(f);
  }
 }
 cuts.sort((x,y)=>x-y);
 for(let i=1;i<cuts.length;i++){
  const lo=cuts[i-1],hi=cuts[i];if(hi-lo<1e-12)continue;
  const f=(lo+hi)/2,t=surface(s,{x:a.x+dx*f,y:a.y+dy*f});if(!t)return false;
  if(view&&t===tb)continue;
  const top=terrainHeight(s,{x:a.x+dx*f,y:a.y+dy*f});
  if(top>Math.min(za+(zb-za)*lo,za+(zb-za)*hi)+1e-6)return false;
 }return true;
}
export function inWeaponRange(s:GameState,u:Unit,p:Pos,w:Pick<Weapon,'range'|'remote'>){return distance(u.pos,p)<=w.range+1e-7&&!!surface(s,p)&&!surface(s,p)!.obstacle&&(w.remote||surface(s,u.pos)?.layer===surface(s,p)?.layer)&&clearShot(s,u.pos,p);}
export function unitAt(s:GameState,p:Pos,team:Unit['team']='ally'){return s.units.filter(u=>u.team===team&&['active','downed'].includes(u.life)&&surface(s,u.pos)?.layer===surface(s,p)?.layer&&distance(u.pos,p)<=radius(u)+.18).sort((a,b)=>distance(a.pos,p)-distance(b.pos,p)||a.id.localeCompare(b.id))[0];}
export function faceToward(u:Unit,p:Pos){const dx=p.x-u.pos.x,dy=p.y-u.pos.y;u.heading=Math.atan2(dy,dx);u.facing=Math.abs(dx)>=Math.abs(dy)?dx<0?'west':'east':dy<0?'north':'south';}

