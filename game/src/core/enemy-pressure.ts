import type {GameState,Unit,Weapon} from './types';
import type {EnemyV2Profile} from './enemy-action';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {damageAfterDefense} from './combat-config';

/** EN-BAL-01 reversible SAMPLE, not final balance or original-game source values. */
export type EnemyPressurePreset='baseline'|'high-pressure-v1';
export const ENEMY_PRESSURE_SAMPLE={healthFraction:1/3,postureFraction:.60} as const;
export function enemyPressureFromSearch(search:string,developer=false):EnemyPressurePreset{
 const requested=new URLSearchParams(search).get('enemyPressure');
 return requested==='baseline'||requested==='high-pressure-v1'?requested:developer?'baseline':'high-pressure-v1';
}
/** Pure, target-aware input estimate. Defense/geometry/HP and posture remain owned by resolveHit. */
export function enemyContactEstimate(s:GameState,target:Unit|undefined,profile:EnemyV2Profile,w:Weapon){
 const baselinePosture=profile.visual==='zombie'?15:profile.visual==='ranged'?10:0;
 const high=s.enemyPressure==='high-pressure-v1'&&s.sessionMode==='exploration'&&isStandaloneExploration(s)&&!!target&&isPartyBody(s,target)&&!!profile.visual&&Number.isFinite(target.maxHp)&&target.maxHp>0&&Number.isFinite(target.maxPosture)&&target.maxPosture>0;
 if(!high)return {preset:'baseline' as const,power:profile.power,postureDamage:baselinePosture};
 const desired=target.maxHp*ENEMY_PRESSURE_SAMPLE.healthFraction;
 // Probe above finite flat armor to invert the existing lawful subtype/resistBreak reduction.
 const flat=Number.isFinite(target.defense?.flat)?Math.max(0,target.defense!.flat):0,probe=desired+flat;
 const armor=Math.max(0,probe-damageAfterDefense(w,target,probe));
 return {preset:'high-pressure-v1' as const,power:desired+armor,postureDamage:target.maxPosture*ENEMY_PRESSURE_SAMPLE.postureFraction};
}
