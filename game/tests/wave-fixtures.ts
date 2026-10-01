import type {GameState} from '../src/core/types';
import {createWaveRuntime} from '../src/core/waves';
import {MAP_ROUTES} from '../src/core/map';
/** Unrelated combat arenas have no scheduler, not an accidentally completed level. */
export function noWaves(s:GameState){s.waves=[];s.waveState=null;s.totalEnemies=999;}
/** One already-spawned preset; the real engine still waits for its field enemy. */
export function finalWave(s:GameState){
 s.waves=[{id:'fixture',batches:[{id:'last',route:[{x:3,y:4},{x:2,y:4}],offset:0,interval:1,previewSeconds:5,entries:[{id:'enemy',role:'melee',asset:'Dustin',hpScale:1,damageScale:1}]}]}];
 s.waveState={...createWaveRuntime(s.waves),phase:'clearing',spawned:{'fixture/last':1}};s.spawned=s.totalEnemies=1;
}
/** Historical 45-enemy composition under the new clear-gated scheduler only. */
export function historicalTower(s:GameState){
 let serial=0;
 s.waves=[2,3,4,5,6,7,8,10].map((count,i)=>({id:'history-'+i,batches:[{id:'batch',route:MAP_ROUTES[i%2].map(p=>({...p})),offset:0,interval:2,previewSeconds:5,entries:Array.from({length:count},(_,slot)=>{const n=serial++;return {id:'enemy-'+slot,role:n%6===5?'heavy' as const:n%3===2?'ranged' as const:'melee' as const,asset:n%2?'Verlaine_bot' as const:'Dustin' as const,hpScale:.45+i*.15,damageScale:.45+i*.11};})}]}));
 s.waveState=createWaveRuntime(s.waves);s.totalEnemies=45;s.spawned=0;
}
