import {it,expect} from 'vitest';
import {HOME_GOALS,chooseGoal,type GoalScoreContext} from '../src/core/home-goals';
const context=():GoalScoreContext=>({clock:100,schedule:{phase:'daytime',source:'prototype-phase'},nearGarden:false,availableTags:['prepare','dine','read','rest','garden-water','garden'],distances:{},completed:{},cooldowns:{}});
it('offers three data-driven multi-station life goals',()=>{
 expect(HOME_GOALS.map(x=>x.id)).toEqual(['prepare-meal','quiet-reading','garden-care']);
 for(const g of HOME_GOALS)expect(new Set(g.steps.filter(s=>s.kind==='move-to-activity').map(s=>s.tag)).size).toBeGreaterThanOrEqual(2);
});
it('same context produces stable scores and the daytime kitchen story first',()=>{const c=context();expect(chooseGoal(c)).toEqual(chooseGoal(c));expect(chooseGoal(c).goal?.id).toBe('prepare-meal');});
it('phase changes ranking but never steals a valid commitment',()=>{const c=context();c.schedule.phase='night';expect(chooseGoal(c).goal?.id).toBe('quiet-reading');c.commitment='prepare-meal';expect(chooseGoal(c).goal?.id).toBe('prepare-meal');expect(chooseGoal(c).committed).toBe(true);});
it('avoids immediately repeating or selecting a goal during cooldown',()=>{const c=context();c.lastCompleted='prepare-meal';c.cooldowns['quiet-reading']=101;expect(chooseGoal(c).goal?.id).toBe('garden-care');});
it('missing any required station makes a goal unavailable',()=>{const c=context();c.availableTags=[];expect(chooseGoal(c).goal).toBeUndefined();c.commitment='prepare-meal';expect(chooseGoal(c).goal).toBeUndefined();});
it('recent memory, schedule and area have separate readable contributions',()=>{const c=context();c.completed['prepare-meal']=99;c.schedule.phase='morning';c.nearGarden=true;const p=chooseGoal(c);expect(p.goal?.id).toBe('garden-care');expect(p.scores.find(s=>s.id==='prepare-meal')?.parts.recency).toBe(1);expect(p.scores[0].parts.schedule).toBe(22);});
import {homeScheduleContext,setHomePrototypePhase,bindHomeSchedule} from '../src/core/home-schedule';
import {createExplorationEntry} from '../src/core/engine';
it('schedule adapter is explicit, session-local and does not bind goal logic to a UI clock',()=>{const s=createExplorationEntry();expect(homeScheduleContext(s)).toEqual({phase:'daytime',source:'prototype-phase'});bindHomeSchedule(s,()=>({phase:'morning',dayIndex:2,source:'world-adapter'}));expect(homeScheduleContext(s).dayIndex).toBe(2);setHomePrototypePhase(s,'night');expect(homeScheduleContext(s)).toEqual({phase:'night',source:'prototype-phase'});setHomePrototypePhase(s,undefined);expect(homeScheduleContext(s).phase).toBe('morning');});
