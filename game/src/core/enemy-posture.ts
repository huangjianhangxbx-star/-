import type {GameState,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {combatTraceEnabled,currentCombatAttack} from './combat-identity';

/** User-approved EN04 engineering SAMPLE. Not original-game posture or equipment quality. */
export const EN04_POSTURE={control:.6,recover:.5,delay:1.5,regen:.25,guard:.5} as const;
export type PostureActivity='idle-walk'|'main-basic'|'main-skill'|'evasion'|'offhand'|'unknown';
export type PostureControl={generation:number;startedAt:number;until:number;contacts:number};
export type PostureTrace={at:number;generation:number;targetId:string;kind:'contact'|'PostureBroken'|'recovered'|'death';reason:string;raw?:number;guardMultiplier?:number;loss?:number;before?:number;after?:number;actionId?:number;attackEventId?:number;rootActionId?:number;parentActionId?:number;entityId?:number;sourceId?:string};
export type PostureRuntime={generation:number;readonly mode:'xinghai'|'reference';trace:PostureTrace[]};
export function usesEnemyPosture(s:GameState,u:Unit){return !!s.postureRuntime&&isStandaloneExploration(s)&&s.postureRuntime.generation===s.combatIdentity?.generation&&(!!u.enemyV2?.profile.visual||isPartyBody(s,u));}
export function syncEnemyPosture(s:GameState){
 const r=s.postureRuntime;if(!r||r.generation===s.combatIdentity?.generation)return;
 r.generation=s.combatIdentity!.generation;r.trace=[];
 for(const u of s.units){u.postureControl=undefined;u.stagger=0;u.posture=u.maxPosture;u.postureDelay=0;u.postureRecent=0;}
}
export function postureActivity(u:Unit):PostureActivity{
 if(u.hunterCombat?.special){const kind=u.hunterCombat.special.kind;return kind==='guard'?'offhand':kind==='dodge'?'evasion':'main-skill';}
 if(u.alCombat?.special){const kind=u.alCombat.special.kind;return kind==='roll'?'evasion':'main-skill';}
 if(u.evasion?.action)return 'evasion';
 if(u.basicAction||u.enemyV2?.action)return 'main-basic';
 if(u.xxCombat?.action||Object.values(u.skillStates??{}).some(st=>st.run)||u.skillTime>0)return 'unknown';
 return 'idle-walk';
}
function note(s:GameState,u:Unit,row:Omit<PostureTrace,'at'|'generation'|'targetId'>){
 const r=s.postureRuntime;if(!r||!combatTraceEnabled(s))return;
 const a=currentCombatAttack(s);r.trace.push({at:s.time,generation:r.generation,targetId:u.id,sourceId:a?.context.actorId,actionId:a?.context.actionId,attackEventId:a?.attack.attackEventId,rootActionId:a?.context.rootActionId,parentActionId:a?.context.parentActionId,entityId:a?.attack.entityId,...row});if(r.trace.length>512)r.trace.shift();
}
/** Called only after main contact qualification; owns no HP, IDs, RNG or body events. */
export function applyEnemyPosture(s:GameState,u:Unit,raw:number,blocked=false){
 const none={applied:0,becameBroken:false,breakReaction:false};
 if(!usesEnemyPosture(s,u)||s.postureRuntime!.mode==='reference'||u.life!=='active'||!Number.isFinite(raw)||raw<=0)return none;
 const before=u.posture,multiplier=blocked?EN04_POSTURE.guard:1;
 u.postureDelay=EN04_POSTURE.delay;u.postureRecent=2;
 const controlled=u.postureControl&&s.time<u.postureControl.until;
 if(controlled)u.postureControl!.contacts++;
 const applied=controlled?0:Math.min(Math.max(0,before),raw*multiplier);u.posture=Math.max(0,before-applied);
 const broken=!controlled&&before>0&&u.posture===0;
 if(broken){u.postureControl={generation:s.combatIdentity!.generation,startedAt:s.time,until:s.time+EN04_POSTURE.control,contacts:1};u.stagger=EN04_POSTURE.control;}
 note(s,u,{kind:broken?'PostureBroken':'contact',reason:controlled?'already-controlled':broken?'zero-this-contact':'nonzero',raw,guardMultiplier:multiplier,loss:applied,before,after:u.posture});
 return {applied,becameBroken:broken,breakReaction:broken};
}
/** Absolute control end and substep recovery use the main simulation clock only. */
export function tickEnemyPosture(s:GameState,u:Unit,dt:number){
 if(!usesEnemyPosture(s,u))return;
 const c=u.postureControl;
 if(c&&c.generation!==s.combatIdentity?.generation){u.postureControl=undefined;u.stagger=0;u.posture=u.maxPosture;u.postureDelay=0;return;}
 if(u.life!=='active'){if(c)note(s,u,{kind:'death',reason:'death-priority'});u.postureControl=undefined;u.stagger=0;return;}
 if(dt<=0)return;
 if(s.postureRuntime!.mode==='reference')return;
 u.postureRecent=Math.max(0,u.postureRecent-dt);
 const delay=u.postureDelay;u.postureDelay=Math.max(0,delay-dt);
 let remaining=dt;
 if(c){u.stagger=Math.max(0,c.until-s.time);const spent=Math.min(dt,Math.max(0,c.until-(s.time-dt)));remaining-=spent;
  if(u.stagger>1e-8)return;
  u.stagger=0;u.postureControl=undefined;u.wallPin=undefined;u.posture=u.maxPosture*EN04_POSTURE.recover;note(s,u,{kind:'recovered',reason:'control-ended',after:u.posture});
 }else if(u.stagger>0){u.stagger=Math.max(0,u.stagger-dt);return;}
 const activity=postureActivity(u),rate=activity==='idle-walk'?1:activity==='offhand'?.5:0;
 u.posture=Math.min(u.maxPosture,u.posture+Math.max(0,remaining-Math.max(0,delay-(dt-remaining)))*u.maxPosture*EN04_POSTURE.regen*rate);
}
