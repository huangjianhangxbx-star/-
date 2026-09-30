import {COMBAT_CONFIG} from './combat-config';
import type {Profession,ResolvedSkill,SkillId,Unit} from './types';

type Effects=Partial<ResolvedSkill>&{rangeBonus?:number;shieldDurationBonus?:number};
export type SkillLevel={name?:string;description:string;cost:number;effects:Effects};
export type SkillBranch={id:string;name:string;levels:SkillLevel[]};
export type SkillDefinition={id:SkillId;profession:Profession;name:string;description:string;kind:'timed'|'toggle';cooldown:number;duration:number;range:number;stages:SkillLevel[];branches:SkillBranch[];base:Effects};
const stage=(description:string,effects:Effects,index:number):SkillLevel=>({name:index===0?'初阶仪式':'终阶仪式',description,cost:index===0?24:40,effects});
const branch=(id:string,name:string,first:string,a:Effects,second:string,b:Effects):SkillBranch=>({id,name,levels:[{description:first,cost:12,effects:a},{description:second,cost:20,effects:b}]});
const old=COMBAT_CONFIG.skills;
export const SKILL_CATALOG:Record<SkillId,SkillDefinition>={
 hunt:{id:'hunt',profession:'hunter',name:'猎杀时刻',description:'短暂替代普攻，向射程内的敌人射击，并造成短促眩晕。',kind:'timed',cooldown:18,duration:old.hunterDuration,range:old.hunterRange,stages:[],branches:[],base:{power:old.hunterDamage,stun:old.hunterStun,width:old.hunterWidth,pulseAt:.25,pulsePeriod:old.hunterInterval}},
 prayer:{id:'prayer',profession:'healer',name:'生命祷告',description:'咏唱 2 秒，第 1 秒治疗自身周围的在场友方。可扩大范围、附加防护或延续恢复。',kind:'timed',cooldown:18,duration:2,range:3,
  stages:[stage('每次治疗 190；冷却 17 秒。',{heal:190,cooldown:17},0),stage('每次治疗 220；冷却 16 秒。',{heal:220,cooldown:16},1)],
  branches:[branch('reach','远灯','治疗半径增加 0.8 格。',{rangeBonus:.8},'治疗半径增加 1.6 格。',{rangeBonus:1.6}),branch('shelter','庇荫','治疗附加 12% 防护，持续 4 秒。',{defense:.12,defenseDuration:4},'治疗附加 22% 防护，持续 6 秒。',{defense:.22,defenseDuration:6}),branch('afterglow','余温','治疗后每秒恢复 4，持续 6 秒。',{regen:4,regenDuration:6},'治疗后每秒恢复 8，持续 6 秒。',{regen:8,regenDuration:6})],base:{heal:160,pulsePeriod:0,pulseAt:1}},
 ward:{id:'ward',profession:'healer',name:'伤势守护',description:'为范围内在场友方提供护盾：基础值加已损失生命的比例。护盾有独立来源，不能恢复濒死资格。',kind:'timed',cooldown:22,duration:2,range:2.5,
  stages:[stage('基础护盾 45，加已损失生命的 40%。',{shieldBase:45,missingHpScale:.4},0),stage('基础护盾 60，加已损失生命的 50%。',{shieldBase:60,missingHpScale:.5},1)],
  branches:[branch('longwatch','长夜','护盾持续时间增加 2 秒。',{shieldDurationBonus:2},'护盾持续时间增加 4 秒。',{shieldDurationBonus:4}),branch('warmth','温拥','护盾期间每秒恢复 4。',{regen:4},'护盾期间每秒恢复 8。',{regen:8}),branch('covenant','守约','施法半径增加 0.8 格。',{rangeBonus:.8},'施法半径增加 1.6 格。',{rangeBonus:1.6})],base:{shieldBase:30,missingHpScale:.3,shieldDuration:6,pulsePeriod:0,pulseAt:1}},
 bell:{id:'bell',profession:'cantor',name:'霜镜钟声',description:'咏唱 2 秒，第 1 秒对周围敌人造成伤害与减速。可扩展范围、附加眩晕或治疗附近友方。',kind:'timed',cooldown:20,duration:2,range:4,
  stages:[stage('每次伤害 60，减速 30%；冷却 19 秒。',{power:60,slow:.3,cooldown:19},0),stage('每次伤害 75，减速 35%；冷却 18 秒。',{power:75,slow:.35,cooldown:18},1)],
  branches:[branch('horizon','远响','作用半径增加 0.8 格。',{rangeBonus:.8},'作用半径增加 1.6 格。',{rangeBonus:1.6}),branch('silence','止语','每次脉冲附加 0.35 秒眩晕。',{stun:.35},'每次脉冲附加 0.7 秒眩晕。',{stun:.7}),branch('mercy','慈音','每次脉冲治疗附近友方 20。',{allyHeal:20},'每次脉冲治疗附近友方 40。',{allyHeal:40})],base:{power:45,slow:.25,slowDuration:3,pulsePeriod:0,pulseAt:1}},
 poison:{id:'poison',profession:'guard',name:'毒刃连锁',description:'自动毒素可开关：飞刀命中累积敌人的共享毒素，满条时造成周围伤害。',kind:'toggle',cooldown:0,duration:0,range:5,stages:[],branches:[],base:{poisonPerHit:old.poisonPerHit,poisonThreshold:old.poisonThreshold,poisonRadius:old.poisonRadius,poisonDamage:old.poisonDamage}},
 snipe:{id:'snipe',profession:'ranger',name:'狙击姿态',description:'切换狙击模式：攻击节奏减慢、伤害大幅提高；移动不会退出，切换职业会关闭。',kind:'toggle',cooldown:0,duration:0,range:old.rangerRange,stages:[],branches:[],base:{attackMultiplier:old.sniperDamage,attackPeriodMultiplier:old.sniperPeriod}},
};
export const PROFESSION_NAMES:Record<Profession,string>={hunter:'猎人',healer:'守夜司祭',cantor:'霜镜使',guard:'守卫',ranger:'游侠'};
export const DEFAULT_SKILLS:Record<Profession,SkillId>={hunter:'hunt',healer:'prayer',cantor:'bell',guard:'poison',ranger:'snipe'};
export function professionOf(u:Unit):Profession{return u.weapons[u.weaponIndex]?.profession??(u.role==='fiorre'?'healer':u.role==='guard'?'guard':u.role==='ranger'?'ranger':'hunter');}
export function skillInfo(u:Unit):SkillDefinition{const id=u.skillId&&SKILL_CATALOG[u.skillId]?.profession===professionOf(u)?u.skillId:DEFAULT_SKILLS[professionOf(u)];return SKILL_CATALOG[id];}
export function skillsForProfession(profession:Profession):SkillDefinition[]{return Object.values(SKILL_CATALOG).filter(d=>d.profession===profession);}
export function resolveSkill(u:Unit,snapshot?:ResolvedSkill):ResolvedSkill{
 if(snapshot)return {...snapshot};
 const d=skillInfo(u),state=u.skillStates?.[d.id];
 const value:ResolvedSkill={id:d.id,name:d.name,kind:d.kind,cooldown:d.cooldown,duration:d.duration,range:d.range,width:0,power:0,heal:0,shieldBase:0,missingHpScale:0,shieldDuration:0,defense:0,defenseDuration:0,regen:0,regenDuration:0,stun:0,slow:0,slowDuration:0,allyHeal:0,attackMultiplier:1,attackPeriodMultiplier:1,poisonPerHit:0,poisonThreshold:100,poisonRadius:0,poisonDamage:0,pulsePeriod:1,pulseAt:0,...d.base};
 if(state?.stage){const tier=d.stages[Math.min(state.stage,d.stages.length)-1];if(tier)Object.assign(value,tier.effects);}
 for(const b of d.branches){const level=state?.branches[b.id]??0;if(!level)continue;const e=b.levels[Math.min(level,b.levels.length)-1].effects;const {rangeBonus=0,shieldDurationBonus=0,...rest}=e;Object.assign(value,rest);value.range+=rangeBonus;value.shieldDuration+=shieldDurationBonus;}
 if(d.id==='ward'&&value.regen>0)value.regenDuration=value.shieldDuration;
 return value;
}
