import type {GameState,Pos} from './types';
import {isStandaloneExploration} from './exploration-party';
export type DamageFloat={id:number;targetId:string;sourceId:string;castId:number;amount:number;pos:Pos;startedAt:number;lastAt:number};
export function recordDamageFloat(s:GameState,targetId:string,pos:Pos,amount:number,sourceId:string,castId:number){
 if(!isStandaloneExploration(s)||amount<=0)return;
 const list=s.damageFloats??=[],last=list.find(f=>f.targetId===targetId&&f.sourceId===sourceId&&f.castId===castId&&s.time-f.startedAt<=.12+1e-7);
 if(last){last.amount+=amount;last.lastAt=s.time;return;}
 list.push({id:s.nextId++,targetId,sourceId,castId,amount,pos:{...pos},startedAt:s.time,lastAt:s.time});if(list.length>128)list.shift();
}
