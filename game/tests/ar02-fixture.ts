import {createGame,command,step,resolveHit} from '../src/core/engine';
import {skillState} from '../src/core/progression';
import type {GameState,SkillId,Profession} from '../src/core/types';
import {createHash} from 'node:crypto';

export const scenarios:SkillId[]=['hunt','prayer','ward','bell','poison','snipe','pain','sanctuary','rain','dance','reap'];
const professions:Record<SkillId,Profession>={hunt:'hunter',prayer:'healer',ward:'healer',bell:'cantor',poison:'ranger',snipe:'ranger',pain:'shieldguard',sanctuary:'shieldguard',rain:'ranger',dance:'scythe',reap:'scythe'};
export function arena(skill:SkillId='hunt',seed=742){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ines'});command(s,{type:'carry',gold:0,vitality:0});
 s.seed=seed;s.units=s.units.filter(u=>u.team==='ally');s.tiles.forEach(t=>{t.obstacle=false;t.layer=0;});
 for(const u of s.units){u.ready=0;u.path=[];u.destination=null;u.stagger=0;u.attackTimer=0;u.statuses=[];u.hp=u.maxHp;}
 const h=s.units.find(u=>u.id==='hunter')!,p=s.units.find(u=>u.id==='ines')!;
 h.pos={x:15,y:10};h.drawPos={...h.pos};p.pos={x:11,y:10};p.drawPos={...p.pos};
 h.weapons[h.weaponIndex].profession=professions[skill];h.skillSlots=[skill,null,null];h.skillId=skill;
 const st=skillState(h,skill);st.cd=0;st.time=0;st.counter=skill==='reap'?5:3;st.stage=2;st.branches={A:2,B:2,C:2};st.enabled=['dance','snipe','poison'].includes(skill);
 const e=structuredClone(h);e.id='ar02-foe';e.team='enemy';e.role='melee';e.skillSlots=[null,null,null];e.skillStates={};e.skillTime=0;e.skillCd=999;e.attackPending=undefined;e.basicChain=undefined;e.blink=undefined;e.evasion=undefined;e.ai=undefined;e.pos={x:16,y:10};e.drawPos={...e.pos};e.hp=e.maxHp=20000;e.posture=e.maxPosture=2000;e.attackTimer=100;e.enemyMotion='engaged';e.pursuitTargetId=h.id;e.route=[];e.path=[];e.weapons=e.weapons.map(w=>({...w,damage:8,range:1.1}));s.units.push(e);
 const f=structuredClone(e);f.id='ar02-foe-2';f.pos={x:17,y:10};f.drawPos={...f.pos};s.units.push(f);
 return {s,h,p,e,f};
}
// Full gameplay projection: only the new observation namespace is omitted.
export const projection=(s:GameState)=>JSON.stringify(s,(key,value)=>['combatIdentity','combatContext','combatAttack','basicAction'].includes(key)?undefined:value);
export const fingerprint=(s:GameState)=>createHash('sha256').update(projection(s)).digest('hex');
export function frame(a:ReturnType<typeof arena>,i:number){
 const {s,h,p,e}=a;
 if(i===0)command(s,{type:'skill',id:h.id,slot:0});
 if([2,12,22,42].includes(i))command(s,{type:'basic',id:h.id,aim:{...e.pos},requestId:i+1});
 if(i===8)command(s,{type:'controlBody',id:p.id});
 if(i===18)command(s,{type:'controlBody',id:h.id});
 if(i===28)command(s,{type:'direct',id:h.id,direction:{x:0,y:1}});
 if(i===32)command(s,{type:'direct',id:h.id,direction:null});
 if(i===36||i===37)resolveHit(s,h,e.weapons[0],11,e,{eventId:991,castId:55,postureDamage:4,kind:'basic'});
 if(i===46)command(s,{type:'blink',id:h.id,direction:{x:0,y:1}});
 step(s,.05);
}
