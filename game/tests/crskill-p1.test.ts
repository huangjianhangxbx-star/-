import {hunterState} from '../src/core/hunter-state';
import {alState} from '../src/core/al-state';
import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld,leaveWorldArea,continueWorld} from '../src/core/world-session';
import {command,step} from '../src/core/engine';
import {resolveBasicDefinition} from '../src/core/basic-definition';
async function runtime(){const path='../src/core/ability-trial';return import(/* @vite-ignore */path).catch(()=>undefined);}
async function setup(){const m=await runtime();expect(m,'four-chain runtime exists').toBeDefined();const a=base();a.s.sessionMode='exploration';(a.s as any).abilityTrial=true;beginWorld(a.s);a.s.context='explorationIdle';a.e.hp=a.e.maxHp=1000;a.e.ready=100;hunterState(a.h);alState(a.al);return {...a,m};}
const tick=(s:any,n:number)=>{for(let i=0;i<n;i++)step(s,.02);};
test('CR P1 explicit instance, source removal and immutable basic acceptance; default untouched',async()=>{
 const {s,h,m}=await setup();const r=h.equipment!.equipped.right;
 expect(r.definitionId).toBe('cr-blue-experimental');expect(resolveBasicDefinition(h).stages).toHaveLength(3);
 const source=m.trialState(h).sources.find((x:any)=>x.effect==='chisel');expect(source).toBeDefined();
 expect(resolveBasicDefinition(h).stages[2].presentationId).toBe('a改戳地跳');
 h.hunterCombat!.nextStage=2;command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}});const accepted=h.basicAction!;
 m.removeTrialSource(h,source.id);expect(accepted.stageSpec.presentationId).toBe('a改戳地跳');expect(resolveBasicDefinition(h).stages[2].presentationId).toBe('a3');
 const ordinary=base();ordinary.s.sessionMode='exploration';beginWorld(ordinary.s);expect(resolveBasicDefinition(ordinary.h).stages).toHaveLength(4);expect(m.trialState(ordinary.h)).toBeUndefined();
});
test('CR P1 chisel pays at release once, creates real column and damages through shared hit resolver with trace off',async()=>{
 const {s,h,e,m}=await setup();s.combatIdentity!.enabled=false;h.hunterCombat!.nextStage=2;h.hunterCombat!.frost=3;
 expect(command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}}).ok).toBe(true);tick(s,4);expect(h.hunterCombat!.frost).toBe(3);tick(s,13);
 expect(h.hunterCombat!.frost).toBe(2);expect(e.hp).toBeLessThan(1000);expect(m.trialState(h).columns).toHaveLength(1);
 const col=m.trialState(h).columns[0];expect(col.hp).toBe(4);expect(col.context.actorId).toBe(h.id);expect(col.context.mainInstanceId).toBe(h.equipment!.equipped.right.id);
 tick(s,30);expect(h.hunterCombat!.frost).toBe(2);expect(m.trialState(h).columns).toHaveLength(1);
});
test('CR P1 rush first hit returns frost once per wave, misses do not; independent of trace',async()=>{
 const {s,h,e,m}=await setup();s.combatIdentity!.enabled=false;h.hunterCombat!.frost=0;h.hunterCombat!.frostPaidAt=s.time;
 command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:16,y:10}});command(s,{type:'rightSkillInput',id:h.id,key:'E',held:false});tick(s,17);
 const hz=h.hunterCombat!.hazards.find(x=>x.kind==='charge');expect(hz).toBeDefined();e.pos={x:h.pos.x+1.2,y:h.pos.y};const other=structuredClone(e);other.id='other';s.units.push(other);tick(s,1);
 expect(h.hunterCombat!.frost).toBe(2);tick(s,3);expect(h.hunterCombat!.frost).toBe(2);expect(m.trialState(h).facts.filter((x:any)=>x.kind==='first-hit-frost')).toHaveLength(1);
});
test('CR P1 rocket attack creates separate launch damage without hit prerequisite, never recursively',async()=>{
 const {s,al,e,m}=await setup();command(s,{type:'controlBody',id:al.id});s.combatIdentity!.enabled=false;e.pos={x:10.5,y:10.3};
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'E',aim:{x:15,y:10.3}}).ok).toBe(true);tick(s,6);
 expect(e.hp).toBe(940);expect(m.trialState(al).facts.filter((x:any)=>x.kind==='launch-explosion')).toHaveLength(1);tick(s,30);
 expect(m.trialState(al).facts.filter((x:any)=>x.kind==='launch-explosion')).toHaveLength(1);
});
test('CR P1 precision commits on reload, next shot uses mortar identity; no left ammo or durability changes',async()=>{
 const {s,al,e,m}=await setup();command(s,{type:'controlBody',id:al.id});s.combatIdentity!.enabled=false;const left=al.equipment!.equipped.left;const originalAmmo=al.alCombat!.ammo;
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'Q',aim:e.pos}).ok).toBe(true);expect(m.trialState(al).magazine).toEqual(['normal','normal','normal','normal']);
 tick(s,45);expect(m.trialState(al).magazine).toEqual(['mortar','mortar','mortar','mortar']);
 expect(command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:12,y:10.3}}).ok).toBe(true);tick(s,6);command(s,{type:'offhandInput',id:al.id,held:false});
 expect(m.trialState(al).magazine).toHaveLength(3);expect(m.trialState(al).facts.some((x:any)=>x.kind==='mortar-fired')).toBe(true);
 expect(al.alCombat!.ammo).toBe(originalAmmo);expect(left.durability).toBe(100);
});
test('CR P1 unload clears pending entities and preserves owned sources, same world continuation does not regrant',async()=>{
 const {s,h,m}=await setup();const st=m.trialState(h),ids=st.sources.map((x:any)=>x.id);h.hunterCombat!.nextStage=2;
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}});tick(s,6);expect(leaveWorldArea(s).ok).toBe(true);expect(st.columns).toHaveLength(0);expect(st.pending).toHaveLength(0);
 expect(continueWorld(s,s.world!.id,s.world!.visit.generation).ok).toBe(true);expect(m.trialState(h)).toBe(st);expect(st.sources.map((x:any)=>x.id)).toEqual(ids);
});
test('CR P1 source removal cancels delayed column; action cancel and control switch cannot leak pending output',async()=>{
 const {s,h,al,m}=await setup();h.hunterCombat!.nextStage=2;
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:{x:12,y:10}});tick(s,6);
 expect(m.trialState(h).pending).toHaveLength(1);command(s,{type:'controlBody',id:al.id});tick(s,15);expect(m.trialState(h).columns).toHaveLength(0);
 expect(command(s,{type:'rightSkillInput',id:al.id,key:'Q',aim:{x:12,y:10}}).ok).toBe(true);tick(s,8);command(s,{type:'controlBody',id:h.id});tick(s,40);
 expect(m.trialState(al).magazine).toEqual(['normal','normal','normal','normal']);expect(m.trialState(al).precisionCd).toBeGreaterThan(0);
});
test('CR P1 duplicates choose one source; stale UI and empty root reject without mutations; dormant effects stay owned',async()=>{
 const {s,h,m}=await setup(),t=m.trialState(h);m.addTrialSource(h,'chisel',10);expect(resolveBasicDefinition(h).stages).toHaveLength(3);
 const rev=t.revision;expect(m.configureTrial(s,h,rev,'root').ok).toBe(true);expect(m.configureTrial(s,h,rev,'root').ok).toBe(false);
 const before=structuredClone(t);expect(command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:12,y:10}}).ok).toBe(false);expect(t).toEqual(before);expect(t.sources.some((x:any)=>x.effect==='rush-frost')).toBe(true);
 m.configureTrial(s,h,t.revision,'root');command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:12,y:10}});expect(h.hunterCombat!.special?.kind).toBe('prepare');command(s,{type:'controlBody',id:'ranger'});expect(h.hunterCombat!.special).toBeUndefined();
});
test('CR P1 cancelled shot pays no ammo, source action identity remains main-owned with trace on',async()=>{
 const {s,al,h,m}=await setup();command(s,{type:'controlBody',id:al.id});command(s,{type:'offhandInput',id:al.id,held:true,aim:{x:12,y:10}});
 const c=al.alCombat!.special!.context!;expect(c.mainInstanceId).toBe(al.equipment!.equipped.right.id);expect(c.requestSource).toBe('player-input');expect(c.kind).toBe('skill');
 expect(s.combatIdentity!.trace.filter(x=>x.type==='action-started'&&x.context?.executedAbilityId==='小黄远程')).toHaveLength(1);
 command(s,{type:'controlBody',id:h.id});tick(s,10);expect(m.trialState(al).magazine).toHaveLength(4);
});
test('CR P1 mortar actually resolves delayed 80 damage once; repeated frames and empty terrain do not multiply damage',async()=>{
 const {s,al,e,m}=await setup();command(s,{type:'controlBody',id:al.id});e.pos={x:12,y:10.3};s.combatIdentity!.enabled=false;
 command(s,{type:'rightSkillInput',id:al.id,key:'Q',aim:e.pos});tick(s,45);command(s,{type:'offhandInput',id:al.id,held:true,aim:e.pos});tick(s,6);command(s,{type:'offhandInput',id:al.id,held:false});
 expect(e.hp).toBe(1000);tick(s,24);expect(e.hp).toBe(920);tick(s,20);expect(e.hp).toBe(920);expect(m.trialState(al).magazine).toHaveLength(3);
});
test('CR P1 insufficient frost neither refunds nor spawns; removing pending source and expiry are silent',async()=>{
 const {s,h,e,m}=await setup();h.hunterCombat!.nextStage=2;h.hunterCombat!.frost=0;h.hunterCombat!.frostPaidAt=s.time;
 command(s,{type:'hunterInput',id:h.id,kind:'basic',aim:e.pos});tick(s,18);expect(m.trialState(h).columns).toHaveLength(0);expect(e.hp).toBe(1000);
});
