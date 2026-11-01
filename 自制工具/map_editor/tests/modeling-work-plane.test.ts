import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ModelingWorkPlane} from '../desktop/modeling-work-plane.ts';
test('each signed drawing direction recalls its own layer, including after reopening',()=>{
 const p=new ModelingWorkPlane();p.setLevel(28);p.choose(0);assert.equal(p.level,0);p.setLevel(-2);p.choose(5);p.setLevel(7);p.choose(4);assert.equal(p.level,28);p.choose(0);assert.equal(p.level,-2);
 const restored=new ModelingWorkPlane(JSON.stringify(p.snapshot()));assert.equal(restored.face,0);assert.equal(restored.level,-2);restored.choose(5);assert.equal(restored.level,7);restored.choose(4);assert.equal(restored.level,28);
});
test('invalid saved layers do not poison drawing coordinates',()=>{
 const p=new ModelingWorkPlane('{bad json');assert.equal(p.face,4);assert.equal(p.level,0);assert.throws(()=>p.choose(6));assert.throws(()=>p.setLevel(.5));assert.throws(()=>p.setLevel(8193));
});
