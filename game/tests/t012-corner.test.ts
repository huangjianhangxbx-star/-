import {test,expect} from 'vitest';
import {createGame,command,step,canHit} from '../src/core/engine';
import {clearShot,distance,terrainFits} from '../src/core/spatial';

// Catches sampled LOS skipping a thin wall-corner intersection on the actual map.
test('a ranged enemy cannot shoot through the thin wall corner beside Ines',()=>{
 const s=createGame();
 expect(clearShot(s,{x:3.065,y:8},{x:2,y:7})).toBe(false);
 expect(clearShot(s,{x:2,y:7},{x:3.065,y:8})).toBe(false);
 expect(clearShot(s,{x:3.065,y:8},{x:2,y:8})).toBe(true);
});

// Catches the wrong canHit branch stopping pursuit instead of taking a legal path.
test('corner engagement resumes legal approach without extending either weapon range',()=>{
 const s=createGame();command(s,{type:'carry',gold:0,vitality:0});command(s,{type:'start'});
 s.waves=[];s.waveState=null;s.totalEnemies=999;
 s.units.forEach(u=>u.life='reserve');
 const a=s.units.find(u=>u.id==='ines')!;a.life='active';a.ready=0;a.pos={x:2,y:7};a.drawPos={...a.pos};
 const e=structuredClone(s.units[0]);Object.assign(e,{id:'corner-ranged',team:'enemy',role:'ranged',life:'active',ready:0,pos:{x:3.065,y:8},drawPos:{x:3.065,y:8},route:[{x:2,y:8},{x:2,y:7},{x:2,y:5}],routeIndex:0,path:[],destination:null,hp:120,maxHp:120});
 e.weapons.forEach(w=>{w.range=4;w.remote=true;w.damage=9;});s.units.push(e);
 expect(canHit(s,e,a)).toBe(false);
 command(s,{type:'partySelection',id:a.id});const origin={...e.pos};step(s,.5);
 expect(distance(e.pos,origin)).toBeGreaterThan(.01);
 expect(canHit(s,e,a)).toBe(true);
 expect(terrainFits(s,e.pos,undefined,true,true)).toBe(true);
 expect(e.weapons[0].range).toBe(4);expect(a.weapons[0].range).toBe(1.2);
});
