import {it,expect} from 'vitest';
import {createExplorationEntry,command,step} from '../src/core/engine';
import {initializeMapWorld} from '../src/core/map-travel';
export function goalHome(){const s=createExplorationEntry();s.sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration',seed:18});command(s,{type:'carry',gold:0,vitality:0});initializeMapWorld(s);return s;}
it('a committed kitchen goal really reaches prepare then dine before completion',()=>{
 const s=goalHome();for(let i=0;i<900;i++)step(s,.05);
 const a:any=s.world!.homeResident!.activity;
 expect(a.history.filter((e:any)=>e.kind==='arrived'&&e.task==='prepare-meal').map((e:any)=>e.anchor)).toEqual(['prepare','dine']);
 expect(a.completed['prepare-meal']).toBeGreaterThan(0);
});
import {holdHomeActivity,advanceHomeActivity} from '../src/core/home-activity';
import {setHomePrototypePhase} from '../src/core/home-schedule';
function until(s:ReturnType<typeof goalHome>,predicate:()=>boolean,seconds=80){for(let i=0;i<seconds*20&&!predicate();i++)step(s,.05);expect(predicate()).toBe(true);}
it('a reading interruption resumes its second move rather than restarting at the bookshelf',()=>{
 const s=goalHome();setHomePrototypePhase(s,'night');until(s,()=>s.world!.homeResident!.activity?.goalId==='quiet-reading'&&s.world!.homeResident!.activity?.stepIndex===2);
 const a=s.world!.homeResident!.activity!,release=holdHomeActivity(s,'ranger','dialogue'),index=a.stepIndex,clock=a.clock;
 setHomePrototypePhase(s,'morning');for(let i=0;i<40;i++)step(s,.05);expect(a.clock).toBe(clock);expect(a.stepIndex).toBe(index);release();step(s,.05);expect(a.goalId).toBe('quiet-reading');expect(a.stepIndex).toBe(index);
 until(s,()=>a.completed['quiet-reading']!==undefined);expect(a.history.filter(e=>e.kind==='arrived').map(e=>e.anchor)).toEqual(['read','rest']);
});
it('an occupied interrupted station can be replaced by an equivalent activity without resetting the goal',()=>{
 const s=goalHome();setHomePrototypePhase(s,'night');until(s,()=>s.world!.homeResident!.activity?.stepIndex===2);
 const a=s.world!.homeResident!.activity!,release=holdHomeActivity(s,'ranger','dialogue');
 s.exploration!.definition={...s.exploration!.definition,sceneLayout:structuredClone(s.exploration!.definition.sceneLayout!)};
 const l=s.exploration!.definition.sceneLayout!,p=l.activities.find(p=>p.id==='rest')!,h=s.units.find(u=>u.id==='hunter')!;
 h.pos={...p.approach};l.activities.push({...p,id:'rest-equivalent',approach:{x:14.6,y:6.2}});
 release();step(s,.05);expect(a.goalId).toBe('quiet-reading');expect(a.stepIndex).toBe(2);expect(a.anchorId).toBe('rest-equivalent');
});
it('failure after a route becomes blocked exits within its retry budget and cools the goal',()=>{
 const s=goalHome();step(s,.05);const a=s.world!.homeResident!.activity!,id=a.goalId!;
 // A wall inserted after selection is a temporary route fixture, not a changed layout revision.
 s.barricades.push({x:9,y:4});const target=s.exploration!.definition.sceneLayout!.activities.find(p=>p.id===a.anchorId)!;
 s.barricades.push({x:Math.round(target.approach.x),y:Math.round(target.approach.y)});
 until(s,()=>a.history.some(e=>e.kind==='failed'&&e.task===id),15);
 expect(a.cooldowns[id]).toBeGreaterThan(a.clock);expect(a.planCount).toBeLessThan(6);
});
it('a long dangerous interruption may abandon the goal without any home movement or reward',()=>{
 const s=goalHome();step(s,.05);const a=s.world!.homeResident!.activity!,r=s.units.find(u=>u.id==='ranger')!;
 const {pos}=r;s.context='explorationBattle';advanceHomeActivity(s,.05);const at=s.time;s.time=at+31;s.context='explorationIdle';advanceHomeActivity(s,.05);
 expect(a.goalId).toBeUndefined();expect(a.reason).toBe('danger-timeout');expect(r.pos).toBe(pos);
});
import {homeActivityDebug} from '../src/core/home-activity';
it('retains goal transitions separately from repeated interruption event chatter',()=>{
 const s=goalHome();step(s,.05);for(let i=0;i<24;i++){const release=holdHomeActivity(s,'ranger','menu-fixture');release();advanceHomeActivity(s,.05);}
 expect(homeActivityDebug(s)?.goalTransitions.some(e=>e.kind==='selected'&&e.task==='prepare-meal')).toBe(true);
});
