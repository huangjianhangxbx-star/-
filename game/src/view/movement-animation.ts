import type {GameState,Unit} from '../core/types';
import type {SpineAction} from './spine';
import {isStandaloneExploration} from '../core/exploration-party';
import {movementSpeed} from '../core/movement-speed';
/** Run clips follow locomotion modestly; combat animation clocks remain untouched. */
export function movementAnimationRate(s:GameState,u:Unit,action:SpineAction){
 if(action!=='move'||!isStandaloneExploration(s)||u.skillTime>0||u.skillLanding||u.crossing||u.skillStates?.[u.skillId||'']?.run)return 1;
 return Math.max(.75,Math.min(1.35,movementSpeed(s,u)/(u.team==='ally'?1.7:1.275)));
}
