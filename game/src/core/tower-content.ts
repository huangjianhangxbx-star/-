import {MAP_ROUTES} from './map';
import type {WaveDefinition,BatchDefinition,SpawnEntry} from './types';
const entries=(count:number,wave:number,hpScale:number,damageScale:number):SpawnEntry[]=>Array.from({length:count},(_,i)=>({id:'enemy-'+(i+1),role:wave<2?'melee':i%5===4?'heavy':i%3===2?'ranged':'melee',asset:i%2?'Verlaine_bot':'Dustin',hpScale,damageScale}));
function batch(id:string,route:number,offset:number,count:number,wave:number,hp:number,damage:number):BatchDefinition{return {id,route:MAP_ROUTES[route].map(p=>({...p})),offset,interval:2.5,previewSeconds:5,entries:entries(count,wave,hp,damage)};}
export function towerWaves(node=1):WaveDefinition[]{
 const count=node===3?12:3;
 return Array.from({length:count},(_,i)=>{
  const total=node===3?4+i:[4,6,9][i],parts=i===0?2:3,hp=node===3?.6+i*.065:.45+i*.2,damage=node===3?.5+i*.035:.45+i*.1;
  const amounts=Array.from({length:parts},(_,n)=>Math.floor(total/parts)+(n<total%parts?1:0));
  return {id:(node===3?'long':'short')+'-'+(i+1),batches:amounts.map((n,j)=>batch('batch-'+(j+1),j===2?i%2:j%2,j*7,n,i,hp,damage))};
 });
}
