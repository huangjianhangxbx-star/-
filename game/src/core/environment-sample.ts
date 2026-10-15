import {changeTeamItems} from './inventory-world';
import type {GameState,Pos,CommandResult} from './types';
import {queryBackpack,inventoryQuantity} from './world-inventory';
import {surface,terrainFits} from './spatial';
import {rightSkillAction} from './right-skill-state';

export const FIELD_LAMP='sample-field-lamp';
export const DARK_SAMPLE=Object.freeze({minX:8.5,maxX:11.5,minY:15.5,maxY:20.5,vision:1.5,radius:4,duration:20});
export type SampleLightState={revision:number;serial:number;uses:{serial:number;actorId:string;visit:number;at:number}[]};
export type SampleLightRequest={worldId:string;visit:number;actorId:string;controlRevision:number;expectedRevision:number};
const reject=(reason:string):CommandResult=>({ok:false,reason});
/** Only a formal world's initialized sample owns this region; no named/Legacy/Lab opt-in. */
export function sampleDarkTarget(s:GameState,p:Pos){return !!s.world?.sampleLight&&s.sessionMode==='exploration'&&!s.xxExperiment&&!!s.world.visit.active&&p.x>=DARK_SAMPLE.minX&&p.x<=DARK_SAMPLE.maxX&&p.y>=DARK_SAMPLE.minY&&p.y<=DARK_SAMPLE.maxY;}
export function sampleEnvironmentView(s:GameState){if(!s.world?.sampleLight||s.sessionMode!=='exploration'||s.xxExperiment)return undefined;const u=s.units.find(u=>u.id===s.controlledBodyId),remaining=Math.max(0,...s.lights.filter(l=>l.sampleFieldLamp).map(l=>l.remaining));return {dark:!!u&&sampleDarkTarget(s,u.pos),remaining,quantity:inventoryQuantity(s.world.backpack,FIELD_LAMP)};}
export function querySampleLightUse(s:GameState,r:SampleLightRequest):CommandResult{
 const gate=queryBackpack(s);if(!gate.ok)return gate;const w=s.world!,st=w.sampleLight;
 if(!st||r.worldId!==w.id||r.visit!==w.visit.generation||r.controlRevision!==(s.controlRevision??0)||r.expectedRevision!==st.revision||!Number.isSafeInteger(st.revision)||st.revision<0||st.revision>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(st.serial)||st.serial<0||st.serial>=Number.MAX_SAFE_INTEGER)return reject('照明访问或库存操作已过期，请重开背包');
 const u=s.units.find(u=>u.id===r.actorId);if(!u||u.id!==s.controlledBodyId)return reject('需要当前存活的实控本体');const n=u.hunterCombat??u.alCombat;
 if(!['explorationIdle','explorationBattle'].includes(s.context??'')||u.ready>0||u.stagger>0||u.posture<=0||u.statuses.some(x=>x.kind==='stun'&&x.remaining>0)||u.forcedMotion||u.crossing||u.skillLanding||u.transition||u.destination||u.direct||u.attackIntent||u.attackPending||u.basicAction||u.evasion?.action||u.offhand?.pending||u.offhand?.held||rightSkillAction(u)||u.loadout||Object.values(u.skillStates??{}).some(x=>x.run)||u.recall||u.partyTask||u.rescueTarget||n?.held||u.alCombat?.shotHeld||n?.special||n?.motion||s.time<(n?.hurtUntil??0)||s.time<(n?.finalRecoveryUntil??0))return reject('先结束当前身体动作再点亮照明');
 if(!sampleDarkTarget(s,u.pos)||surface(s,u.pos)?.layer!==0||!terrainFits(s,u.pos))return reject('靠近南侧支廊暗区后再点亮照明');
 if(inventoryQuantity(w.backpack,FIELD_LAMP)<1)return reject('团队没有可用的实验便携灯；芙蕾茜娅后备须先撤回');
 if(s.lights.some(l=>l.sampleFieldLamp&&l.remaining>0))return reject('本轮临时灯仍在发光，不重复消耗');
 return {ok:true};
}
export function acceptSampleLightUse(s:GameState,r:SampleLightRequest):CommandResult{
 const gate=querySampleLightUse(s,r);if(!gate.ok)return gate;const w=s.world!,st=w.sampleLight!,u=s.units.find(u=>u.id===r.actorId)!;
 changeTeamItems(w.backpack!,[{definitionId:FIELD_LAMP,quantity:-1}]);s.lights.push({pos:{...u.pos},radius:DARK_SAMPLE.radius,remaining:DARK_SAMPLE.duration,sampleFieldLamp:true});st.revision++;st.serial++;st.uses.push({serial:st.serial,actorId:u.id,visit:w.visit.generation,at:s.time});if(st.uses.length>16)st.uses.splice(0,st.uses.length-16);s.notice='实验便携灯已点亮 · 半径4 / 20模拟秒（SAMPLE）';return {ok:true};
}
