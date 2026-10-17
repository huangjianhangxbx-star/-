import type {GameState,Pos,Unit} from './types';
import type {Portal} from './map-definitions';
import {navigate} from './navigation';
import {distance,radius,terrainFits} from './spatial';
import {instanceKey,resumeEnemy} from './map-place';
import {resolveMap,mapEdges} from './map-runs';
export type PursuerTask={enemyId:string;from:number;target:number;targetId:string;edgeId:string;worldId:string;path:Pos[];index:number;status:'walking'|'waiting'|'arrived'|'cancelled';reason?:string;capturedAt:number;arrivedAt?:number};
/** Capture observed pursuit before unloadActions clears old-space actions/targets. */
export function capturePursuers(s:GameState,edge:Portal){
 const w=s.world!;if(edge.enemyPolicy!=='eligiblePursuit')return [];
 const tasks=w.pursuers??=[],created:PursuerTask[]=[];
 for(const u of s.units.filter(u=>u.team==='enemy'&&u.life==='active'&&u.enemyV2)){
  const known=u.enemyV2!.brain?.known,target=s.units.find(t=>t.id===u.pursuitTargetId&&t.team==='ally'&&t.life==='active');
  if(!target||!known||known.id!==target.id||s.time-known.at>3||tasks.some(t=>t.enemyId===u.id&&['walking','waiting'].includes(t.status)))continue;
  const path=distance(u.pos,edge.trigger)<.05?[{...edge.trigger}]:navigate(s,u.pos,edge.trigger,false,false,radius(u),{remaining:1200});
  if(!path.length)continue;
  const task:PursuerTask={enemyId:u.id,from:edge.from,target:edge.target,targetId:target.id,edgeId:edge.id,worldId:w.id,path,index:0,status:'walking',capturedAt:s.time};tasks.push(task);created.push(task);if(created.length>=3)break;
 }
 // Preserve bounded diagnostics, never prune live ownership work.
 if(tasks.length>48)w.pursuers=tasks.filter(t=>['walking','waiting'].includes(t.status)).concat(tasks.filter(t=>!['walking','waiting'].includes(t.status)).slice(-32));
 return created;
}
export function tickPursuers(s:GameState,dt:number,resourcesReady:(u:Unit)=>boolean){
 if(dt<=0||!s.world?.visit.active||s.phase!=='battle')return;
 const w=s.world;
 for(const task of w.pursuers??[]){
  if(!['walking','waiting'].includes(task.status))continue;
  const source=w.places[task.from],u=source?.unloadedEnemies.find(e=>e.id===task.enemyId),target=s.units.find(a=>a.id===task.targetId&&a.life==='active');
  const cancel=(reason:string)=>{task.status='cancelled';task.reason=reason;};
  if(w.id!==task.worldId){cancel('world expired');continue;}if(w.visit.placeId===task.from){cancel('source active: normal AI owns movement');continue;}
  if(w.visit.placeId!==task.target||!target){cancel('target left adjacent relation');continue;}
  if(!u||u.life!=='active'){cancel('source actor missing or dead');continue;}
  const reverse=mapEdges(s,task.target).find(e=>e.target===task.from&&e.enemyPolicy==='eligiblePursuit'),definition=resolveMap(s,task.target);
  if(!reverse||!definition){cancel('door no longer permits enemies');continue;}
  // reverse.spawn belongs to the other end; arrival is inside this end's own trigger.
  const arrival={x:reverse.trigger.x+(reverse.trigger.x>definition.width/2?-1.2:1.2),y:reverse.trigger.y};
  if(distance(target.pos,arrival)>12){cancel('target outside doorway relation');continue;}
  if(u.stagger>0){u.stagger=Math.max(0,u.stagger-dt);continue;}
  let budget=u.speed*dt;
  while(budget>0&&task.index<task.path.length){const p=task.path[task.index],d=distance(u.pos,p),step=Math.min(d,budget);if(d>0)u.pos={x:u.pos.x+(p.x-u.pos.x)*step/d,y:u.pos.y+(p.y-u.pos.y)*step/d};budget-=step;if(d<=step+.001)task.index++;else break;}
  if(task.index<task.path.length)continue;
  task.status='waiting';
  if(!resourcesReady(u)){task.reason='waiting for actor resource';continue;}
  const choices=[arrival,...Array.from({length:16},(_,i)=>({x:arrival.x+Math.cos(i*Math.PI/8)*.9,y:arrival.y+Math.sin(i*Math.PI/8)*.9}))];
  const pos=choices.find(p=>terrainFits(s,p,radius(u))&&!mapEdges(s).some(e=>Math.abs(p.x-e.trigger.x)<e.trigger.width/2&&Math.abs(p.y-e.trigger.y)<e.trigger.height/2)&&s.units.every(other=>other.life!=='active'||distance(p,other.pos)>radius(u)+radius(other)+.08));
  if(!pos){task.reason='arrival blocked';continue;}
  // All checks precede this synchronous ownership move; no new actor, reward or visit is created.
  source.unloadedEnemies=source.unloadedEnemies.filter(e=>e!==u);resumeEnemy(s,u,source.inactiveAt);u.mapOwnerInstance=instanceKey(s,task.target);u.pos={...pos};u.drawPos={...pos};u.path=[];u.destination=null;u.pursuitTargetId=target.id;
  const st=u.enemyV2!;st.generation=s.combatIdentity?.generation??1;st.brain={home:{...pos},decision:'approach',repathAt:s.time,chosenAt:s.time,known:{id:target.id,point:{...target.pos},at:s.time}};
  s.units.push(u);task.status='arrived';task.reason=undefined;task.arrivedAt=s.time;
 }
}
