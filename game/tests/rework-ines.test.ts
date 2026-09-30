import {describe,it,expect} from 'vitest';
import * as engine from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
import {damageAfterDefense} from '../src/core/combat-config';
import type {GameState,Unit,Weapon} from '../src/core/types';
import {arena,foe} from './rework-fixtures';
const w:Weapon={name:'test blade',damage:10,range:1,remote:false,width:0,durability:100,maxDurability:100,shadow:false,subtype:'impact',damageKind:'physical'};
describe('Ines direct hits and healing pulses',()=>{
 it('uses the recorded shieldguard weapon subtype and unchanged guard identity stays available off-roster',()=>{const s=engine.createGame(),u=s.units[2];expect(u.weapons[0].subtype).toBe('impact');expect(engine.createLegacyGuard().role).toBe('guard');});
 it('deduplicates original hits before dodge and independently of the bounded diagnostic log',()=>{const s=arena(),u=s.units[2],e=foe(s);u.life='active';u.dodge=1;engine.resolveHit(s,u,w,10,e,{eventId:99999});u.dodge=0;engine.resolveHit(s,u,w,10,e,{eventId:99999});expect(currentSkill(u).counter).toBe(0);engine.resolveHit(s,u,w,0,e,{eventId:99998});for(let i=0;i<1100;i++)engine.resolveHit(s,e,w,0,u);currentSkill(u).counter=0;engine.resolveHit(s,u,w,0,e,{eventId:99998});expect(currentSkill(u).counter).toBe(0);});
 it('counts shielded and fully defended direct hits once, excludes dodge and derived damage',()=>{
  const s=arena(),u=s.units[2],e=foe(s);u.life='active';u.pos={x:5,y:5};u.defense={subtype:'impact',flat:100};u.statuses.push({kind:'shield',power:100,remaining:5});
  engine.resolveHit(s,u,w,10,e,{eventId:10});engine.resolveHit(s,u,w,10,e,{eventId:10});
  expect(currentSkill(u).counter).toBe(1);u.defense.flat=0;engine.resolveHit(s,u,w,10,e);expect(currentSkill(u).counter).toBe(2);expect(u.hp).toBe(800);
  engine.resolveHit(s,u,w,10,e,{derived:true});expect(currentSkill(u).counter).toBe(2);u.dodge=1;engine.resolveHit(s,u,w,10,e);expect(currentSkill(u).counter).toBe(2);
 });
 it('consumes all marks, heals legal allies, echoes from original position and turns overheal into a capped shield',()=>{
  const s=arena(),u=s.units[2],a=s.units[0];u.life=a.life='active';u.pos={x:5,y:5};a.pos={x:6,y:5};a.hp=100;
  const st=currentSkill(u);st.counter=8;st.stage=2;st.branches={A:2,C:2};
  expect(engine.command(s,{type:'skill',id:u.id}).ok).toBe(true);expect(st.counter).toBe(0);expect(a.hp).toBeCloseTo(228);
  expect(u.statuses.find(b=>b.kind==='shield')?.power).toBeCloseTo(96);expect(u.statuses.some(b=>b.kind==='warding')).toBe(true);
  u.pos={x:12,y:5};engine.step(s,1.45);expect(a.hp).toBeCloseTo(304.8);expect(engine.command(s,{type:'skill',id:u.id}).ok).toBe(false);
 });
 it('selects distinct lowest percentage allies per wave for the extra heal',()=>{
  const s=arena(),u=s.units[2],a=s.units[0],b=s.units[1];for(const x of [u,a,b]){x.life='active';x.pos={x:5,y:5};}a.hp=10;b.hp=20;u.hp=500;const st=currentSkill(u);st.counter=5;st.branches={B:2};
  engine.command(s,{type:'skill',id:u.id});expect(a.hp).toBeCloseTo(134);expect(b.hp).toBeCloseTo(120);expect(u.hp).toBeCloseTo(580);
 });
});
describe('sanctuary field',()=>{
 it('heals every half second and changes the actual matching fixed defense, then removes growing stacks on exit',()=>{
  const s=arena(),u=s.units[2],e=foe(s);u.life='active';u.pos={x:5,y:5};u.hp=400;u.skillId='sanctuary';const st=currentSkill(u);st.cd=0;st.stage=2;st.branches={A:2,B:2};e.defense={subtype:'pierce',flat:10};
  expect(engine.command(s,{type:'skill',id:u.id}).ok).toBe(true);engine.step(s,.5);expect(u.hp).toBeCloseTo(404);expect(e.statuses.some(b=>b.kind==='slow'&&b.power===.8)).toBe(true);
  expect(damageAfterDefense({...w,subtype:'pierce'},e,20)).toBeCloseTo(14);
  engine.step(s,6);expect(damageAfterDefense({...w,subtype:'pierce'},e,20)).toBeCloseTo(17);e.pos={x:11,y:5};engine.step(s,.05);expect(damageAfterDefense({...w,subtype:'pierce'},e,20)).toBeCloseTo(12.5);engine.step(s,2.05);expect(damageAfterDefense({...w,subtype:'pierce'},e,20)).toBe(10);
 });
 it('does not stack multiple resistance fields and a wall rejects enemy debuffs but not allied healing',()=>{
  const s=arena(),u=s.units[2],e=foe(s),a=s.units[0];u.life=a.life='active';u.pos={x:5,y:5};a.pos={x:6,y:5};a.hp=100;u.skillId='sanctuary';currentSkill(u).cd=0;s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;
  engine.command(s,{type:'skill',id:u.id});engine.step(s,.5);expect(a.hp).toBe(104);expect(e.statuses.some(b=>b.kind==='resistBreak')).toBe(false);
  e.statuses=[{kind:'resistBreak',power:.25,remaining:2},{kind:'resistBreak',power:.4,remaining:2}];e.defense={subtype:'impact',flat:10};expect(damageAfterDefense(w,e,20)).toBe(14);
 });
});
