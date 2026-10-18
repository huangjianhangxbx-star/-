import type {Direction} from './types';
import type {HomeScheduleContext} from './home-schedule';
export type HomeGoalId='prepare-meal'|'quiet-reading'|'garden-care';
export type HomeRoutineStep =
  | {kind:'move-to-activity';tag:string}
  | {kind:'dwell';seconds:readonly [number,number];pose:'stand-placeholder'}
  | {kind:'face';direction?:Direction};
export type HomeGoalDefinition={id:HomeGoalId;tags:readonly string[];base:number;cooldown:number;steps:readonly HomeRoutineStep[]};
const move=(tag:string):HomeRoutineStep=>({kind:'move-to-activity',tag});
const dwell=(min:number,max:number):HomeRoutineStep=>({kind:'dwell',seconds:[min,max],pose:'stand-placeholder'});
export const HOME_GOALS:readonly HomeGoalDefinition[]=[
  {id:'prepare-meal',tags:['kitchen'],base:10,cooldown:20,steps:[move('prepare'),dwell(5,8),move('dine'),dwell(3,5)]},
  {id:'quiet-reading',tags:['reading'],base:8,cooldown:20,steps:[move('read'),dwell(2,3),move('rest'),dwell(8,12)]},
  {id:'garden-care',tags:['garden'],base:6,cooldown:20,steps:[move('garden-water'),dwell(3,5),move('garden'),dwell(5,8)]},
];
export type GoalScoreContext={clock:number;schedule:HomeScheduleContext;nearGarden:boolean;availableTags:readonly string[];
  distances:Record<string,number>;completed:Partial<Record<HomeGoalId,number>>;cooldowns:Partial<Record<HomeGoalId,number>>;
  lastCompleted?:HomeGoalId;commitment?:HomeGoalId};
export type GoalScore={id:HomeGoalId;eligible:boolean;reason:string;total:number;parts:{base:number;recency:number;repeat:number;proximity:number;schedule:number}};
const preferences:Record<HomeScheduleContext['phase'],Record<HomeGoalId,number>>={
  morning:{'prepare-meal':18,'quiet-reading':0,'garden-care':22},
  daytime:{'prepare-meal':0,'quiet-reading':0,'garden-care':0},
  evening:{'prepare-meal':20,'quiet-reading':10,'garden-care':0},
  night:{'prepare-meal':0,'quiet-reading':30,'garden-care':-10},
};
/** Pure scoring. Navigation and ownership belong to the routine adapter, never this planner. */
export function chooseGoal(ctx:GoalScoreContext){
  const scores:GoalScore[]=HOME_GOALS.map(g=>{
    const moves=g.steps.filter((s):s is Extract<HomeRoutineStep,{kind:'move-to-activity'}>=>s.kind==='move-to-activity');
    const available=moves.every(s=>ctx.availableTags.includes(s.tag));
    const reason=!available?'missing-activity':g.id===ctx.lastCompleted?'immediate-repeat':(ctx.cooldowns[g.id]??0)>ctx.clock?'cooldown':'eligible';
    const parts={base:g.base,recency:ctx.completed[g.id]===undefined?30:Math.min(60,Math.max(0,ctx.clock-ctx.completed[g.id]!)),repeat:g.id===ctx.lastCompleted?-100:0,
      proximity:(ctx.nearGarden===g.tags.includes('garden')?3:0)-Math.min(3,(ctx.distances[moves[0].tag]??20)*.15),schedule:preferences[ctx.schedule.phase][g.id]};
    return {id:g.id,eligible:reason==='eligible',reason,total:Object.values(parts).reduce((a,b)=>a+b,0),parts};
  }).sort((a,b)=>b.total-a.total||a.id.localeCompare(b.id));
  const committed=ctx.commitment&&scores.find(s=>s.id===ctx.commitment&&s.reason!=='missing-activity');
  return {goal:committed?HOME_GOALS.find(g=>g.id===ctx.commitment):HOME_GOALS.find(g=>g.id===scores.find(s=>s.eligible)?.id),committed:!!committed,scores};
}
