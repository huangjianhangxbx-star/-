import {HOME_LAYOUT} from './home-layout';
import type {GameState,CommandResult} from './types';
/** World membership, never a second Unit or inventory. Absence preserves legacy fixtures. */
export type HomeResident={id:'ranger';mode:'resident'|'party';home:101;anchor:'home.florecia.idle';revision:number;busy?:string};
export const HOME_IDLE={id:'home.florecia.idle',place:101,pos:HOME_LAYOUT.resident!} as const;
// The application supplies its existing modal owner query; no duplicate modal state machine.
const joinGuards=new WeakMap<GameState,()=>boolean>();
export function bindHomeJoinGuard(s:GameState,blocked:()=>boolean){joinGuards.set(s,blocked);}
export const residentAtHome=(s:GameState,id:string)=>s.world?.homeResident?.id===id&&s.world.homeResident.mode==='resident';
export const carriedOwner=(s:GameState,id:string)=>!residentAtHome(s,id);
export function personalContainerOwner(s:GameState,id:string){return id==='reserve'?'ranger':s.world?.backpack?.inventory?.containers[id]?.owner;}
export function carriedContainer(s:GameState,id:string){const owner=personalContainerOwner(s,id);return !owner||carriedOwner(s,owner);}
export function personalContainerAccessible(s:GameState,id:string){const owner=personalContainerOwner(s,id);return !owner||!residentAtHome(s,owner)||s.world?.visit.active&&s.world.visit.placeId===HOME_IDLE.place&&s.units.some(u=>u.id===owner&&u.life==='active');}
export function initializeHomeResident(s:GameState){const w=s.world;if(!w||w.homeResident)return;const r=s.units.find(u=>u.id==='ranger');if(!r)throw Error('家园角色实例缺失');w.homeResident={id:'ranger',mode:'resident',home:101,anchor:HOME_IDLE.id,revision:0};r.pos={...HOME_IDLE.pos};r.drawPos={...r.pos};r.path=[];r.destination=null;r.direct=undefined;r.following=false;}
export function homeJoinRequest(s:GameState){return {world:s.world?.id,visit:s.world?.visit.generation,actor:s.controlledBodyId,control:s.controlRevision??0,epoch:s.inputEpoch??0,target:'ranger',revision:s.world?.homeResident?.revision};}
export function queryHomeJoin(s:GameState,r=homeJoinRequest(s)):CommandResult{
 const w=s.world,h=w?.homeResident,actor=s.units.find(u=>u.id===r.actor),target=s.units.find(u=>u.id===r.target),fail=(reason:string)=>({ok:false,reason});
 if(!w||!h||r.world!==w.id||r.visit!==w.visit.generation||r.revision!==h.revision||r.target!==h.id||r.actor!==s.controlledBodyId||r.control!==(s.controlRevision??0)||r.epoch!==(s.inputEpoch??0))return fail('组队请求已失效');
 if(!w.visit.active||s.phase!=='battle'||h.busy||joinGuards.get(s)?.()||s.explorationControl?.aim||s.explorationControl?.commandFocusId)return fail('请先结束当前操作');
 if(!actor||actor.life!=='active'||actor.hp<=0||!target||target.life!=='active'||target.hp<=0||s.units.filter(u=>u.id===target.id).length!==1)return fail('角色当前无法组队');
 if(h.mode==='party')return {ok:true};
 if(w.visit.placeId!==h.home)return fail('回家后可组队');
 return {ok:true};
}
/** Synchronous membership publication; no teleport, healing, equipment grant or control switch. */
export function joinHomeParty(s:GameState,r:ReturnType<typeof homeJoinRequest>):CommandResult{const q=queryHomeJoin(s,r);if(!q.ok)return q;const h=s.world!.homeResident!;if(h.mode==='party')return q;h.mode='party';h.revision++;s.inputEpoch=(s.inputEpoch??0)+1;s.notice='芙蕾茜娅已加入队伍';return {ok:true};}
export function homeResidentDebug(s:GameState){const h=s.world?.homeResident;if(!h)return null;const stored=Object.entries(s.world!.places).flatMap(([id,p])=>(p.residents??[]).filter(u=>u.id===h.id).map(()=>Number(id))),active=s.units.filter(u=>u.id===h.id);return {...h,place:active.length?s.world!.visit.placeId:stored[0],instances:active.length+stored.length,controller:h.mode==='resident'?'StandAtAnchor':'existing-party',reason:queryHomeJoin(s).reason??'',controlled:s.controlledBodyId};}
