import type {GameState,Pos,Unit} from './types';
import {canStop,clearShot,distance,radius,segmentClear,surface,terrainFits} from './spatial';
import {navigate} from './navigation';
import {autonomousTargetAllowed,pathSafeFromInactiveEncounters} from './encounter-domain';
export const REAP_SPACE={length:3,minLength:.4,speed:6,pause:.08,width:.28,sample:.04,returnSearch:1.5};
export function segmentDistance(p:Pos,a:Pos,b:Pos){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1e-9,dx*dx+dy*dy)));return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
export function planReapPath(s:GameState,u:Unit):{end:Pos;heading:number;targets:string[]}|undefined{
 const layer=surface(s,u.pos)?.layer,targets=s.units.filter(t=>t.team!==u.team&&t.life==='active'&&autonomousTargetAllowed(s,u,t)&&surface(s,t.pos)?.layer===layer&&distance(t.pos,u.pos)<=REAP_SPACE.length+radius(t)+REAP_SPACE.width&&clearShot(s,u.pos,t.pos));
 const angles=[...targets.map(t=>Math.atan2(t.pos.y-u.pos.y,t.pos.x-u.pos.x)),...Array.from({length:16},(_,i)=>i*Math.PI/8)];
 const choices:({end:Pos;heading:number;targets:string[];length:number})[]=[];
 for(const heading of [...new Set(angles)]){let end={...u.pos};
  for(let d=REAP_SPACE.sample;d<=REAP_SPACE.length+1e-8;d+=REAP_SPACE.sample){const p={x:u.pos.x+Math.cos(heading)*d,y:u.pos.y+Math.sin(heading)*d};if(surface(s,p)?.layer!==layer||!terrainFits(s,p,radius(u))||!segmentClear(s,end,p,false,false,radius(u)))break;end=p;}
  const length=distance(u.pos,end);if(length<REAP_SPACE.minLength-1e-8||u.companionCombat&&!pathSafeFromInactiveEncounters(s,[u.pos,end]))continue;
  const hit=targets.filter(t=>segmentDistance(t.pos,u.pos,end)<=radius(t)+REAP_SPACE.width).map(t=>t.id);if(hit.length)choices.push({end,heading,targets:hit,length});
 }
 return choices.sort((a,b)=>b.targets.length-a.targets.length||(Math.abs(b.length-a.length)>1e-6?b.length-a.length:0)||a.heading-b.heading)[0];
}
export function reapReturnPath(s:GameState,u:Unit,from:Pos,origin:Pos):Pos[]|null{
 const layer=surface(s,from)?.layer,local={...s,tiles:s.tiles.map(t=>t.layer===layer?t:{...t,obstacle:true})};
 const candidates=[origin];for(let d=.1;d<=REAP_SPACE.returnSearch+1e-8;d+=.1)for(let i=0;i<24;i++)candidates.push({x:origin.x+Math.cos(i*Math.PI/12)*d,y:origin.y+Math.sin(i*Math.PI/12)*d});
 for(const p of candidates){if(!canStop(local,p,u))continue;if(distance(from,p)<1e-7)return [];
  const path=navigate(local,from,p,false,false,radius(u));if(path.length)return path;
 }return null;
}
