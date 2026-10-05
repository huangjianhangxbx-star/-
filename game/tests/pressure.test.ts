import {describe,it,expect} from 'vitest';
import type {Unit,GameState} from '../src/core/types';
import {resetPressure,applyPosture,tickPressure,recordHealthLoss,healHealth,reclaimHealth} from '../src/core/pressure';

const unit=()=>({team:'ally',role:'hunter',life:'active',id:'hunter',hp:200,maxHp:360,weapons:[],weaponIndex:0} as unknown as Unit);
describe('pressure and recoverable life',()=>{
 it('zero posture is broken, and only a later positive hit staggers without refreshing',()=>{
  const u=unit();resetPressure(u);expect(applyPosture(u,90)).toEqual({applied:90,becameBroken:true,breakReaction:false});expect(u.posture).toBe(0);expect(u.stagger).toBe(0);
  expect(applyPosture(u,0).breakReaction).toBe(false);expect(applyPosture(u,1).breakReaction).toBe(true);tickPressure(u,.2);
  expect(applyPosture(u,10).breakReaction).toBe(false);expect(u.stagger).toBeCloseTo(.4);tickPressure(u,.4);
  expect(u.posture).toBe(45);expect(u.stagger).toBe(0);tickPressure(u,1.5);expect(u.posture).toBe(45);tickPressure(u,1);expect(u.posture).toBeCloseTo(67.5);
 });
 it('recovery uses only time past the delay, independent of caller step size',()=>{
  const a=unit(),b=unit();resetPressure(a);resetPressure(b);applyPosture(a,60);applyPosture(b,60);
  tickPressure(a,2);for(let i=0;i<40;i++)tickPressure(b,.05);
  expect(a.posture).toBeCloseTo(41.25);expect(b.posture).toBeCloseTo(a.posture);
 });
 it('only recorded real health loss creates gray life and ordinary healing clamps it',()=>{
  const u=unit();resetPressure(u);recordHealthLoss(u,0);expect(u.grayHp).toBe(0);
  recordHealthLoss(u,40);expect(u.grayHp).toBe(40);healHealth(u,150);expect(u.hp).toBe(350);expect(u.grayHp).toBe(10);
  tickPressure(u,4);expect(u.grayHp).toBe(10);tickPressure(u,.2);expect(u.grayHp).toBeCloseTo(2.8);
 });
 it('all targets and delayed hits in a cast share one finite reclaim budget',()=>{
  const u=unit();resetPressure(u);recordHealthLoss(u,160);const s={units:[u]} as GameState;
  for(let i=0;i<100;i++)reclaimHealth(s,u,10,8,.1,.5);
  expect(u.hp).toBe(236);expect(u.grayHp).toBe(124);
  reclaimHealth(s,u,100,9,.05,.5);expect(u.hp).toBe(254);expect(u.grayHp).toBe(106);
 });
 it('dead, removed sources and enemies cannot convert gray life into resurrection',()=>{
  const u=unit();resetPressure(u);recordHealthLoss(u,80);const s={units:[u]} as GameState;
  u.life='downed';reclaimHealth(s,u,100,1,.1,.5);expect(u.hp).toBe(200);
  u.life='active';s.units=[];reclaimHealth(s,u,100,2,.1,.5);expect(u.hp).toBe(200);
  s.units=[u];u.team='enemy';reclaimHealth(s,u,100,3,.1,.5);expect(u.hp).toBe(200);
 });
 it('ordinary shadow residents freeze clocks while Fiorre advances and clamps missing life',()=>{
  const a=unit(),b=unit();b.role='fiorre';for(const u of [a,b]){resetPressure(u);applyPosture(u,40);recordHealthLoss(u,80);u.shadowResident=true;u.life='withdrawn';}
  tickPressure(a,5);tickPressure(b,5);expect(a.grayHp).toBe(80);expect(a.posture).toBe(50);expect(b.grayHp).toBe(44);expect(b.posture).toBe(b.maxPosture);
 });
 it('node/death reset removes gray life and stagger without healing',()=>{
  const u=unit();resetPressure(u);applyPosture(u,100);applyPosture(u,1);recordHealthLoss(u,80);resetPressure(u);
  expect(u.hp).toBe(200);expect(u.grayHp).toBe(0);expect(u.stagger).toBe(0);expect(u.posture).toBe(90);
 });
});
