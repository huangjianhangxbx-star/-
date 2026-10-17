import {MAPS,MAP_EDGES,type MapDefinition,type Portal} from './map-definitions';
import {makePlace} from './map-place';
import type {GameState,Pos} from './types';
export type ChallengeRun={id:string;seed:number;counts:number[];floors:number[];currentFloor:number;status:'active'|'completed';returnAnchor:{placeId:number;pos:Pos;spawn:string}};
export type MapRuns={serial:number;activeId?:string;runs:Record<string,ChallengeRun>};
export function resolveMap(s:GameState,id=s.world?.visit.placeId??0):MapDefinition|undefined{
 const d=s.world?.places[id]?.definition;return d&&'purpose'in d?d as MapDefinition:MAPS[id];
}
function rng(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function ensureChallengeRun(s:GameState,seed?:number):ChallengeRun{
 const w=s.world!;const all=w.mapRuns??={serial:0,runs:{}};const old=all.activeId&&all.runs[all.activeId];if(old&&old.status==='active')return old;
 const serial=all.serial+1,runSeed=(seed??crypto.getRandomValues(new Uint32Array(1))[0])>>>0,random=rng(runSeed),counts=[2,3,4,5,6];
 for(let i=4;i>0;i--){const j=Math.floor(random()*(i+1));[counts[i],counts[j]]=[counts[j],counts[i]];}
 const id=`${w.id}:run:${serial}`,floors=counts.map((_,i)=>1000+serial*10+i),places:Record<number,ReturnType<typeof makePlace>>={};
 for(let i=0;i<5;i++){
  const template=MAPS[102],candidates=[{x:10,y:4},{x:14,y:4},{x:18,y:4},{x:10,y:11},{x:14,y:11},{x:18,y:11},{x:18,y:7},{x:10,y:7}];
  for(let j=candidates.length-1;j>0;j--){const k=Math.floor(random()*(j+1));[candidates[j],candidates[k]]=[candidates[k],candidates[j]];}
  const d:MapDefinition={...template,id:floors[i],name:`回廊挑战 · 第${i+1}层`,templateId:'challenge-room',space:`${id}:floor:${i+1}`,runId:id,floorIndex:i+1,purpose:'combatInstance',sections:[{id:`floor-${i+1}`,origin:{x:0,y:0},width:24,height:16}],spawns:{entry:{x:3,y:8}},entry:{x:3,y:8},exit:{x:21,y:8},enemies:candidates.slice(0,counts[i]).map((pos,j)=>{const archer=random()<.3;return {id:`spawn-${j}`,enemyProfileId:archer?'ranged':'zombie',role:archer?'ranged':'melee',pos,hp:archer?180:220,damage:archer?14:18,asset:archer?'Dustin':'Livia'};}),required:[]};
  d.required=d.enemies.map(e=>e.id);places[d.id]=makePlace(s,d);
 }
 // Publish all five plans only after complete generation; failed construction cannot mean empty/cleared.
 const run:ChallengeRun={id,seed:runSeed,counts,floors,currentFloor:0,status:'active',returnAnchor:{placeId:102,pos:{x:19,y:12},spawn:'from-challenge'}};
 Object.assign(w.places,places);all.serial=serial;all.activeId=id;all.runs[id]=run;return run;
}
export function mapEdges(s:GameState,id=s.world?.visit.placeId??0):Portal[]{
 const d=resolveMap(s,id);if(!d)return [];
 if(d.purpose==='combatInstance'){
  const run=s.world?.mapRuns?.runs[d.runId!];if(!run)return [];const last=d.floorIndex===5;
  return [{id:`${run.id}:exit:${d.floorIndex}`,mode:'portal',from:id,target:last?run.returnAnchor.placeId:run.floors[d.floorIndex!],spawn:last?run.returnAnchor.spawn:'entry',trigger:{...d.exit,width:1,height:1},clear:true,enemyPolicy:'denied',finishRun:last}];
 }
 const edges=MAP_EDGES.filter(e=>e.from===id);return id===102?[...edges,{id:'enter-challenge',mode:'portal',from:102,target:-1,spawn:'entry',trigger:{x:20,y:12,width:1,height:1},challengeEntry:true,enemyPolicy:'denied'}]:edges;
}
