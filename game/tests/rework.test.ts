import {describe,it,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
import {currentSkill} from '../src/core/progression';

describe('new roster and independent charging',()=>{
 it('deploys the new four-person roster with scythe default without deleting legacy guard content',()=>{
  const s=createGame();expect(s.units.map(u=>u.name)).toEqual(['猎人','菲奥蕾','伊内丝','阿尔']);
  expect(s.units[1].asset).toBe('Charlotte');expect(s.units[2].asset).toBe('Rina_F_Summer');
  expect(s.units[1].weapons[s.units[1].weaponIndex].profession).toBe('scythe');
 });
 it('does not fill pain marks via a cooldown card or elapsed time',()=>{
  const s=createGame(),u=s.units[2];u.life='active';u.ready=0;s.phase='battle';
  const c=s.cards.find(c=>c.kind==='cooldown')!;command(s,{type:'card',cardId:c.id,to:u.pos,targetId:u.id});step(s,1);
  expect(currentSkill(u).counter).toBe(0);expect(command(s,{type:'skill',id:u.id}).ok).toBe(false);
 });
});
