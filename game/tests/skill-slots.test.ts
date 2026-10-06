import {playerOwns} from '../src/core/autonomy';
import {resetExpeditionSkills} from '../src/core/progression';
import {expect,test} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
import {skillButton,skillStatus} from '../src/skill-ui';
import {createClone} from '../src/core/clones';
import {resolveHit} from '../src/core/engine';
import {foe} from './rework-fixtures';
import {skillAreas} from '../src/view/skill-areas';
import {skillState} from '../src/core/progression';
import {equipProfileSlots} from '../src/core/skill-slots';
import {useCampfire} from '../src/core/campfire';

function run(id='ranger'){
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration',seed:18});command(s,{type:'selectExplorationCompanion',id});command(s,{type:'carry',gold:0,vitality:0});
 s.units=s.units.filter(u=>u.team==='ally');const u=s.units.find(u=>u.id===id)!;u.ready=0;s.context='explorationBattle';return {s,u};
}
test('standalone equips the second existing skill and charges it independently of slot one',()=>{
 const {s,u}=run();expect(u.skillSlots).toEqual(['snipe','rain',null]);
 currentSkill(u).enabled=true;step(s,1);
 expect(u.skillStates!.rain.cd).toBeCloseTo(23);expect(u.skillStates!.snipe.enabled).toBe(true);
});
test('slot three is empty and refuses a cast without changing slot one',()=>{
 const {s,u}=run();expect(command(s,{type:'skill',id:u.id,slot:2}).ok).toBe(false);expect(currentSkill(u).enabled).toBe(false);
});
test('battle unload freezes a skill, reequip resumes and does not rewrite profile',()=>{
 const {s,u}=run();step(s,1);const before=u.skillStates!.rain.cd;
 expect(command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null}).ok).toBe(true);step(s,1);
 expect(u.skillStates!.rain.cd).toBe(before);expect(s.profile!.loadouts![u.id].ranger).toEqual(['snipe','rain',null]);
 expect(command(s,{type:'configureSkillSlot',id:u.id,slot:2,skillId:'rain'}).ok).toBe(true);step(s,1);expect(u.skillStates!.rain.cd).toBeCloseTo(before-1);
});
test('configuration rejects duplicate, wrong profession and empty first slot without mutation',()=>{
 const {s,u}=run();for(const [slot,skillId] of [[0,null],[1,'snipe'],[2,'prayer']] as const)expect(command(s,{type:'configureSkillSlot',id:u.id,slot,skillId}).ok).toBe(false);
 expect(u.skillSlots).toEqual(['snipe','rain',null]);
});
test('explicit upgrade of rain leaves snipe progression and clock unchanged',()=>{
 const {s,u}=run();s.fragments=100;u.skillStates!.rain.cd=12;const before=structuredClone(currentSkill(u));
 expect(command(s,{type:'upgradeSkill',id:u.id,skillId:'rain',kind:'stage',expectedLevel:0}).ok).toBe(true);
 expect(u.skillStates!.rain.stage).toBe(1);expect(u.skillStates!.rain.cd).toBe(12);expect(currentSkill(u)).toEqual(before);
});
test('a manual foreground cast prevents the other cast from stealing the body',()=>{
 const {s,u}=run('fiorre');u.weaponIndex=0;u.skillId='prayer';u.skillSlots=['prayer','ward',null];u.skillStates!.prayer={stage:0,branches:{},counter:0,cd:0,max:18,time:0,pulse:0,enabled:false};u.skillStates!.ward={...u.skillStates!.prayer,max:22};
 expect(command(s,{type:'skill',id:u.id,slot:0}).ok).toBe(true);expect(command(s,{type:'skill',id:u.id,slot:1}).ok).toBe(false);
 expect(command(s,{type:'configureSkillSlot',id:u.id,slot:0,skillId:'ward'}).ok).toBe(false);
});
test('slot UI labels the actual second skill and displays a quiet empty slot',()=>{
 const {u}=run();expect(skillButton(u,'',1)).toContain('连珠箭雨');expect(skillStatus(u,1).label).toContain('24');expect(skillButton(u,'',2)).toContain('空');
});
test('clone snapshots both clocks and slots and does not follow subsequent parent edits',()=>{
 const {s,u}=run();u.skillStates!.rain.cd=7;u.skillStates!.snipe.enabled=true;const c=createClone(u,'copy',1,{x:10,y:10});
 expect(c.skillSlots).toEqual(['snipe','rain',null]);expect(c.skillStates!.rain.cd).toBe(7);expect(c.skillStates!.snipe.enabled).toBe(true);
 command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null});u.skillStates!.rain.cd=2;expect(c.skillSlots![1]).toBe('rain');expect(c.skillStates!.rain.cd).toBe(7);
});
test('account slots persist into the run and tower stays single slot compatible',()=>{
 const s=createGame();command(s,{type:'selectJourney',journey:'exploration'});const u=s.units.find(a=>a.id==='ranger')!;
 expect(command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null}).ok).toBe(true);expect(command(s,{type:'configureSkillSlot',id:u.id,slot:2,skillId:'rain'}).ok).toBe(true);
 command(s,{type:'selectExplorationCompanion',id:u.id});command(s,{type:'carry',gold:0,vitality:0});expect(u.skillSlots).toEqual(['snipe',null,'rain']);expect(u.skillStates!.rain.cd).toBe(24);
 const tower=createGame();command(tower,{type:'selectJourney',journey:'tower'});expect(tower.units[0].skillSlots).toBeUndefined();
});
test('pain counts incoming hits while sanctuary runs without resetting its clock',()=>{
 const {s,u}=run('ines');u.skillStates!.sanctuary.cd=0;u.dodge=0;const e=foe(s,u.pos.x+1,u.pos.y);e.skillSlots=undefined;
 expect(command(s,{type:'skill',id:u.id,slot:1}).ok).toBe(true);resolveHit(s,u,e.weapons[0],1,e);expect(u.skillStates!.pain.counter).toBe(1);expect(u.skillStates!.sanctuary.time).toBe(12);
 expect(command(s,{type:'skill',id:u.id,slot:0}).ok).toBe(false);expect(u.skillStates!.pain.counter).toBe(1);
});
test('the second-slot sanctuary appears in the world field layer',()=>{
 const {s,u}=run('ines');u.skillStates!.sanctuary.cd=0;command(s,{type:'skill',id:u.id,slot:1});expect(skillAreas(s).some(a=>a.id===u.id+':field')).toBe(true);
});
test('ordinary shadow clocks freeze both slots while Fiorre continues both equipped clocks',()=>{
 for(const id of ['ranger','fiorre']){const {s,u}=run(id);u.shadowResident=true;u.life='withdrawn';const ids=u.skillSlots!.filter(Boolean);for(const key of ids)skillState(u,key!).cd=10;step(s,1);for(const key of ids)expect(skillState(u,key!).cd).toBeCloseTo(id==='fiorre'?9:10);}
});
test('campfire restores timed charge without creating pain or reap counts or changing toggle mode',()=>{
 const {s,u}=run('ines');const h=s.units[0],p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;h.pos={...p.pos};s.context='explorationIdle';u.skillStates!.pain.counter=3;u.skillStates!.sanctuary.cd=22;
 expect(useCampfire(s,p).ok).toBe(true);expect(u.skillStates!.pain.counter).toBe(3);expect(u.skillStates!.sanctuary.cd).toBe(0);
 const other=run('fiorre');const pp=other.s.exploration!.definition.points.find(p=>p.kind==='campfire')!;other.s.units[0].pos={...pp.pos};other.s.context='explorationIdle';other.u.skillStates!.reap.counter=2;other.u.skillStates!.dance.enabled=true;expect(useCampfire(other.s,pp).ok).toBe(true);expect(other.u.skillStates!.reap.counter).toBe(2);expect(other.u.skillStates!.dance.enabled).toBe(true);
});
test('profession preferences migrate the old default into slot one',()=>{
 const s=createGame(),u=s.units.find(a=>a.id==='ranger')!;s.profile!.defaults.ranger={ranger:'rain'};equipProfileSlots(s,u);expect(u.skillSlots).toEqual(['rain','snipe',null]);
});
test('casting a timed skill in slot two blocks evade until it finishes',()=>{
 const {s,u}=run('fiorre');u.weaponIndex=0;u.skillId='prayer';u.skillSlots=['prayer','ward',null];skillState(u,'ward').cd=0;s.controlledBodyId=u.id;expect(command(s,{type:'skill',id:u.id,slot:1}).ok).toBe(true);expect(command(s,{type:'evade',id:u.id,direction:{x:1,y:0}}).ok).toBe(false);
});

