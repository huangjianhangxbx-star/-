import map from './dark-dungeon-map.json';
import type {ExplorationDefinition,ExplorationEnemy} from './exploration-types';
import {distance} from './spatial';

/** Fixed imported architecture; only encounter selection varies with the expedition seed. */
export function standaloneDefinition(seed:number):ExplorationDefinition{
 const tiles=map.tiles.map(t=>({...t})),entry={...map.entry},exit={...map.exit};
 const points=map.campfires.map((p,i)=>({id:'campfire-'+(i+1),pos:{...p.pos},kind:'campfire' as const,reward:0}));
 let n=seed>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const safe=[entry,exit,...points.map(p=>p.pos)],enemies:ExplorationEnemy[]=[];
 const open=new Set(tiles.filter(t=>!t.obstacle).map(t=>t.x+','+t.y));
 const clear=(a:{x:number;y:number},b:{x:number;y:number})=>{const count=Math.ceil(distance(a,b)*4);for(let i=0;i<=count;i++){const t=i/Math.max(1,count);if(!open.has(Math.round(a.x+(b.x-a.x)*t)+','+Math.round(a.y+(b.y-a.y)*t)))return false;}return true;};
 for(const [roomIndex,room]of map.rooms.entries()){
  const candidates=tiles.filter(t=>!t.obstacle&&distance(t,room.pos)<=6&&safe.every(p=>distance(t,p)>6)).map(t=>({x:t.x,y:t.y}));
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  for(let i=0;i<2;i++){
   const pos=candidates.find(p=>enemies.every(e=>distance(e.pos,p)>3));if(!pos)continue;
   const patrolTo=i===1?candidates.find(p=>distance(pos,p)>=2&&distance(pos,p)<=4&&clear(pos,p)):undefined;
   enemies.push({id:`room-${roomIndex}-${i}`,role:roomIndex%5===4&&i===0?'heavy':roomIndex%3===1&&i===0?'ranged':'melee',pos,patrol:patrolTo?[pos,patrolTo]:[],hp:roomIndex%5===4?135:85,damage:6,asset:i?'Verlaine_bot':'Dustin'});
  }
 }
 return {id:18,name:'暗牢 · 独立探索',victoryCondition:'exit',width:map.width,height:map.height,tiles,entry,exit,enemies,points};
}
