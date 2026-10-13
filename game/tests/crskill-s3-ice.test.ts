import {test,expect} from 'vitest';
import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {step,command} from '../src/core/engine';
import {hunterState} from '../src/core/hunter-state';
import {trialState,clearTrialVisit} from '../src/core/ability-trial';
import {quoteTrial,upgradeTrialSkill} from '../src/core/trial-progression';
function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);a.s.combatIdentity!.enabled=false;a.e.ready=100;a.e.hp=a.e.maxHp=1000;for(const b of ['破阵猛冲1','破阵猛冲3','破阵猛冲5'])expect(upgradeTrialSkill(a.s,quoteTrial(a.s,a.h),'E',b).ok).toBe(true);return a;}
test('S3 ice trail follows initial backstep for .2 seconds with native sampled-distance accumulator, not later forward rush',()=>{
 const {s,h}=setup();const origin={...h.pos};command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:16,y:10}});for(let i=0;i<15;i++)step(s,.02);
 const areas=trialState(h)!.iceAreas!;expect(areas.length).toBeGreaterThan(1);const count=areas.length;expect(areas[0].pos).toEqual(origin);expect(areas[1].pos.x).toBeGreaterThan(origin.x-.5);expect(areas.every(a=>a.pos.x>=origin.x-1.7-1e-8&&a.pos.x<=origin.x)).toBe(true);command(s,{type:'rightSkillInput',id:h.id,key:'E',held:false});for(let i=0;i<40;i++)step(s,.02);expect(trialState(h)!.iceAreas).toHaveLength(count);
});
test('S3 overlapping ice areas share one slow and poison clock; leaving retracts and expiry cleans up',()=>{
 const {s,h,e}=setup();e.pos={x:9.5,y:10};command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:16,y:10}});for(let i=0;i<20;i++)step(s,.02);
 expect(e.statuses.filter(x=>x.kind==='slow')).toHaveLength(1);expect(e.statuses.find(x=>x.kind==='slow')!.power).toBe(.35);expect(e.hp).toBe(985);for(let i=0;i<11;i++)step(s,.02);expect(e.hp).toBe(970);
 e.pos={x:16,y:10};for(let i=0;i<10;i++)step(s,.02);expect(e.statuses.some(x=>x.kind==='slow')).toBe(false);expect(e.hp).toBe(970);for(let i=0;i<500;i++)step(s,.02);expect(trialState(h)!.iceAreas).toHaveLength(0);
});
test('S3 clearing visit retracts area-owned status while preserving paid skill branches',()=>{
 const {s,h,e}=setup();e.pos={x:9.5,y:10};command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:16,y:10}});for(let i=0;i<6;i++)step(s,.02);expect(e.statuses.some(x=>x.kind==='slow')).toBe(true);clearTrialVisit(h);expect(e.statuses.some(x=>x.kind==='slow')).toBe(false);expect(trialState(h)!.loadout!.skills.rush!.level).toBe(3);
});
test('S3 aura waits for native .1 scan; periodic frost damage stays direction-neutral without posture or reclaim',()=>{
 const {s,h,e}=setup();e.pos={x:9.5,y:10};e.directionalProfileId='heavy-rear-core';e.heading=Math.PI;const posture=e.posture;h.hp=200;h.grayHp=100;
 command(s,{type:'rightSkillInput',id:h.id,key:'E',aim:{x:16,y:10}});step(s,.08);expect(e.hp).toBe(1000);step(s,.04);expect(e.hp).toBe(985);expect(e.posture).toBe(posture);expect(h.hp).toBe(200);expect(s.combatEvents!.at(-1)!.directionNeutral).toBe(true);
});
