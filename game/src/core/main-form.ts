import {trialState} from './ability-trial';
import type {GameState,Unit,CommandResult} from './types';
import {equipmentBusy,usesEquipment} from './equipment';
import {commandFocus} from './exploration-control';
import type {MainFormId} from './main-form-spec';
const fail=(reason:string):CommandResult=>({ok:false,reason});
/** Read-only. C is rejected, never queued and never cancels an accepted attack. */
export function querySwitchMainForm(s:GameState,u:Unit,form:MainFormId):CommandResult{
 const right=u.equipment?.equipped.right;if(trialState(u))return fail('四链实验使用独立单形态；默认版本仍可切换');
 if(form!=='I'&&form!=='II')return fail('无效主武器形态');
 if(!usesEquipment(s,u)||!right||!['hunter-v2','al-basic-v1'].includes(u.basicProfileId??''))return fail('当前角色未接入双形态');
 if(s.controlledBodyId!==u.id)return fail('只能切换当前主控的右手形态');
 if(s.phase!=='battle'||u.life!=='active'||u.ready>0)return fail('当前角色无法切形态');
 if(right.ownerId!==u.id||right.hand!=='right'||right.weapon.shadow||right.weapon.durability<=0)return fail('右手装备不合法或已损坏');
 if(s.explorationControl?.aim||commandFocus(s)||u.evasion?.action||u.recall||u.rescueTarget||u.partyTask)return fail('先结束当前控制操作');
 const native=u.id==='hunter'?u.hunterCombat:u.alCombat;
 if(equipmentBusy(u)||s.time<(native?.hurtUntil??0)||s.time+1e-8<(native?.finalRecoveryUntil??0)||u.statuses.some(t=>t.kind==='stun'&&t.remaining>0))return fail('动作或普攻恢复尚未结束，不能切形态');
 return {ok:true};
}
export function switchMainForm(s:GameState,u:Unit,form:MainFormId):CommandResult{
 const check=querySwitchMainForm(s,u,form);if(!check.ok)return check;
 const right=u.equipment!.equipped.right!;if(right.currentForm===form)return {ok:true};right.currentForm=form;
 // Only unaccepted Basic input is discarded. No left resource, shot hold or active timer changes.
 const h=u.id==='hunter'?u.hunterCombat:u.alCombat;if(h){h.held=false;h.edgeUntil=-Infinity;h.nextStage=0;h.comboUntil=-Infinity;}
 if(u.basicChain){u.basicChain.buffer=undefined;u.basicChain.continuationExpiresAt=-Infinity;}
 return {ok:true};
}
