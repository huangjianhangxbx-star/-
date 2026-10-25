import test from 'node:test';
import assert from 'node:assert/strict';
import { layerStack, composeLayers, editLayer, layerCommand } from '../core/paint-layers.ts';
import { validateSurfacePaint, filterPaint, remapPaint, type SurfacePaint } from '../core/surface-paint.ts';
const source = ():SurfacePaint => ({schema:'xinghai-surface-paint-1',density:64,faces:{'0,0,0,4':{'0':'#ff0000'}}});
test('layers preserve covered paint, erase reveals lower layer, hidden merge is rejected',()=>{
 let p=layerCommand(source(),{kind:'add',id:'top',name:'细节'});
 p=editLayer(p,'top',{...source(),faces:{'0,0,0,4':{'0':'#0000ff'}}});
 assert.equal(p.faces['0,0,0,4']['0'],'#0000ff');
 const erased=editLayer(p,'top',{...source(),faces:{}});
 assert.equal(erased.faces['0,0,0,4']['0'],'#ff0000');
 const hidden=layerCommand(p,{kind:'visible',id:'top',value:false});
 assert.equal(hidden.faces['0,0,0,4']['0'],'#ff0000');
 assert.equal(hidden.layers![1].faces['0,0,0,4']['0'],'#0000ff');
 assert.throws(()=>layerCommand(hidden,{kind:'merge',id:'top'}),/隐藏/);
 const merged=layerCommand(p,{kind:'merge',id:'top'});
 assert.equal(merged.layers!.length,1);assert.deepEqual(merged.faces,p.faces);
 assert.deepEqual(source().faces,layerStack(source())[0].faces);
});
test('hidden layer validation, filtering and rotation preserve author layers',()=>{
 let p=layerCommand(source(),{kind:'add',id:'top',name:'细节'});
 p=editLayer(p,'top',{...source(),faces:{'2,0,0,4':{'0':'#0000ff'}}});
 p=layerCommand(p,{kind:'visible',id:'top',value:false});
 validateSurfacePaint(p,.25);
 const filtered=filterPaint(p,new Set(['0,0,0']))!;
 assert.deepEqual(filtered.layers![1].faces,{});
 const moved=remapPaint(p,new Map([['2,0,0','3,0,0']]),.25)!;
 assert.ok(moved.layers![1].faces['3,0,0,4']);
 const bad=structuredClone(p);bad.layers![1].faces['2,0,0,4']['9999']='#abcdef';
 assert.throws(()=>validateSurfacePaint(bad,.25));
 assert.throws(()=>validateSurfacePaint({...p,faces:{}},.25),/合成/);
 assert.deepEqual(composeLayers(p.layers!).faces,p.faces);
});
test('layer stroke preserves unrelated composite face references for GPU reuse',()=>{
 const p=layerCommand({...source(),faces:{...source().faces,'2,0,0,4':{'0':'#abcdef'}}},{kind:'add',id:'detail'});
 const next=editLayer(p,'detail',{...source(),faces:{'0,0,0,4':{'0':'#0000ff'}}});
 assert.equal(next.faces['2,0,0,4'],p.faces['2,0,0,4']);
 assert.notEqual(next.faces['0,0,0,4'],p.faces['0,0,0,4']);
});
