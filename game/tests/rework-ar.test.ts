import {describe,it,expect} from 'vitest';
import {arena,foe} from './rework-fixtures';
import {command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';
function ar(){const s=arena(),u=s.units[3];u.life='active';u.pos={x:5,y:5};u.skillId='rain';currentSkill(u).cd=0;u.weapons[0].damage=40;u.weapons[0].shadow=false;return {s,u};}
describe('arrow rain deterministic slots and individual defenses',()=>{
 for(const increments of [[1],Array(20).fill(.05),Array(100).fill(.01)])it(`fires 125 independent arrows per second with ${increments.length} calls`,()=>{
  const {s,u}=ar(),e=foe(s,7,5);for(const dt of increments)step(s,dt);
  expect(s.stats.rainArrows).toBe(125);expect(e.hp).toBeCloseTo(9875);expect(u.weapons[0].durability).toBe(60);
  expect(s.combatEvents?.filter(e=>e.kind==='arrow').map(e=>e.at).slice(0,3)).toEqual([0,.008,.016]);
 });
 it('does not aggregate low-damage arrows before defense, and a full window has 750 slots',()=>{
  const {s,u}=ar(),e=foe(s,7,5);e.defense={subtype:'pierce',flat:3};step(s,6);expect(s.stats.rainArrows).toBe(750);expect(e.hp).toBe(10000);expect(currentSkill(u).run).toBeUndefined();expect(u.skillCd).toBeCloseTo(24);
 });
 it('opens while empty, discards missing-target slots and only uses the remaining window',()=>{
  const {s,u}=ar();step(s,4);expect(u.skillTime).toBeCloseTo(2);const e=foe(s,7,5);step(s,2);expect(s.stats.rainArrows).toBe(250);expect(e.hp).toBeCloseTo(9750);
 });
 it('keeps side-arrow base separate when a wedge triggers it and never grants durability events',()=>{
  const {s,u}=ar(),e=foe(s,7,5),other=foe(s,7,5.8);const st=currentSkill(u);st.stage=2;st.branches={A:1,B:2};step(s,.192);
  expect(st.run?.fired).toBe(24);expect(e.hp).toBeCloseTo(9967);expect(other.hp).toBeCloseTo(9998.8);expect(e.statuses.some(b=>b.kind==='slow'&&b.power===.4)).toBe(true);
 });
 it('retargets after death in the same tick and does not auto-fire through a wall',()=>{
  const {s}=ar(),e=foe(s,6,5),other=foe(s,7,5);e.hp=2;step(s,.05);expect(e.life).toBe('dead');expect(other.hp).toBe(9995);
  s.tiles.find(t=>t.x===6&&t.y===5)!.obstacle=true;const hp=other.hp;step(s,.5);expect(other.hp).toBe(hp);
 });
 it('direct movement and stun discard firing slots without extending or backfilling an open window',()=>{const {s,u}=ar();foe(s,7,5);step(s,.4);expect(s.stats.rainArrows).toBe(50);command(s,{type:'direct',id:u.id,direction:{x:0,y:1}});step(s,.5);expect(u.skillTime).toBeCloseTo(5.1);expect(s.stats.rainArrows).toBe(50);command(s,{type:'direct',id:u.id,direction:null});u.statuses.push({kind:'stun',power:0,remaining:.5});step(s,.2);expect(u.skillTime).toBeCloseTo(4.9);expect(s.stats.rainArrows).toBe(50);u.statuses=[];step(s,.016);expect(s.stats.rainArrows).toBe(52);});
 it('starting an ordinary layer crossing ends the finite window, without letting automatic fire take over the fade',()=>{const {s,u}=ar();step(s,.1);s.tiles.find(t=>t.x===6&&t.y===5)!.layer=1;expect(command(s,{type:'move',id:u.id,to:{x:6,y:5}}).ok).toBe(true);expect(currentSkill(u).run).toBeDefined();step(s,2);expect(currentSkill(u).run).toBeUndefined();expect(u.skillCd).toBeGreaterThan(20);});
});
describe('sniper original and derived attacks',()=>{
 it('keeps old T0 power and fires T1 pierce / T2 delayed line without extra durability or recursive branches',()=>{
  const {s,u}=ar();u.skillId='snipe';u.attackTimer=0;const st=currentSkill(u);st.enabled=true;st.stage=2;const e=foe(s,7,5),behind=foe(s,8,5);step(s,.31);
  expect(e.hp).toBe(9860);expect(behind.hp).toBe(9951);expect(u.weapons[0].durability).toBe(59);step(s,.4);expect(e.hp).toBe(9825);expect(behind.hp).toBe(9916);expect(u.weapons[0].durability).toBe(59);
 });
 it('new branches only work in active sniper mode and relay kills do not recurse',()=>{
  const {s,u}=ar();u.skillId='snipe';u.attackTimer=0;const st=currentSkill(u);st.branches={A:2,C:2};const e=foe(s,6,5);e.defense={subtype:'pierce',flat:10};step(s,.31);expect(e.hp).toBe(9970);
  st.enabled=true;e.hp=1;u.attackTimer=0;const other=foe(s,7,5),third=foe(s,7.8,5);other.hp=1;step(s,.31);expect(other.life).toBe('dead');expect(third.hp).toBe(10000);
 });
});
