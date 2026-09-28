import type {Unit,Weapon} from './types';
/** Reversible prototype tuning. Gameplay systems consume these values directly. */
export const COMBAT_CONFIG={
 baseMoveSpeed:.85,
 crystalHp:10,
 allyHp:{hunter:360,fiorre:280,guard:800,ranger:260},
 cloneCost:20,
 initialSkillCharge:true,
 warmup:{hunter:0,fiorre:8,guard:10,ranger:6},
 allyAttack:{hunter:32,fiorre:35,guard:28,ranger:30},
 barrierHp:80,
 guardReduction:.35,
 exclusive:{hunterKills:3},
 weight:{heavyRatio:1,overweightRatio:1.5,fit:{move:1,attack:1,dodge:1},heavy:{move:.8,attack:.85,dodge:.5},overweight:{move:.55,attack:.65,dodge:0}},
 mental:{cooldown:6,nearbyRadius:3,lowHealth:{hunter:10,fiorre:16,guard:12,ranger:20},allyDown:{hunter:16,fiorre:24,guard:20,ranger:28},duration:15,inspiredDamage:1.25,distressedDamage:.8,inspiredChance:.35},
 skills:{hunterDuration:8,hunterDamage:50,hunterInterval:1,hunterRange:5,hunterWidth:1,hunterStun:.2,fiorreHeal:160,fiorreRadius:3,sniperPeriod:2.5,sniperDamage:3.5,rangerRange:7,rangerWidth:0,poisonPerHit:25,poisonThreshold:100,poisonRadius:1.5,poisonDamage:80},
};
export const DAMAGE_FAMILIES={physical:['slash','pierce','impact'],arcane:['flame','frost','shadow']} as const;
export function weightProfile(u:Unit){
 const load=u.weapons.reduce((n,w)=>n+(w.weight||0),0),ratio=load/Math.max(.01,u.capacity??10);
 const band=ratio>COMBAT_CONFIG.weight.overweightRatio?'overweight':ratio>COMBAT_CONFIG.weight.heavyRatio?'heavy':'fit';
 const tuning=COMBAT_CONFIG.weight[band];return {band,move:tuning.move,attack:tuning.attack,dodge:(u.dodge||0)*tuning.dodge};
}
export function damageAfterDefense(w:Weapon,u:Unit,power:number){
 const family=w.damageKind||'physical',subtype=w.subtype||(family==='physical'?'slash':'shadow');
 const valid=(DAMAGE_FAMILIES[family] as readonly string[]).includes(subtype);
 return Math.max(0,power-(valid&&u.defense?.subtype===subtype?Math.max(0,u.defense.flat):0));
}
export function compatibleWeapon(u:Unit,w:Weapon|undefined){return !!w&&(!w.class||!u.compatibleClasses||u.compatibleClasses.includes(w.class))}
