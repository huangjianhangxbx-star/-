import type {GameState,Profession,SkillId,SkillLoadout,Unit} from './types';
import {DEFAULT_SKILLS,SKILL_CATALOG,professionOf,skillsForProfession} from './skill-catalog';
import {skillState} from './progression';

export function validLoadout(slots:unknown,profession:Profession):slots is SkillLoadout{
 return Array.isArray(slots)&&slots.length===3&&slots[0]!==null&&slots.every(id=>id===null||SKILL_CATALOG[id as SkillId]?.profession===profession)&&new Set(slots.filter(Boolean)).size===slots.filter(Boolean).length;
}
export function defaultLoadout(profession:Profession,first=DEFAULT_SKILLS[profession]):SkillLoadout{
 if(SKILL_CATALOG[first]?.profession!==profession)first=DEFAULT_SKILLS[profession];
 return [first,skillsForProfession(profession).find(d=>d.id!==first)?.id??null,null];
}
export function equipProfileSlots(s:GameState,u:Unit):void{
 if(u.team!=='ally')return;const p=s.profile!,profession=professionOf(u);
 p.loadouts??={};const saved=(p.loadouts[u.id]??={});
 if(!validLoadout(saved[profession],profession))saved[profession]=defaultLoadout(profession,p.defaults[u.id]?.[profession]);
 u.skillSlots=[...saved[profession]!] as SkillLoadout;u.skillId=u.skillSlots[0]!;
 u.professionSlots??={};u.professionSlots[profession]=[...u.skillSlots];
 for(const id of equippedSkills(u))skillState(u,id);
}
export function skillInSlot(u:Unit,slot:number):SkillId|null{
 if(!Number.isInteger(slot)||slot<0||slot>2)return null;
 return u.skillSlots?u.skillSlots[slot]:slot===0?u.skillId??DEFAULT_SKILLS[professionOf(u)]:null;
}
export function equippedSkills(u:Unit):SkillId[]{const ids:(SkillId|null)[]=u.skillSlots??[u.skillId??DEFAULT_SKILLS[professionOf(u)]];return ids.filter((id):id is SkillId=>!!id&&SKILL_CATALOG[id]?.profession===professionOf(u));}
export function skillStateInSlot(u:Unit,slot:number){const id=skillInSlot(u,slot);return id?skillState(u,id):null;}
export function hasEquippedSkill(u:Unit,id:SkillId):boolean{return equippedSkills(u).includes(id);}
/** Background modes never own the body. A running cast or route does. */
export function foregroundSkill(u:Unit):SkillId|null{
 return equippedSkills(u).find(id=>{const st=u.skillStates?.[id];return !!st&&(st.time>0||!!st.run)&&!['dance','snipe','poison'].includes(id);})??null;
}
