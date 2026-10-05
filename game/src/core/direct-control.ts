import type {CommandResult,GameState,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';
import {aiState,initializeAnchor,completePlayerMove} from './autonomy';
import {direct} from './personal';

const eligible=(s:GameState,u:Unit)=>isPartyBody(s,u)&&u.life==='active'&&!u.shadowResident;
export function queryControlBody(s:GameState,id:string):CommandResult {
 if(!isStandaloneExploration(s)||s.phase!=='battle')return {ok:false,reason:'仅独立暗牢战斗可切换主控'};
 const u=s.units.find(u=>u.id===id);
 return u&&eligible(s,u)?{ok:true}:{ok:false,reason:'该对象不是当前可操控的双人本体'};
}
/** Read-only fallback for presentation; ensure performs the actual handoff. */
export function controlledBody(s:GameState):Unit|null {
 if(!isStandaloneExploration(s)||s.phase!=='battle')return null;
 return s.units.find(u=>u.id===s.controlledBodyId&&eligible(s,u))||s.units.find(u=>eligible(s,u))||null;
}
const lifecycle=(u:Unit)=>!!(u.evasion?.action||u.attackPending||u.skillTime>0||u.skillStates?.[u.skillId||'']?.run||u.loadout||u.crossing||u.skillLanding||u.recall||u.partyTask||u.rescueTarget);
function release(s:GameState,u:Unit){
 const ai=aiState(u);
 if(u.direct)direct(s,u,null);
 if(ai.command==='move'&&(u.path.length||u.crossing||u.skillLanding))return;
 if(lifecycle(u)){ai.handoffPending=true;return;}
 initializeAnchor(s,u);ai.command=undefined;ai.commandUntil=s.time;ai.phase='hold';ai.intent='hold';
}
function acquire(s:GameState,u:Unit){
 const ai=aiState(u);
 // Only AI locomotion is revoked. Do not use clearMotion: it also cancels attacks/landings.
 if((ai.moving||u.following)&&!u.skillLanding){
  u.path=u.crossing?[{...u.crossing.to}]:[];u.destination=null;u.afterCross=undefined;
  if(u.intent==='move')u.intent=null;
 }
 u.following=false;ai.moving=false;ai.task=undefined;ai.targetId=undefined;
 ai.contributionPoint=undefined;ai.braceUntil=undefined;ai.settleUntil=undefined;
 ai.invalidatedAt=undefined;ai.lastAutoMoveAt=undefined;ai.lastAutoMoveDirection=undefined;
 ai.handoffPending=undefined;ai.phase='player';ai.intent='player';
}
export function switchControlledBody(s:GameState,id:string):CommandResult {
 const result=queryControlBody(s,id);if(!result.ok)return result;
 if(s.controlledBodyId===id)return result;
 const outgoing=s.units.find(u=>u.id===s.controlledBodyId);
 if(outgoing)release(s,outgoing);
 s.controlledBodyId=id;acquire(s,s.units.find(u=>u.id===id)!);return result;
}
export function ensureControlledBody(s:GameState){
 if(!isStandaloneExploration(s)||s.phase!=='battle'){s.controlledBodyId=null;return;}
 const current=s.units.find(u=>u.id===s.controlledBodyId);
 if(!current||!eligible(s,current)){
  const next=controlledBody(s);
  if(next)switchControlledBody(s,next.id);
  else {if(current)release(s,current);s.controlledBodyId=null;}
 }
 for(const u of s.units){completePlayerMove(s,u);if(u.id===s.controlledBodyId||!u.ai?.handoffPending||lifecycle(u)||u.path.length||u.direct)continue;u.ai.handoffPending=undefined;initializeAnchor(s,u);u.ai.command=undefined;u.ai.commandUntil=s.time;}
}
