import {isPartyBody} from './exploration-party';
import type {GameState,CommandResult} from './types';
import type {ExplorationPoint} from './exploration-types';
import {clearMotion,clearPersonalAction,actionable} from './personal';
import {clearAutonomy} from './autonomy';
import {cancelLoadout,interruptSkill} from './loadout';
import {resetPressure,healHealth} from './pressure';
import {distance,clearShot} from './spatial';
import {EXPLORE} from './exploration-content';

export function useCampfire(s:GameState,p:ExplorationPoint):CommandResult{
 const r=s.exploration,h=s.units.find(u=>u.id==='hunter');
 if(!r||!h||!actionable(h)||h.ready>0||h.crossing||h.skillLanding||s.context!=='explorationIdle')return {ok:false,reason:'脱战后由可行动猎人休息'};
 if(s.units.some(e=>e.team==='enemy'&&e.life==='active'&&(e.pursuitTargetId||s.units.some(a=>isPartyBody(s,a)&&a.life==='active'&&distance(e.pos,a.pos)<=EXPLORE.detect&&clearShot(s,e.pos,a.pos)))))return {ok:false,reason:'敌人仍在附近或追踪队伍，不能休息'};
 for(const u of s.units){
  if(!isPartyBody(s,u)||['dead','downed','respawning','departed'].includes(u.life))continue;
  clearAutonomy(u);clearMotion(u);if(u.evasion){u.evasion.charges=2;u.evasion.progress=0;u.evasion.action=undefined;}clearPersonalAction(u);cancelLoadout(u);interruptSkill(u);
  healHealth(u,u.maxHp*.5);u.stress=Math.max(0,u.stress-40);resetPressure(u);
  u.statuses=u.statuses.filter(t=>!['poison','stun','slow','resistBreak','crack'].includes(t.kind));u.poisonMeter=0;
  for(const st of Object.values(u.skillStates??{}))st.cd=0;
  u.skillCd=0;
  if(u.role==='fiorre'&&u.life==='rescued'){u.life='withdrawn';u.shadowResident=true;if(s.rescueRestrictions)delete s.rescueRestrictions[u.id];}
 }
 r.memory.mechanisms.push(p.id);r.checkpoint={...p.pos};s.notice='篝火休息 · 恢复半数最大生命、压力−40、技能就绪与满架势；检查点已记录';return {ok:true};
}
