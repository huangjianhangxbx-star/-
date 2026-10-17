import {describe,expect,it} from 'vitest';
import {AudioPolicy,chooseMusic,resolveBusGain} from '../src/game-audio/policy';

describe('game audio decisions',()=>{
 it('drops expired and wrong-world one-shots without a deferred queue',()=>{
  const policy=new AudioPolicy();policy.world='room-a';
  expect(policy.admit({eventId:'battle.hit',sourceId:'hunter',world:'room-b',occurredAt:1,ttl:.2},1.01).reason).toBe('wrong-world');
  expect(policy.admit({eventId:'battle.hit',sourceId:'hunter',world:'room-a',occurredAt:1,ttl:.2},1.3).reason).toBe('expired');
 });
 it('deduplicates per source while retaining another enemy warning',()=>{
  const policy=new AudioPolicy();policy.world='room';
  const event={eventId:'enemy.warning',world:'room',occurredAt:2,ttl:.3};
  expect(policy.admit({...event,sourceId:'e1'},2).reason).toBe('accepted');
  expect(policy.admit({...event,sourceId:'e1'},2.01).reason).toBe('coalesced');
  expect(policy.admit({...event,sourceId:'e2'},2.01).reason).toBe('accepted');
 });
 it('composes snapshots without overwriting user volume',()=>{
  expect(resolveBusGain(.7,'music',[{token:'dialogue',priority:1,gains:{music:.45}},{token:'pause',priority:2,gains:{music:.7}}])).toBeCloseTo(.7*.45*.7);
  expect(resolveBusGain(0,'music',[{token:'dialogue',priority:1,gains:{music:.45}}])).toBe(0);
 });
 it('uses stable music priority and re-evaluates after override',()=>{
  const state={scene:'corridor',combat:true,dialogue:false,title:false};
  expect(chooseMusic(state).id).toBe('combat');
  // FIX01: ordinary dialogue inherits scene music; its ducking belongs to a snapshot.
  expect(chooseMusic({...state,dialogue:true}).id).toBe('combat');
  expect(chooseMusic({...state,combat:false,dialogue:true}).id).toBe('explore');
  expect(chooseMusic({...state,combat:false,dialogue:false}).id).toBe('explore');
 });
});
