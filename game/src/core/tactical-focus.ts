import type {GameState} from './types';
import {isStandaloneExploration} from './exploration-party';
export type TacticalFocus={elapsed:number};
/** Real-time clock is advanced by the frame host, never by step(simulationDt). */
export function advanceTacticalFocus(s:GameState,realDt:number,suspended=false){
 if(!isStandaloneExploration(s)||s.phase!=='battle'){s.tacticalFocus=undefined;return;}
 if(s.tacticalFocus&&!suspended){s.tacticalFocus.elapsed+=Math.max(0,realDt);if(s.tacticalFocus.elapsed>=1.5)s.tacticalFocus=undefined;}
}
export function focusTimeScale(s:GameState){const t=Math.min(1,(s.tacticalFocus?.elapsed??1.5)/1.5);return .2+.8*t*t*(3-2*t);}
