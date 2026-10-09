import {describe,it,expect} from 'vitest';
import {createExplorationEntry,createGame,command,resolveHit} from '../src/core/engine';
import {eventCard} from '../src/core/cards';
import type {Command} from '../src/core/types';
const start=()=>{const s=createExplorationEntry();expect(command(s,{type:'selectExplorationCompanion',id:'ranger'}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);return s;};
const retired:Command[]=[{type:'party',kind:'recall'},{type:'party',kind:'regroup'},{type:'collect',id:'ranger'},{type:'clone',id:'ranger',to:{x:6,y:8}},{type:'draw'},{type:'card',cardId:'old',to:{x:6,y:8}},{type:'sellCard',cardId:'old'},{type:'enter',node:1},{type:'rescue',id:'ranger'},{type:'deploy',id:'ranger',to:{x:6,y:8},facing:'east'},{type:'selectJourney',journey:'tower'}];
describe('CL01B-A retired producers and atomic command boundary',()=>{
 it('ordinary carry creates a world without scene cards or pending card rewards',()=>{const s=start();expect(s.world?.visit.active).toBe(true);expect(s.cards).toEqual([]);expect(s.economy.pending).toEqual([]);expect(s.economy.cardEvents).toEqual([]);});
 it('twelve genuine lethal resolutions keep kill income without exclusive card rewards',()=>{
  const s=start(),h=s.units.find(u=>u.id==='hunter')!,enemies=s.units.filter(u=>u.team==='enemy').slice(0,12);
  for(const e of enemies){e.hp=1;resolveHit(s,e,{...h.weapons[0],damage:100000,break:0},1,h);expect(e.life).toBe('dead');}
  expect(s.kills).toBe(12);expect(s.fragments).toBe(48);expect(s.economy.rewards).toHaveLength(12);expect(s.cards).toEqual([]);expect(s.economy.pending).toEqual([]);expect(s.economy.cardEvents).toEqual([]);
 });
 it.each(retired)('rejects $type without mutating any world, balance, actor or log state',c=>{const s=start(),before=JSON.stringify(s);expect(command(s,c).ok).toBe(false);expect(JSON.stringify(s)).toBe(before);});
 it('leave, continue and new-world keep formal card producers disabled',()=>{
  const s=start();s.context='explorationIdle';for(const u of s.units.filter(u=>u.team==='ally'&&u.life==='active'))u.pos={...s.goal,x:s.goal.x+(u.id==='hunter'?0:.8)};
  expect(command(s,{type:'exitExploration'}).ok).toBe(true);expect(command(s,{type:'continueWorld',worldId:s.world!.id,visit:s.world!.visit.generation}).ok).toBe(true);
  eventCard(s,'late-historical-reward','power','exclusive','hunter');expect(s.cards).toEqual([]);expect(s.economy.cardEvents).toEqual([]);
  expect(command(s,{type:'restartWorld',worldId:s.world!.id}).ok).toBe(true);expect(command(s,{type:'selectExplorationCompanion',id:'ranger'}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);expect(s.cards).toEqual([]);
 });
 it('isolated historical core fixtures retain event cards for shared tests',()=>{const s=createGame();command(s,{type:'carry',gold:0,vitality:0});expect(s.cards).toHaveLength(1);expect(s.economy.cardEvents).toHaveLength(1);});
});
