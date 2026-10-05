import type {GameState,Pos,Unit,Direction} from './types';
import {isStandaloneExploration} from './exploration-party';
export type HitDirection='front'|'side'|'back';
export type DirectionalZoneRule={healthScale?:number;postureScale?:number;weakpointId?:string};
export type DirectionalProfile={front:DirectionalZoneRule;side:DirectionalZoneRule;back:DirectionalZoneRule};
export const DIRECTION_EPSILON=1e-7;
export const DIRECTIONAL_PROFILES:Readonly<Record<string,DirectionalProfile>>={
 neutral:{front:{},side:{},back:{}},
 'heavy-rear-core':{front:{healthScale:.65,postureScale:.70},side:{},back:{healthScale:1.25,postureScale:1.35,weakpointId:'rear-core'}}
};
const FACING:Record<Direction,number>={east:0,south:Math.PI/2,west:Math.PI,north:-Math.PI/2};
export function targetHeading(target:Pick<Unit,'heading'|'facing'>){return Number.isFinite(target.heading)?target.heading!:FACING[target.facing];}
function validOrigin(target:Pick<Unit,'pos'>,origin?:Pos){return !!origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)&&Math.hypot(origin.x-target.pos.x,origin.y-target.pos.y)>DIRECTION_EPSILON;}
export function hitDirection(target:Pick<Unit,'pos'|'heading'|'facing'>,hitOrigin:Pos):HitDirection {
 if(!validOrigin(target,hitOrigin))return 'side';
 const dx=hitOrigin.x-target.pos.x,dy=hitOrigin.y-target.pos.y,heading=targetHeading(target);
 const delta=Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-heading),Math.cos(Math.atan2(dy,dx)-heading)));
 return delta<=Math.PI/3+DIRECTION_EPSILON?'front':delta>=Math.PI*2/3-DIRECTION_EPSILON?'back':'side';
}
export type DirectionalHit={direction:HitDirection;weakpointId?:string;healthScale:number;postureScale:number;origin?:Pos;heading:number;neutral:boolean};
/** Origin and pre-hit target heading are copied before combat activity/Break can change state. */
export function directionalHit(s:GameState,target:Unit,origin?:Pos):DirectionalHit {
 const snapshot=origin?{...origin}:undefined,heading=targetHeading(target),neutral=!isStandaloneExploration(s)||!validOrigin(target,snapshot);
 const direction=neutral?'side':hitDirection(target,snapshot!),profile=DIRECTIONAL_PROFILES[target.directionalProfileId||'neutral']||DIRECTIONAL_PROFILES.neutral;
 const rule=neutral?{}:profile[direction];
 return {direction,heading,origin:snapshot,neutral,healthScale:rule.healthScale??1,postureScale:rule.postureScale??1,weakpointId:rule.weakpointId};
}
