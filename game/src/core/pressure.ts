import type {Unit,GameState,Profession,SkillId} from './types';

/** Independent tuning, never derived from HP attack power. */
export const PRESSURE={delay:1.5,regen:.25,stagger:.6,recover:.5,grayHold:4,grayDecay:.1,reclaimRate:.5,basicBudget:.05,skillBudget:.1,recent:2};
/** Broken allied posture forbids ordinary locomotion, independently of stagger. */
export const locomotionLocked=(u:Unit)=>u.team==='ally'&&u.life==='active'&&u.posture<=0;
export const POSTURE_MAX:Record<Profession,number>={hunter:90,healer:80,cantor:80,guard:110,ranger:70,shieldguard:140,scythe:110};
export const POSTURE_ATTACK:Record<Profession,number>={hunter:15,healer:8,cantor:12,guard:12,ranger:12,shieldguard:24,scythe:20};
export const SKILL_PRESSURE:Record<SkillId,number>={hunt:18,prayer:0,ward:0,bell:25,poison:10,snipe:30,pain:0,sanctuary:0,rain:.3,dance:20,reap:25};
export function maximumPosture(u:Unit):number{
 if(u.team==='enemy')return u.role==='heavy'?150:u.role==='ranged'?60:90;
 const p=u.weapons[u.weaponIndex]?.profession;
 return p?POSTURE_MAX[p]:u.role==='ines'?140:u.role==='ranger'?70:u.role==='fiorre'||u.role==='guard'?110:90;
}
export function resetPressure(u:Unit):void{
 u.forcedMotion=undefined;u.wallPin=undefined;u.maxPosture=maximumPosture(u);u.posture=u.maxPosture;u.stagger=0;u.postureDelay=0;u.postureRecent=0;u.grayHp=0;u.grayDelay=0;
}
export function syncPostureMaximum(u:Unit):void{const next=maximumPosture(u);u.posture=Math.min(next,next*u.posture/Math.max(1,u.maxPosture));u.maxPosture=next;}
export type PostureResult={applied:number;becameBroken:boolean;breakReaction:boolean};
export function applyPosture(u:Unit,amount:number):PostureResult{
 const none={applied:0,becameBroken:false,breakReaction:false};
 if(!Number.isFinite(amount)||amount<=0||u.life!=='active')return none;
 u.postureRecent=PRESSURE.recent;u.postureDelay=PRESSURE.delay;
 if(u.stagger>0)return none;
 if(u.posture<=0){u.stagger=PRESSURE.stagger;return {...none,breakReaction:true};}
 const before=u.posture;u.posture=Math.max(0,before-amount);return {applied:before-u.posture,becameBroken:u.posture===0,breakReaction:false};
}
export function clampGray(u:Unit):void{u.grayHp=Math.max(0,Math.min(u.grayHp||0,Math.max(0,u.maxHp-u.hp)));}
export function recordHealthLoss(u:Unit,amount:number):void{
 if(u.team!=='ally'||amount<=0||!Number.isFinite(amount))return;
 u.grayHp=(u.grayHp||0)+amount;u.grayDelay=PRESSURE.grayHold;clampGray(u);
}
export function healHealth(u:Unit,amount:number):void{if(amount<=0||!Number.isFinite(amount))return;u.hp=Math.min(u.maxHp,u.hp+amount);clampGray(u);}
export function reclaimHealth(s:GameState,u:Unit,amount:number,castId:number,limit:number,rate:number):void{
 const actor=s.units.find(a=>a.id===u.id);
 if(!actor||actor.team!=='ally'||actor.life!=='active'||actor.shadowResident||actor.hp<=0||amount<=0)return;
 const key=actor.id+':'+castId,budgets=s.recoveryBudgets??={};
 const budget=budgets[key]??={remaining:actor.maxHp*limit};
 const gain=Math.max(0,Math.min(actor.grayHp||0,actor.maxHp-actor.hp,amount*rate,budget.remaining));
 actor.hp+=gain;actor.grayHp-=gain;budget.remaining-=gain;clampGray(actor);
}
export function pruneRecoveryBudgets(s:GameState):void{
 if(!s.recoveryBudgets)return;const live=new Set<string>();
 for(const u of s.units)for(const st of Object.values(u.skillStates||{})){if(st.run)live.add(u.id+':'+st.run.id);if(st.pressureCastId!==undefined&&st.time>0)live.add(u.id+':'+st.pressureCastId);}
 for(const e of s.skillEffects||[])live.add(e.sourceId+':'+e.castId);
 for(const key of Object.keys(s.recoveryBudgets))if(!live.has(key))delete s.recoveryBudgets[key];
}
export function tickPressure(u:Unit,dt:number):void{
 clampGray(u);
 if(dt<=0||!Number.isFinite(dt)||u.life!=='active'&&!(u.shadowResident&&u.role==='fiorre'&&!u.cloneOf))return;
 if(u.shadowResident&&(u.role!=='fiorre'||u.cloneOf))return;
 u.postureRecent=Math.max(0,u.postureRecent-dt);
 let remaining=dt;
 if(u.stagger>0){const used=Math.min(remaining,u.stagger);u.stagger=Math.max(0,u.stagger-used);remaining-=used;if(u.stagger<1e-8){u.stagger=0;u.wallPin=undefined;u.posture=u.maxPosture*PRESSURE.recover;u.postureDelay=PRESSURE.delay;}}
 const delay=Math.max(0,u.postureDelay);u.postureDelay=Math.max(0,delay-remaining);
 if(u.stagger===0)u.posture=Math.min(u.maxPosture,u.posture+Math.max(0,remaining-delay)*u.maxPosture*PRESSURE.regen);
 const hold=Math.max(0,u.grayDelay);u.grayDelay=Math.max(0,hold-dt);u.grayHp=Math.max(0,u.grayHp-Math.max(0,dt-hold)*u.maxHp*PRESSURE.grayDecay);clampGray(u);
}
