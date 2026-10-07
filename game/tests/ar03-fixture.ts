import {arena,projection} from './ar02-fixture';
import {command,step} from '../src/core/engine';
import {requestBasic} from '../src/core/basic-chain';
import {combatTraceSnapshot} from '../src/core/combat-identity';
import {skillState} from '../src/core/progression';
import {createHash} from 'node:crypto';
export const cases=['loop','buffer','expire','target','whiff','move','direct','blink','evade','postmove','switch','ai','order','weight','snipe','reap','poison','dance'] as const;
export function setup(kind:string,seed:number){
 const a=arena(['snipe','reap','poison','dance'].includes(kind)?kind as any:'hunt',seed);const {s,h,p,e}=a;
 h.skillSlots=[null,null,null];p.skillSlots=[null,null,null];e.pos={x:16,y:10};e.drawPos={...e.pos};h.weapons[0].attackPeriod=.8;
 if(['snipe','reap','poison','dance'].includes(kind)){h.skillSlots=[kind as any,null,null];h.skillId=kind as any;if(kind==='poison')h.weapons[0].profession='guard';const st=skillState(h,kind as any);st.enabled=true;st.cd=99;st.counter=kind==='reap'?0:2;}
 if(kind==='weight')h.weapons[0].weight=8;
 if(kind==='ai'||kind==='order'||kind==='evade'){command(s,{type:'controlBody',id:p.id});}
 if(kind==='order'){command(s,{type:'move',id:h.id,to:{x:18,y:10}});}
 return a;
}
export function frame(a:ReturnType<typeof setup>,kind:string,i:number){
 const {s,h,p,e}=a;const actor=kind==='evade'?p:h;
 if(kind==='evade'){p.pos={x:15,y:10};p.drawPos={...p.pos};}
 if(kind==='ai'){if(i===0)requestBasic(s,h,e.pos,99,'companion-ai');}
 else if(kind!=='order'&&[0,16,32,48].includes(i))command(s,{type:'basic',id:actor.id,aim:kind==='whiff'?{x:15,y:9}:e.pos,requestId:i+1});
 if(kind==='buffer'&&i===14)command(s,{type:'basic',id:h.id,aim:e.pos,requestId:90});
 if(kind==='expire'&&i===14){command(s,{type:'basic',id:h.id,aim:e.pos,requestId:90});s.explorationControl!.aim={actorId:h.id,sessionId:900,kind:'path'} as any;}
 if(kind==='expire'&&i===20)s.explorationControl!.aim=undefined;
 if(kind==='target'&&i===15){e.pos={x:30,y:10};e.drawPos={...e.pos};a.f.pos={x:16,y:10};a.f.drawPos={...a.f.pos};}
 if(['move','direct','blink','evade','postmove'].includes(kind)&&i===(kind==='postmove'?6:1)){
  if(kind==='move')command(s,{type:'move',id:h.id,to:{x:15,y:12}});
  if(kind==='direct'||kind==='postmove')command(s,{type:'direct',id:h.id,direction:{x:0,y:1}});
  if(kind==='blink')command(s,{type:'blink',id:h.id,direction:{x:0,y:1}});
  if(kind==='evade')command(s,{type:'evade',id:p.id,direction:{x:0,y:1}});
 }
 if(kind==='switch'&&i===1)command(s,{type:'controlBody',id:p.id});
 if(kind==='switch'&&i===10)command(s,{type:'controlBody',id:h.id});
 if(i===10&&(kind==='postmove'||kind==='direct'))command(s,{type:'direct',id:h.id,direction:null});
 step(s,.05);
}
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const gameplay=(s:ReturnType<typeof setup>['s'])=>hash(projection(s));
// Basic Finish moves from release to recovery completion in the approved runtime contract.
export const identity=(s:ReturnType<typeof setup>['s'])=>hash(JSON.stringify(combatTraceSnapshot(s).filter(r=>!(r.context?.kind==='basic'&&['action-finished','action-cancelled'].includes(r.type))).map(({sequence,...r})=>r)));
