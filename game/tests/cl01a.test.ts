import {describe,it,expect} from 'vitest';
import {createGame,command,step} from '../src/core/engine';
function official(){const s=createGame();(s as any).sessionMode='exploration';command(s,{type:'selectJourney',journey:'exploration'});command(s,{type:'selectExplorationCompanion',id:'ranger'});command(s,{type:'carry',gold:0,vitality:0});return s;}
const retired:any[]=[{type:'start'},{type:'deploy',id:'ranger',to:{x:2,y:2},facing:'south'},{type:'party',kind:'recall'},{type:'party',kind:'regroup'},{type:'collect',id:'ranger'},{type:'extract',id:'ranger',via:'shadow'},{type:'rescue',id:'ranger'},{type:'clone',id:'ranger',to:{x:2,y:2}},{type:'destroyClone',id:'ranger'},{type:'draw'},{type:'sellCard',cardId:'none'},{type:'card',cardId:'none',to:{x:2,y:2}},{type:'selectJourney',journey:'tower'},{type:'enter',node:1},{type:'rest'},{type:'continue'},{type:'enterExplorationNode'},{type:'leaveExplorationNode'}];
describe('CL01A official session capability boundary',()=>{
 it.each(retired)('rejects retired $type before resources or membership change',c=>{
  const s=official(),before=JSON.stringify({units:s.units,cards:s.cards,economy:s.economy,fragments:s.fragments,phase:s.phase,journey:s.journey});
  const r=command(s,c);expect(r.ok).toBe(false);expect(r.reason).toContain('正式探索');expect(JSON.stringify({units:s.units,cards:s.cards,economy:s.economy,fragments:s.fragments,phase:s.phase,journey:s.journey})).toBe(before);
 });
 it('preserves official capability and exploration entry after abandoning and restarting',()=>{
  const s=official();expect(command(s,{type:'abandon'}).ok).toBe(true);expect(command(s,{type:'newExpedition'}).ok).toBe(true);expect((s as any).sessionMode).toBe('exploration');expect(s.journey).toBe('exploration');expect(command(s,{type:'selectJourney',journey:'tower'}).ok).toBe(false);
 });
 it('retains explicit legacy core behavior without granting official access',()=>{const s=createGame();expect(command(s,{type:'selectJourney',journey:'tower'}).ok).toBe(true);expect(command(s,{type:'carry',gold:0,vitality:0}).ok).toBe(true);expect(s.phase).toBe('briefing');expect(command(s,{type:'start'}).ok).toBe(true);step(s,.1);expect(s.time).toBeGreaterThan(0);});
 it('retains Z control, F path aim, and G gather as distinct current commands',()=>{const s=official();expect(command(s,{type:'controlBody',id:'ranger'}).ok).toBe(true);expect(command(s,{type:'beginExplorationAim',id:'ranger',kind:'path',source:'direct'}).ok).toBe(true);expect(command(s,{type:'cancelExplorationAim'}).ok).toBe(true);expect(command(s,{type:'partyTactic',issuerId:'ranger',recipientId:'hunter',kind:'rally',requestId:1,expectedControlRevision:s.controlRevision??0}).ok).toBe(true);});
});
