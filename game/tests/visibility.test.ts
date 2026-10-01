import {test,expect} from 'vitest';
import {createGame,command,step,visible,canHit} from '../src/core/engine';
import {previewState} from '../src/core/visibility';
function scene(){const s=createGame();command(s,{type:'carry',gold:0,vitality:0});s.completed.push(1);s.phase='nodes';command(s,{type:'enter',node:4});return s;}
test('unseen exploration enemies are unavailable to targeting and unknown precise navigation',()=>{const s=scene(),e=s.units.find(u=>u.team==='enemy')!;expect(visible(s,e)).toBe(false);expect(command(s,{type:'move',id:'hunter',to:{x:20,y:15}}).ok).toBe(false);});
test('only a live copy can still supply shared sight and removing it hides live targets',()=>{const s=scene(),h=s.units[0],e=s.units.find(u=>u.team==='enemy')!;h.life='withdrawn';const c={...structuredClone(h),id:'copy',cloneOf:'hunter',life:'active' as const,pos:{x:10,y:15},drawPos:{x:10,y:15}};s.units.push(c);step(s,.1);expect(visible(s,e)).toBe(true);c.life='dead';step(s,.1);expect(visible(s,e)).toBe(false);});
test('solid walls prevent shared enemy information and ranged targeting through fog',()=>{const s=scene(),h=s.units[0],e=s.units.find(u=>u.team==='enemy')!;h.pos={x:7,y:12};e.pos={x:9,y:12};expect(visible(s,e)).toBe(false);expect(canHit(s,h,e)).toBe(false);h.pos={x:9,y:12};expect(visible(s,e)).toBe(true);});
test('automatic arrow selection does not find hidden enemies inside weapon range',()=>{const s=scene(),r=s.units.find(u=>u.id==='ranger')!;r.life='active';r.ready=0;r.pos={x:5,y:15};r.drawPos={...r.pos};expect(command(s,{type:'configureSkill',id:r.id,skillId:'rain'}).ok).toBe(true);expect(r.skillId).toBe('rain');command(s,{type:'partySelection',id:r.id});r.skillCd=0;step(s,.1);expect(s.stats.rainArrows||0).toBe(0);});

test('unknown clone deployment is rejected without spending vitality',()=>{const s=scene();s.fragments=40;s.units[0].pos={x:7,y:12};expect(command(s,{type:'clone',id:'hunter',to:{x:9,y:12}}).ok).toBe(false);expect(s.fragments).toBe(40);});

test('memory path previews ignore unseen moving units while the real simulation keeps them',()=>{const s=scene(),e=s.units.find(u=>u.team==='enemy')!;s.exploration!.memory.seen.push(e.pos.x+','+e.pos.y);expect(previewState(s).units.some(u=>u.id===e.id)).toBe(false);expect(s.units).toContain(e);});
