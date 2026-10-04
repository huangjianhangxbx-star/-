import {PRESSURE,SKILL_PRESSURE} from './pressure';
import {COMBAT_CONFIG} from './combat-config';
import type {Profession,ResolvedSkill,SkillId,SkillKind,Unit} from './types';

type Effects=Partial<ResolvedSkill>&{rangeBonus?:number;shieldDurationBonus?:number};
export type SkillLevel={name?:string;description:string;cost:number;effects:Effects};
export type SkillBranch={id:string;name:string;levels:SkillLevel[]};
export type SkillDefinition={id:SkillId;profession:Profession;name:string;description:string;kind:SkillKind;charge?:'time'|'hit'|'basic'|'none';trigger?:'manual'|'full'|'route'|'toggle';cooldown:number;duration:number;range:number;stages:SkillLevel[];branches:SkillBranch[];base:Effects};
const stage=(description:string,effects:Effects,index:number):SkillLevel=>({name:index===0?'初阶仪式':'终阶仪式',description,cost:index===0?24:40,effects});
const branch=(id:string,name:string,first:string,a:Effects,second:string,b:Effects):SkillBranch=>({id,name,levels:[{description:first,cost:12,effects:a},{description:second,cost:20,effects:b}]});
const old=COMBAT_CONFIG.skills;
const tree=(id:SkillId,profession:Profession,name:string,kind:SkillKind,cooldown:number,duration:number,range:number,description:string,tiers:string[],paths:[string,string,string][]):SkillDefinition=>({id,profession,name,kind,cooldown,duration,range,description,charge:kind==='count'?'hit':kind==='return'?'basic':kind==='toggle'?'none':'time',trigger:kind==='count'||kind==='timed'?'manual':kind==='return'?'route':kind==='toggle'?'toggle':'full',stages:tiers.map((s,i)=>stage(s,{},i)),branches:paths.map(([name,a,b],i)=>branch(['A','B','C'][i],name,a,{},b,{})),base:{}});

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
 snipe:{id:'snipe',profession:'ranger',name:'狙击姿态',description:'切换狙击模式：攻击节奏减慢、伤害大幅提高；移动不会退出，切换职业会关闭。',kind:'toggle',cooldown:0,duration:0,range:old.rangerRange,stages:[stage('主箭后贯穿最多1名敌人，35%威力。',{},0),stage('保留贯穿；0.35秒后原射线迟响，最多2名敌人各25%威力。',{},1)],branches:[branch('A','破甲锥','狙击主箭及派生忽略35%对应固定防御。',{},'忽略55%对应固定防御。',{}),branch('B','钉影','主箭命中减速65%、1秒，每敌人间隔3秒。',{},'减速80%、1.5秒，间隔3秒。',{}),branch('C','猎线接力','主箭击杀后半径2内接力一次45%威力。',{},'半径2.8、70%威力。',{})],base:{attackMultiplier:old.sniperDamage,attackPeriodMultiplier:old.sniperPeriod}},
 pain:tree('pain','shieldguard','折痛回响','count',0,0,2.8,'有效敌方直接受击积累痛印，上限8；至少1印可手动释放。每印治疗附近在场友方自身最大生命的2%，释放清零，无时间冷却。',['0.7秒后在原位置回声，治疗原波35%。','保留首回声；1.4秒再回声，治疗原波25%。'],[['合契护纹','各治疗波附4秒护纹：吸收下一次直接受击20%，上限目标生命5%。','吸收35%，上限8%，持续4秒。'],['觅伤回声','每波最低血量比例者额外治疗35%。','最低者55%，次低者25%，不重复同一人。'],['余愈结晶','过量治疗50%转4秒护盾，上限目标生命8%。','75%转5秒护盾，上限目标生命12%。']]),
 sanctuary:tree('sanctuary','shieldguard','静钟庇护','timed',36,12,3.2,'36秒充能，手动维持12秒定点领域；每0.5秒治疗附近友方自身最大生命的0.5%，敌人减速30%、对应固定防御降低25%。移动/换装/回收中断。',['敌人离场后基础减速/削防残留2秒。','保留离场残留；核心半径1.6额外削防15%，每3秒额外治疗。'],[['迟滞涟漪','每敌人首次进入减速65%、1秒。','减速80%、1.5秒；重入不重置。'],['剥鳞印记','连续覆盖每2秒额外削防6%，最多3层；离场清除。','每层10%，最多3层；总削防不超过70%。'],['接力烛火','退出领域友方每秒恢复自身最大生命1%，持续3秒；重入停止。','持续5秒；离场时附近另一名最低血友方额外治疗2%。']]),
 rain:tree('rain','ranger','连珠箭雨','auto',24,6,7,'24秒自动充能，满充自动进入6秒连射，空场照常计时。每0.008秒一支0.025倍攻击微箭，逐箭防御；移动停止发箭。',['每16支实发主箭附带1支60%微箭威力侧箭。','替换为每12支附带最多2支60%微箭侧箭。'],[['破缝楔矢','每24支主箭替换为0.25倍攻击楔矢，忽略50%固定防御。','每16支替换0.35倍攻击楔矢，忽略50%防御。'],['织网','同一目标主箭有效命中20次，减速25%、1秒。','12次触发40%减速、1秒。'],['回旋箭痕','每0.4秒有主箭才留半径0.6/1秒箭痕；首次覆盖逐箭4次，最多2处。','半径0.9/1.5秒，逐箭6次，最多3处。']]),
 dance:tree('dance','scythe','永夜镰舞','chargedMode',18,0,1.8,'18秒充能满后自动进入无限镰舞；E退出重新充能。每刀120度扇区、1.15倍攻击，合法敌人数量不限；移动停止攻击但不退出。',['每刀0.2秒后原方向35%威力回锋，人数不限。','保留回锋并覆盖背后90度；每敌人一次。'],[['裂帛','原始横扫留下3秒裂纹；已有裂纹目标下刀额外0.2倍攻击。','裂纹4秒、额外0.35倍攻击。'],['众生回潮','每刀每名命中敌人治疗自身最大生命1%，回血最多计3人。','每人1.25%，回血最多计5人；伤害人数不限。'],['余月留痕','外沿0.3宽弧带留0.6秒镰痕，首次覆盖0.25倍攻击，保留最新。','持续1秒、0.4倍攻击。']]),
 reap:tree('reap','scythe','离魂回镰','return',0,0,3,'实际出手5次普攻蓄满，有合法命敌直线路线才自动滑行往返。去程2倍、回程1.4倍攻击；仅本技能穿敌、不穿墙/跨层、无无敌；复制体原地发镰影。',['终点半径1转折斩0.8倍攻击。','保留转折斩；正常合法归位后半径1.2收锋0.8倍攻击。'],[['往返契印','去程命中过的目标回程额外40%威力；仅本次来源。','回程额外65%威力。'],['归途缝合','回程首次经过其他在场友方0.9内，治疗自身最大生命3%。','距离1.2、治疗5%。'],['留席月轮','原位半径0.9月轮至技能结束/最多2秒；首次0.5倍攻击及25%减速0.6秒。','0.8倍攻击，减速40%、1秒。']]),
};
export const PROFESSION_NAMES:Record<Profession,string>={hunter:'猎人',healer:'守夜司祭',cantor:'霜镜使',guard:'守卫',ranger:'弓手',shieldguard:'盾卫',scythe:'镰舞者'};
export const DEFAULT_SKILLS:Record<Profession,SkillId>={hunter:'hunt',healer:'prayer',cantor:'bell',guard:'poison',ranger:'snipe',shieldguard:'pain',scythe:'dance'};
export function professionOf(u:Unit):Profession{return u.weapons[u.weaponIndex]?.profession??(u.role==='fiorre'?'healer':u.role==='guard'?'guard':u.role==='ranger'?'ranger':'hunter');}
export function skillInfo(u:Unit):SkillDefinition{const id=u.skillId&&SKILL_CATALOG[u.skillId]?.profession===professionOf(u)?u.skillId:DEFAULT_SKILLS[professionOf(u)];return SKILL_CATALOG[id];}
export function skillsForProfession(profession:Profession):SkillDefinition[]{return Object.values(SKILL_CATALOG).filter(d=>d.profession===profession);}
export function resolveSkill(u:Unit,snapshot?:ResolvedSkill):ResolvedSkill{
 if(snapshot)return {...snapshot};
 const d=skillInfo(u),state=u.skillStates?.[d.id];
 const value:ResolvedSkill={postureDamage:SKILL_PRESSURE[d.id],reclaimRate:PRESSURE.reclaimRate,reclaimBudget:PRESSURE.skillBudget,id:d.id,name:d.name,kind:d.kind,tier:state?.stage??0,branches:{...state?.branches},cooldown:d.cooldown,duration:d.duration,range:d.range,width:0,power:0,heal:0,shieldBase:0,missingHpScale:0,shieldDuration:0,defense:0,defenseDuration:0,regen:0,regenDuration:0,stun:0,slow:0,slowDuration:0,allyHeal:0,attackMultiplier:1,attackPeriodMultiplier:1,poisonPerHit:0,poisonThreshold:100,poisonRadius:0,poisonDamage:0,pulsePeriod:1,pulseAt:0,...d.base};
 if(state?.stage){const tier=d.stages[Math.min(state.stage,d.stages.length)-1];if(tier)Object.assign(value,tier.effects);}
 for(const b of d.branches){const level=state?.branches[b.id]??0;if(!level)continue;const e=b.levels[Math.min(level,b.levels.length)-1].effects;const {rangeBonus=0,shieldDurationBonus=0,...rest}=e;Object.assign(value,rest);value.range+=rangeBonus;value.shieldDuration+=shieldDurationBonus;}
 if(d.id==='ward'&&value.regen>0)value.regenDuration=value.shieldDuration;
 return value;
}
