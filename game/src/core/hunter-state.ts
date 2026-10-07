import {recordCombatLifecycle} from './combat-identity';
import type {GameState,Unit,Pos} from './types';
import type {ActionContext,AttackEvent} from './combat-identity';
import {resolveBasicDefinition} from './basic-definition';
export type HunterAction={kind:'dodge'|'guard'|'prepare'|'charge';pose:string;elapsed:number;duration:number;facing:number;context?:ActionContext;releasing?:boolean;paid?:boolean;release?:boolean;attackReady?:boolean;moveReady?:boolean};
export type HunterHazard={context?:ActionContext;attack?:AttackEvent;stage:number;kind:string;facing:number;range:number;halfAngle:number;damage:number;expires:number;hit:Set<string>;id:number};
export type HunterMotion={distance:number;duration:number;elapsed:number;facing:number;ease:boolean};
export type HunterTrace={id:number;kind:string;at:number;real:number;stage?:number;action?:number;x:number;y:number;cue?:string};
export type HunterState={held:boolean;edgeUntil:number;aim:Pos;nextStage:number;comboUntil:number;finalRecoveryUntil:number;lastInput:number;frost:number;frostPaidAt:number;dodgeCharges:number;dodgeCooldown:number;activeCharge:number;activeCooldown:number;mp:number;guardStartedAt:number;invulnerableUntil:number;special?:HunterAction;motion?:HunterMotion;hazards:HunterHazard[];trace:HunterTrace[];hurtUntil:number};
export function isHunterV2(s:GameState,u:Unit){return s.journey==='exploration'&&u.id==='hunter'&&!u.cloneOf&&resolveBasicDefinition(u).id==='hunter-v2';}
export function hunterState(u:Unit):HunterState{return u.hunterCombat??={held:false,edgeUntil:-Infinity,aim:{x:u.pos.x+1,y:u.pos.y},nextStage:0,comboUntil:Infinity,finalRecoveryUntil:0,lastInput:-1,frost:3,frostPaidAt:-Infinity,dodgeCharges:2,dodgeCooldown:0,activeCharge:1,activeCooldown:0,mp:100,guardStartedAt:Infinity,invulnerableUntil:0,hazards:[],trace:[],hurtUntil:0};}
export function hunterNote(s:GameState,u:Unit,kind:string,stage?:number,action?:number,cue?:string){const h=hunterState(u);h.trace.push({id:s.nextId++,kind,stage,action,at:s.time,real:s.realTime??s.time,x:u.pos.x,y:u.pos.y,cue});if(h.trace.length>512)h.trace.shift();}

export function cancelHunterSpecial(s:GameState,u:Unit,reason:string){const h=hunterState(u),a=h.special;if(!a)return;recordCombatLifecycle(s,a.context,'action-cancelled',reason);hunterNote(s,u,'Cancel',undefined,a.context?.actionId);if(a.kind==='dodge')h.hazards=h.hazards.filter(x=>x.context?.actionId!==a.context?.actionId);h.special=undefined;h.motion=undefined;h.invulnerableUntil=0;h.guardStartedAt=Infinity;}