test('campfire does not refresh an unequipped frozen skill',()=>{
 const {s,u}=run();const p=s.exploration!.definition.points.find(p=>p.kind==='campfire')!;s.units[0].pos={...p.pos};s.context='explorationIdle';u.skillStates!.rain.cd=7;command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null});expect(useCampfire(s,p).ok).toBe(true);expect(u.skillStates!.rain.cd).toBe(7);
});

test('a second-slot cast retains body ownership after switching direct actor',()=>{
 const {s,u}=run('ines');u.skillStates!.sanctuary.cd=0;command(s,{type:'skill',id:u.id,slot:1});s.controlledBodyId='hunter';u.ai={intent:'hold',phase:'hold',nextDecision:0,movedAt:0,commandUntil:0,directTravel:0};expect(playerOwns(s,u)).toBe(true);
});
test('new expedition respects a saved slot-one loadout even when the legacy default differs',()=>{
 const {s,u}=run();s.profile!.loadouts!.ranger.ranger=['rain','snipe',null];s.profile!.defaults.ranger={ranger:'snipe'};resetExpeditionSkills(s);expect(u.skillId).toBe('rain');expect(u.skillSlots).toEqual(['rain','snipe',null]);
});

test('prayer and ward charge together, finish independently and do not let manual AI cast',()=>{
 const {s,u}=run('fiorre');u.weaponIndex=0;u.skillId='prayer';u.skillSlots=['prayer','ward',null];skillState(u,'prayer').cd=2;skillState(u,'ward').cd=3;step(s,1);expect(skillState(u,'prayer').cd).toBeCloseTo(1);expect(skillState(u,'ward').cd).toBeCloseTo(2);step(s,2);expect(skillState(u,'prayer').time).toBe(0);expect(command(s,{type:'skill',id:u.id,slot:0}).ok).toBe(true);expect(command(s,{type:'skill',id:u.id,slot:1}).ok).toBe(false);step(s,3);expect(command(s,{type:'skill',id:u.id,slot:1}).ok).toBe(true);
});
test('unloading a toggle closes it but preserves its progression and clock',()=>{
 const {s,u}=run();command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null});command(s,{type:'configureSkillSlot',id:u.id,slot:0,skillId:'rain'});command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:'snipe'});const st=skillState(u,'snipe');st.enabled=true;st.stage=1;st.cd=3;expect(command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null}).ok).toBe(true);expect(st.enabled).toBe(false);expect(st.cd).toBe(3);expect(st.stage).toBe(1);
});
test('the snipe basic modifier works from slot two while rain is the legacy first projection',()=>{
 const {s,u}=run();command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:null});command(s,{type:'configureSkillSlot',id:u.id,slot:0,skillId:'rain'});command(s,{type:'configureSkillSlot',id:u.id,slot:1,skillId:'snipe'});s.tiles.forEach(t=>{t.obstacle=false;t.layer=0;});u.pos={x:10,y:10};u.drawPos={...u.pos};u.attackTimer=0;u.weapons[u.weaponIndex].weight=0;u.ai={anchor:{...u.pos},commandUntil:1000} as any;skillState(u,'rain').cd=24;skillState(u,'snipe').enabled=true;const e=foe(s,11,10);e.skillSlots=undefined;e.reveal=100;e.enemySense=undefined;e.pursuitTargetId=u.id;e.encounterRoom=0;e.encounterId=e.id;s.exploration!.definition.encounters=[{room:0,name:'skill fixture',tier:'small',enemyIds:[e.id],center:{...e.pos},tacticalRadius:6.5}];u.following=false;step(s,.3);step(s,.3);expect(s.combatEvents!.some(e=>e.skillId==='snipe'&&e.sourceId===u.id)).toBe(true);expect(skillState(u,'rain').cd).toBeCloseTo(23.4);
});
