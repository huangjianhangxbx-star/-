import {equippedSkills} from '../core/skill-slots';
import type {GameState,Pos} from '../core/types';
export type SkillArea={id:string;center:Pos;radius:number;color:number;heading?:number;arc?:number};
export function skillAreas(s:GameState):SkillArea[]{
 if(s.phase!=='battle')return [];const out:SkillArea[]=[];
 for(const u of s.units){if(u.life!=='active'||u.shadowResident)continue;for(const id of equippedSkills(u)){const run=u.skillStates?.[id]?.run;if(!run)continue;
  if(run.spec.id==='sanctuary'){out.push({id:u.id+':field',center:run.origin,radius:run.spec.range,color:0x86c7bd});if(run.spec.tier===2)out.push({id:u.id+':core',center:run.origin,radius:1.6,color:0xd2e4c8});}
  if(run.spec.id==='reap'&&u.cloneOf&&run.virtual)out.push({id:u.id+':virtual',center:run.virtual,radius:.3,color:0xd685bc,heading:run.heading,arc:Math.PI*.85});
 }}
 for(const e of s.skillEffects||[]){if((e.expires||0)<=s.time)continue;
  if(e.kind==='rainTrace')out.push({id:'echo:'+e.id,center:e.center,radius:e.radius||.6,color:0xb5dae2});
  if(e.kind==='scytheTrace')out.push({id:'echo:'+e.id,center:e.center,radius:e.spec.range,color:0xd685bc,heading:e.heading,arc:Math.PI*2/3});
  if(e.kind==='seat')out.push({id:'echo:'+e.id,center:e.center,radius:.9,color:0xc1a8d5});
 }return out;
}
