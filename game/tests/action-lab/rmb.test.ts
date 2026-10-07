import {it,expect} from 'vitest';
import {LabWorld} from '../../src/action-lab/runtime/world';
const yellow=()=>{const w=new LabWorld();w.setPlayer('cannoneer');w.enemy.enabled=false;w.aim={x:-1,y:0};return w;};
it('native iron round uses speed30 and range5.6 instead of the slow SAMPLE ball',()=>{
 const w=yellow();w.shield(true);w.shield(false);w.advance(.05);
 const shot=w.projectiles.entities[0],x=shot.position.x;
 w.advance(.05);expect(x-shot.position.x).toBeCloseTo(1.5,6);
 expect(shot.sourceSkillId).toBe('小黄远程');
 expect(w.log.find(e=>e.eventKind==='accepted')?.slotSkillId).toBe('小黄远程找子弹');
 w.advance(.15);expect(w.projectiles.entities).toEqual([]);
 expect(w.log.filter(e=>e.eventKind==='resource-payment')).toHaveLength(1);
});
