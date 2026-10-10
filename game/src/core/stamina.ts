import type {CommandResult,GameState,Unit} from './types';
import {isPartyBody,isStandaloneExploration} from './exploration-party';

/** CB-02 SAMPLE, separate from frost, ammo, HP, posture and golden cooldowns. */
export const STAMINA_SAMPLE=Object.freeze({max:100,basic:10,shot:15,guard:8,dodge:22,active:28,guardPerSecond:6,recoveryPerSecond:20,recoveryDelay:.5});
export type StaminaAction='basic'|'shot'|'guard'|'dodge'|'active';
export type StaminaState={current:number;max:number;recoverAt:number;nextAcceptedId:number;lastAcceptedId:number;guardExhausted:boolean;noticeUntil?:number};
export const usesStamina=(s:GameState,u:Unit)=>s.sessionMode==='exploration'&&!s.xxExperiment&&isStandaloneExploration(s)&&isPartyBody(s,u)&&!u.shadowResident;
const fresh=():StaminaState=>({current:STAMINA_SAMPLE.max,max:STAMINA_SAMPLE.max,recoverAt:0,nextAcceptedId:1,lastAcceptedId:0,guardExhausted:false});
export function initializeStamina(s:GameState,reset=false){for(const u of s.units)if(usesStamina(s,u)&&u.life==='active'&&(reset||!u.stamina))u.stamina=fresh();}
const fail=(reason:string):CommandResult=>({ok:false,reason});
/** No allocation, clock update, UI feedback or mutation during qualification. */
export function queryActionStamina(s:GameState,u:Unit,kind:StaminaAction):CommandResult{
 if(!usesStamina(s,u))return {ok:true};
 const st=u.stamina,current=st?.current??STAMINA_SAMPLE.max,max=st?.max??STAMINA_SAMPLE.max;
 if(u.life!=='active'||s.phase!=='battle')return fail('当前无法消耗体力');
 if(!Number.isFinite(current)||!Number.isFinite(max)||max<=0||current<0)return fail('体力状态不可用');
 if(kind==='guard'&&st?.guardExhausted)return fail('体力耗尽 · 松开右键后重新举盾');
 return Math.min(current,max)+1e-8>=STAMINA_SAMPLE[kind]?{ok:true}:fail('体力不足');
}
/** Accepted IDs belong to this body's resource lifetime, never optional trace IDs.
 * Monotonic watermark retains idempotency without an unbounded payment ledger. */
export function spendAcceptedAction(s:GameState,u:Unit,kind:StaminaAction,acceptedId:number):CommandResult{
 if(!usesStamina(s,u))return {ok:true};
 if(!Number.isSafeInteger(acceptedId)||acceptedId<1)return fail('无效体力接受身份');
 if(u.stamina&&acceptedId<=u.stamina.lastAcceptedId)return {ok:true};
 const check=queryActionStamina(s,u,kind);if(!check.ok)return check;
 const st=u.stamina??=fresh();st.current=Math.max(0,Math.min(st.current,st.max)-STAMINA_SAMPLE[kind]);st.recoverAt=s.time+STAMINA_SAMPLE.recoveryDelay;st.lastAcceptedId=acceptedId;st.nextAcceptedId=Math.max(st.nextAcceptedId,acceptedId+1);return {ok:true};
}
export function acceptActionStamina(s:GameState,u:Unit,kind:StaminaAction){return spendAcceptedAction(s,u,kind,u.stamina?.nextAcceptedId??1);}
function busy(u:Unit){return !!(u.basicAction||u.attackPending||u.hunterCombat?.special||u.hunterCombat?.motion||u.alCombat?.special||u.alCombat?.motion||u.evasion?.action||u.crossing||u.skillLanding||Object.values(u.skillStates??{}).some(st=>st.run||st.time>0));}
/** Called only by the simulation. True means the caller must safely close guard. */
export function tickStamina(s:GameState,u:Unit,dt:number):boolean{
 if(!usesStamina(s,u)||s.phase!=='battle'||u.life!=='active'||!Number.isFinite(dt)||dt<=0)return false;
 const st=u.stamina??=fresh();st.max=Number.isFinite(st.max)&&st.max>0?st.max:STAMINA_SAMPLE.max;st.current=Number.isFinite(st.current)?Math.max(0,Math.min(st.current,st.max)):0;if(!Number.isFinite(st.recoverAt))st.recoverAt=s.time+STAMINA_SAMPLE.recoveryDelay;
 if(u.hunterCombat?.special?.kind==='guard'){
  st.current=Math.max(0,st.current-STAMINA_SAMPLE.guardPerSecond*dt);st.recoverAt=s.time+STAMINA_SAMPLE.recoveryDelay;
  if(st.current<=1e-8){st.current=0;st.guardExhausted=true;return true;}return false;
 }
 if(!busy(u)){const recovering=Math.max(0,Math.min(dt,s.time-st.recoverAt));st.current=Math.min(st.max,st.current+STAMINA_SAMPLE.recoveryPerSecond*recovering);}
 return false;
}
export function restoreStamina(s:GameState,u:Unit){if(usesStamina(s,u)&&u.stamina){u.stamina.current=u.stamina.max;u.stamina.recoverAt=s.time+STAMINA_SAMPLE.recoveryDelay;}}
/** Repeated held refusals reuse the existing notice with a simulation-time cap. */
export function showStaminaRefusal(s:GameState,reason:string){
 if(!reason.includes('体力'))return true;
 const u=s.units.find(u=>u.id===s.controlledBodyId),st=u?.stamina;
 if(st&&s.time<(st.noticeUntil??-Infinity))return false;
 if(st)st.noticeUntil=s.time+1;return true;
}
export function refuseStamina(s:GameState,u:Unit,result:CommandResult){
 if(!result.ok&&result.reason&&s.controlledBodyId===u.id&&showStaminaRefusal(s,result.reason)){s.notice=result.reason;s.log.unshift(result.reason);s.log.length=Math.min(40,s.log.length);}
 return result;
}
