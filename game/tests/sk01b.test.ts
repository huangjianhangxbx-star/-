import {test,expect} from 'vitest';
import {createExplorationEntry,command,step,resolveHit} from '../src/core/engine';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
const change=(s:any,id:string,key:string,abilityId:string|null,mainDefinitionId=id==='hunter'?'hunter-golden-main':'al-golden-main')=>command(s,{type:'configurePreparedSkill',id,key,abilityId,mainDefinitionId} as any);
const start=(s:any)=>{expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);return s.units.filter((u:any)=>u.team==='ally');};
test('SK01B preparation independently selects/swaps/clears owned skills before real carry',()=>{
 const s=createExplorationEntry(),account=structuredClone(s.economy),time=s.time;
 expect(change(s,'hunter','Q','hunter-sweep').ok).toBe(true);expect(change(s,'ranger','R',null).ok).toBe(true);
 expect(s.economy).toEqual(account);expect(s.time).toBe(time);
 const [h,al]=start(s);expect(h.equipment.equipped.right.skills.slots).toEqual({Q:'hunter-sweep',E:'hunter-native-E',R:'hunter-break'});expect(al.equipment.equipped.right.skills.slots).toEqual({Q:'al-stab',E:'al-native-E',R:null});
 expect(h.equipment.equipped.right.skills.slots).not.toBe((s as any).rightPreparation.hunter.slots);
});
test('SK01B invalid owner/profession/definition/fixed E queries refuse without mutation or payment',async()=>{
 const s=createExplorationEntry(),before=structuredClone(s),m=await import('../src/core/right-preparation').catch(()=>undefined);expect(m).toBeDefined();
 for(const [id,key,a,d] of [['hunter','Q','al-spin','hunter-golden-main'],['ranger','E',null,'al-golden-main'],['enemy','Q','hunter-break','hunter-golden-main'],['hunter','Q','no-skill','hunter-golden-main'],['hunter','Q',null,'world-1:hunter:right:golden']]){
  expect(m!.queryPreparedSkillChange(s,id as string,key as any,a as any,d as string).ok).toBe(false);expect(change(s,id as string,key as string,a as any,d as string).ok).toBe(false);
 }
 expect(s).toEqual(before);start(s);const live=structuredClone(s);expect(change(s,'hunter','R',null).ok).toBe(false);expect(s).toEqual(live);
});
test('SK01B restart preserves both templates but generates fresh instances, CD, payment and world',()=>{
 const s=createExplorationEntry();change(s,'hunter','Q','hunter-sweep');change(s,'ranger','Q','al-spin');const [h,al]=start(s),w=s.world!,old=h.equipment!.equipped.right,prep=structuredClone((s as any).rightPreparation),inventory={...s.economy.account};
 h.ready=0;const target={x:h.pos.x+1,y:h.pos.y};expect(command(s,{type:'rightSkillInput',id:'hunter',key:'Q',aim:target}).ok).toBe(true);expect(old.skills!.instances['hunter-sweep']!.cd).toBe(10);expect(h.stamina!.lastAcceptedId).toBe(1);
 expect(command(s,{type:'restartWorld',worldId:'stale'}).ok).toBe(false);expect(s.world).toBe(w);
 expect(command(s,{type:'restartWorld',worldId:w.id}).ok).toBe(true);expect((s as any).rightPreparation).toEqual(prep);expect(s.economy.account).toEqual(inventory);expect(s.phase).toBe('account');
 const [n,a]=start(s);expect(s.world!.id).not.toBe(w.id);expect(n.equipment!.equipped.right.id).not.toBe(old.id);expect(n.equipment!.equipped.right.skills!.slots).toEqual({Q:'hunter-sweep',E:'hunter-native-E',R:'hunter-break'});expect(a.equipment!.equipped.right.skills!.slots.Q).toBe('al-spin');expect(n.equipment!.equipped.right.skills!.instances['hunter-sweep']!.cd).toBe(0);expect(n.stamina!.lastAcceptedId).toBe(0);expect(n.equipment!.equipped.right.skills!.action).toBeUndefined();expect(createExplorationEntry().units[0].equipment).toBeUndefined();
});
test('SK01B legitimate runtime edits sync only own preparation and preserve same-world identity/CD through continue/death',()=>{
 const {s,h,al,e}=base();s.sessionMode='exploration';beginWorld(s);s.context='explorationIdle';
 expect(command(s,{type:'configureRightSkill',id:h.id,key:'Q',abilityId:'hunter-sweep'}).ok).toBe(true);expect(command(s,{type:'configureRightSkill',id:h.id,key:'R',abilityId:null}).ok).toBe(true);
 expect((s as any).rightPreparation.hunter.slots).toEqual({Q:'hunter-sweep',E:'hunter-native-E',R:null});expect((s as any).rightPreparation.ranger.slots.Q).toBe('al-stab');
 command(s,{type:'rightSkillInput',id:h.id,key:'Q',aim:e.pos});const r=h.equipment!.equipped.right,inst=r.skills!.instances['hunter-sweep'],paid=h.stamina!.lastAcceptedId;const prep=structuredClone((s as any).rightPreparation);
 expect(command(s,{type:'configureRightSkill',id:h.id,key:'R',abilityId:'hunter-break'}).ok).toBe(false);expect((s as any).rightPreparation).toEqual(prep);
 resolveHit(s,h,{...e.weapons[0],subtype:'impact'},99999,e);s.units=s.units.filter(u=>u.team==='ally');for(let i=0;s.time<10.02&&i<2000;i++)step(s,.01);expect(h.life).toBe('active');expect(h.equipment!.equipped.right).toBe(r);expect(r.skills!.instances['hunter-sweep']).toBe(inst);expect(h.stamina!.lastAcceptedId).toBe(paid);
 s.units=s.units.filter(u=>u.team==='ally');s.context='explorationIdle';h.pos={...s.goal};al.pos={...s.goal};const w=s.world!,cd=inst!.cd;expect(command(s,{type:'exitExploration'}).ok).toBe(true);step(s,50);expect(inst!.cd).toBe(cd);expect(command(s,{type:'continueWorld',worldId:w.id,visit:w.visit.generation}).ok).toBe(true);expect(r.skills!.instances['hunter-sweep']).toBe(inst);expect(inst!.cd).toBe(cd);expect(r.skills!.slots.R).toBeNull();expect((s as any).rightPreparation).toEqual(prep);
});
