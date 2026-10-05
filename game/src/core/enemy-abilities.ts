import type {GameState,Unit} from './types';
import {clipCapsule,type AttackArea} from './attack-area';
export type EnemyAbilityId='melee-heavy-cleave'|'ranged-power-shot'|'heavy-ground-slam';
export type EnemyKitId='melee-v1'|'ranged-v1'|'heavy-v1';
export type EnemyReactionId='counter-step'|'backstep-evade'|'front-brace';
export const ENEMY_ABILITIES={
 'melee-heavy-cleave':{label:'裂阵重斩',range:1.35,min:0,max:1.25,arc:140*Math.PI/180,total:.85,lock:.50,cooldown:5,hp:1.35,posture:1.60,impact:.65},
 'ranged-power-shot':{label:'蓄力穿射',range:6,min:2.2,max:6,radius:.16,total:1.05,lock:.65,cooldown:6,hp:1.60,posture:1.40,impact:0},
 'heavy-ground-slam':{label:'震地重击',range:1.75,min:0,max:1.75,total:1.15,lock:.75,cooldown:7,hp:1.40,posture:2,impact:1.15}
} as const;
export const ENEMY_KITS={
 'melee-v1':{ability:'melee-heavy-cleave',reaction:'counter-step'},
 'ranged-v1':{ability:'ranged-power-shot',reaction:'backstep-evade'},
 'heavy-v1':{ability:'heavy-ground-slam',reaction:'front-brace'}
} as const;
export const enemyKitForRole=(role:Unit['role']):EnemyKitId|undefined=>role==='melee'?'melee-v1':role==='ranged'?'ranged-v1':role==='heavy'?'heavy-v1':undefined;
export function abilityArea(s:GameState,e:Unit,id:EnemyAbilityId,heading:number):AttackArea{
 const c=ENEMY_ABILITIES[id];
 if(id==='heavy-ground-slam')return {kind:'circle',center:{...e.pos},radius:c.range};
 if('radius' in c)return clipCapsule(s,{kind:'capsule',from:{...e.pos},to:{x:e.pos.x+Math.cos(heading)*c.range,y:e.pos.y+Math.sin(heading)*c.range},radius:c.radius});
 return {kind:'sector',origin:{...e.pos},heading,range:c.range,arc:'arc' in c?c.arc:0};
}
