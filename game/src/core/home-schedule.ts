import type {GameState} from './types';
export type HomeScheduleContext={phase:'morning'|'daytime'|'evening'|'night';dayIndex?:number;source:'world-adapter'|'prototype-phase'};
export type HomeScheduleAdapter=(s:GameState)=>HomeScheduleContext;
const adapters=new WeakMap<GameState,HomeScheduleAdapter>();
const overrides=new WeakMap<GameState,HomeScheduleContext['phase']>();
/** No authoritative world calendar exists yet. Default is explicitly a prototype daytime phase. */
export function homeScheduleContext(s:GameState):HomeScheduleContext {
  const phase=overrides.get(s);return phase?{phase,source:'prototype-phase'}:adapters.get(s)?.(s)??{phase:'daytime',source:'prototype-phase'};
}
export function bindHomeSchedule(s:GameState,adapter:HomeScheduleAdapter){adapters.set(s,adapter);}
export function setHomePrototypePhase(s:GameState,phase:HomeScheduleContext['phase']|undefined){
  if(phase&&!['morning','daytime','evening','night'].includes(phase))return false;
  if(phase)overrides.set(s,phase);else overrides.delete(s);return true;
}
