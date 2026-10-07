import {it,expect} from 'vitest';
import {LabWorld} from '../../src/action-lab/runtime/world';
import {rmbAudioCues} from '../../src/action-lab/presentation/rmb-audio';
it('one real iron round routes one firearm cue, never payment and projectile duplicate release',()=>{
 const w=new LabWorld();w.setPlayer('cannoneer');w.enemy.enabled=false;w.aim={x:-1,y:0};w.shield(true);w.shield(false);w.advance(.1);
 const cues=w.log.flatMap(e=>rmbAudioCues(e)??[]);expect(cues).toEqual(['yellow.fire']);
 expect(w.log.find(e=>e.eventKind==='attack-event')?.slotSkillId).toBe('小黄远程找子弹');
});
it('source-specific routing leaves blue release and unrelated rocket events to the existing pipeline',()=>{
 const w=new LabWorld();w.enemy.enabled=false;w.press();w.release();w.advance(.2);
 for(const e of w.log)expect(rmbAudioCues(e)).toBeNull();
 w.setPlayer('cannoneer');w.prepareActive();w.advance(.2);
 for(const e of w.log)expect(rmbAudioCues(e)).toBeNull();
});
it('taking damage while a gun action is current still routes the original hurt sound',()=>{
 const w=new LabWorld();w.setPlayer('cannoneer');w.shield(true);w.note(w.player,'hurt','enemy contact');
 expect(rmbAudioCues(w.log.at(-1)!)).toBeNull();
});
it('reload sound follows native completion effect rather than guessed reload start',()=>{
 const w=new LabWorld();w.setPlayer('cannoneer');w.enemy.enabled=false;w.aim={x:-1,y:0};w.shield(true);w.advance(2);w.shield(false);w.advance(1.2);
 expect(rmbAudioCues(w.log.find(e=>e.eventKind==='reload-start')!)).toEqual([]);
 expect(rmbAudioCues(w.log.find(e=>e.eventKind==='reload-complete')!)).toEqual(['yellow.reload']);
});
