import map from './dark-dungeon-map.json';
import type {ExplorationDefinition,ExplorationEnemy,ExplorationEncounter,EncounterTier} from './exploration-types';
import type {Pos} from './types';
import {distance} from './spatial';
import {STANDALONE_TUNING as tuning} from './standalone-tuning';

/** Fixed imported architecture; seeded two-family groups use the native enemy brain. */
export function standaloneDefinition(seed:number):ExplorationDefinition{
 const tiles=map.tiles.map(t=>({...t})),entry={...map.entry},exit={...map.exit};
 const points=map.campfires.map((p,i)=>({id:'campfire-'+(i+1),pos:{...p.pos},kind:'campfire' as const,reward:0}));
 let n=seed>>>0;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const shuffle=<T>(items:T[])=>{for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;};
 const safe=[entry,exit,...points.map(p=>p.pos)],enemies:ExplorationEnemy[]=[],encounters:ExplorationEncounter[]=[];
 const open=new Set(tiles.filter(t=>!t.obstacle).map(t=>t.x+','+t.y));
 const safePoint=(p:Pos)=>safe.every(a=>distance(a,p)>=tuning.safeRadius);
 const clear=(a:Pos,b:Pos)=>{const count=Math.max(1,Math.ceil(distance(a,b)/.08));for(let i=0;i<=count;i++){const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(!safePoint(p))return false;for(const dx of [-.18,0,.18])for(const dy of [-.18,0,.18])if(!open.has(Math.round(p.x+dx)+','+Math.round(p.y+dy)))return false;}return true;};
 // Event rooms and seeded empty rooms create breathing space.
 const eligible=map.rooms.map((room,index)=>({room,index})).filter(({room})=>safe.every(p=>distance(room.pos,p)>6));
 const beforeExit=eligible.slice().sort((a,b)=>distance(a.room.pos,exit)-distance(b.room.pos,exit))[0]?.index;
 const chosen=shuffle(eligible.filter(r=>r.index!==beforeExit)).slice(0,11).map(r=>r.index);
 const tiers=new Map<number,EncounterTier>();chosen.forEach((id,i)=>tiers.set(id,i<4?'small':i<10?'normal':'strong'));if(beforeExit!==undefined)tiers.set(beforeExit,'strong');
 for(const [roomIndex,room]of map.rooms.entries()){
  const tier=tiers.get(roomIndex)||'safe',group:ExplorationEncounter={room:roomIndex,center:{...room.pos},tacticalRadius:6.5,name:room.name,tier,enemyIds:[]};encounters.push(group);if(tier==='safe')continue;
  const roles:ExplorationEnemy['role'][]=tier==='small'?['melee','melee','ranged']:tier==='normal'?['melee','melee','ranged',random()<.5?'melee':'ranged']:random()<.5?['melee','melee','melee','ranged']:['melee','melee','ranged','ranged'];
  const candidates=shuffle(tiles.filter(t=>!t.obstacle&&distance(t,room.pos)<=6&&safePoint(t)).map(t=>({x:t.x,y:t.y})));
  for(const [i,role]of roles.entries()){
   if(enemies.length>=tuning.enemyBudget)break;
   const pos=candidates.find(p=>enemies.every(e=>distance(e.pos,p)>=1.8)&&clear(p,p));if(!pos)continue;
   const family=role==='ranged'?'ranged':'zombie';
   const e:ExplorationEnemy={enemyProfileId:family,encounterRoom:roomIndex,encounterId:`room-${roomIndex}-${i}`,directionalProfileId:'neutral',id:`room-${roomIndex}-${i}`,role:family==='ranged'?'ranged':'melee',pos,patrol:[],hp:family==='ranged'?110:220,damage:family==='ranged'?3:5,asset:family};
   enemies.push(e);group.enemyIds.push(e.id);
  }
 }
 return {kind:'standalone',encounters,id:18,name:'暗牢 · 双人探索',victoryCondition:'exit',width:map.width,height:map.height,tiles,entry,exit,enemies,points};
}
