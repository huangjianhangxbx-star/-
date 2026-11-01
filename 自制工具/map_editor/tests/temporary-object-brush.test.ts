import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type AssetDocument,type Vec3} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';

const api:any=await import('../core/temporary-object-brush.ts').catch((e:any)=>{
 if(e.code==='ERR_MODULE_NOT_FOUND')return {};
 throw e;
});
function capture(model:AssetDocument,id:string):any{
 assert.equal(typeof api.captureTemporaryObjectBrush,'function','Temporary object brush capture is missing');
 return api.captureTemporaryObjectBrush(model,id);
}
function stamp(model:AssetDocument,brush:any,target:Vec3):any{
 assert.equal(typeof api.stampTemporaryObjectBrush,'function','Temporary object brush stamping is missing');
 return api.stampTemporaryObjectBrush(model,brush,target);
}
function fixture(step=.125){
 const a=createAsset('brush-source');a.name='石块';
 a.cells=[{x:0,y:0,z:0,color:0,owner:'volume'},{x:1,y:0,z:0,color:1,owner:'volume'},{x:0,y:0,z:1,color:1,owner:'volume'},{x:5,y:0,z:0,color:0,owner:'volume'}];
 const s=new CanvasSession(a),initial=s.model.objects!.map(o=>o.objectId),body=s.joinObjects(initial.slice(0,3),initial[0])!,peer=initial[3];
 s.patch({voxelStepM:step,originTicks:[4,-8,2]});
 const c=s.model.canvases![0];
 c.paintSource=composeLayers([
  {id:'mineral',name:'矿质',visible:true,locked:false,faces:{'0,0,0,3':{'0':'#ff00aa'}}},
  {id:'surface',name:'表面',visible:false,locked:false,faces:{'0,0,1,4':{'7':'#334455'}}},
 ]);
 c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,3':{gain:.6,affectPaint:true}}};
 s.model.objectCollections=[{collectionId:'set',name:'岩石集合',memberIds:[body,peer]}];
 s.model.objects!.find(o=>o.objectId===body)!.name='彩绘石块';
 const session=new CanvasSession(validateAsset(s.model));
 session.setObjectSelection([body],body);session.past=[];session.future=[];
 return {s:session,body,peer};
}
const coordinates=(model:AssetDocument,id:string)=>{
 const o=model.objects!.find(o=>o.objectId===id)!,c=model.canvases!.find(c=>c.canvasId===o.canvasIds[0])!;
 return c.cells.filter(v=>o.cellKeys!.includes([v.x,v.y,v.z].join(','))).map(v=>[v.x,v.y,v.z,v.color]);
};

test('capture snapshots exactly one object and its editable appearance without expanding its collection',()=>{
 const {s,body}=fixture(),before=structuredClone(s.model),brush=capture(s.model,body);
 assert.equal(brush.name,'彩绘石块');assert.equal(brush.sourceObjectId,body);
 assert.equal(brush.clipboard.objects.length,1);assert.equal(brush.clipboard.canvases[0].cells.length,3);
 assert.deepEqual(brush.clipboard.collections,[]);
 assert.deepEqual(brush.boundsTicks,{min:[4,-8,2],max:[12,-4,10]});
 assert.deepEqual(brush.anchorTicks,[8,-6,2]);assert.equal(brush.stepTicks,4);
 assert.equal(brush.clipboard.canvases[0].paintSource.layers.length,2);
 assert.deepEqual(s.model,before);
 s.model.canvases![0].cells[0].color=2;
 assert.equal(brush.clipboard.canvases[0].cells[0].color,0,'Brush snapshot must not alias its source');
});

test('stamp uses the requested bottom anchor grid phase, keeps appearance, and creates one independent object',()=>{
 const {s,body,peer}=fixture(),brush=capture(s.model,body),before=structuredClone(s.model);
 const result=stamp(s.model,brush,[41,41,17]);
 assert.deepEqual(s.model,before);
 assert.equal(result.objectIds.length,1);const id=result.objectIds[0];
 assert.notEqual(id,body);assert.notEqual(id,peer);
 assert.deepEqual(coordinates(result.model,id),[[8,12,4,0],[9,12,4,1],[8,12,5,1]]);
 const canvas=result.model.canvases[0];
 assert.equal(result.model.canvases.length,1);
 assert.equal(canvas.paintSource.layers[0].faces['8,12,4,3']['0'],'#ff00aa');
 assert.equal(canvas.paintSource.layers[1].faces['8,12,5,4']['7'],'#334455');
 assert.equal(canvas.paintSource.layers[1].visible,false);
 assert.deepEqual(canvas.faceTone.faces['8,12,4,3'],{gain:.6,affectPaint:true});
 assert.deepEqual(result.model.objectCollections,before.objectCollections);
 validateAsset(result.model);
});

test('a frozen brush can stamp repeatedly after its source is removed',()=>{
 const {s,body}=fixture(),brush=capture(s.model,body);s.removeObjects([body]);
 const first=stamp(s.model,brush,[40,42,18]),second=stamp(first.model,brush,[56,42,18]);
 assert.deepEqual(coordinates(second.model,first.objectIds[0]),[[8,12,4,0],[9,12,4,1],[8,12,5,1]]);
 assert.deepEqual(coordinates(second.model,second.objectIds[0]),[[12,12,4,0],[13,12,4,1],[12,12,5,1]]);
 assert.notEqual(first.objectIds[0],second.objectIds[0]);
});

test('stamping preserves target copy layers so moving an existing overlapping copy still reveals its original',()=>{
 const {s,body}=fixture(),brush=capture(s.model,body),target=structuredClone(s.model),canvas=target.canvases![0];
 canvas.baseCells=structuredClone(canvas.cells);
 canvas.voxelCopies=[{copyId:'overlap-copy',cells:[{...canvas.cells[0],color:2}]}];
 canvas.cells[0].color=2;
 const before=validateAsset(target),result=stamp(before,brush,[40,42,18]),stamped=result.model.canvases[0];
 assert.deepEqual(stamped.voxelCopies,before.canvases![0].voxelCopies,'A new stamp must not flatten unrelated editable copies');
 assert.deepEqual(stamped.baseCells.slice(0,4),before.canvases![0].baseCells);
 assert.equal(stamped.baseCells.length,7);assert.deepEqual(target,before,'Stamp must leave its input unchanged');
 const reopened=new CanvasSession(result.model);
 reopened.editor.begin();reopened.editor.moveVoxelCopy('overlap-copy',[2,0,0]);reopened.editor.commit();reopened.sync();
 assert.equal(reopened.active.cells.find(c=>c.x===0&&c.y===0&&c.z===0)!.color,0,'The covered original must return after the old copy moves');
 assert.equal(reopened.active.cells.find(c=>c.x===2&&c.y===0&&c.z===0)!.color,2);
 assert.equal(reopened.model.objects!.find(o=>o.objectId===result.objectIds[0])!.cellKeys!.length,3,'The new stamp remains one independent object');
});

test('an occupied stamp destination rejects without changing the model or the session history',()=>{
 const {s,body}=fixture(),brush=capture(s.model,body),before=structuredClone(s.model),past=s.past.length;
 assert.throws(()=>stamp(s.model,brush,brush.anchorTicks),/重叠|占用/);
 assert.deepEqual(s.model,before);
 assert.equal(typeof (s as any).stampObjectBrush,'function','CanvasSession brush operation is missing');
 assert.throws(()=>(s as any).stampObjectBrush(brush,brush.anchorTicks),/重叠|占用/);
 assert.deepEqual(s.model,before);assert.equal(s.past.length,past);
});

test('stamping into another precision preserves source size, palette properties and source layers',()=>{
 const source=fixture(.125),brush=capture(source.s.model,source.body);
 const targetAsset=createAsset('coarse-target');targetAsset.cells=[{x:0,y:0,z:0,color:0}];
 targetAsset.palette[1]='#112233';targetAsset.materialProfile.colors[1].baseColor_sRGB=[17/255,34/255,51/255];
 const target=new CanvasSession(targetAsset),before=structuredClone(target.model),result=stamp(target.model,brush,[40,42,18]);
 const obj=result.model.objects.find((o:any)=>o.objectId===result.objectIds[0]),c=result.model.canvases.find((c:any)=>c.canvasId===obj.canvasIds[0]);
 assert.equal(c.voxelStepM,.125);assert.equal(c.cells.length,3);
 assert.deepEqual(c.originTicks,[4,-8,2]);assert.deepEqual(c.cells.map((v:any)=>[v.x,v.y,v.z]),[[8,12,4],[9,12,4],[8,12,5]]);
 assert.equal(result.model.palette[c.cells[1].color],brush.clipboard.palette[1]);
 assert.notDeepEqual(result.model.materialProfile.colors[c.cells[1].color].baseColor_sRGB,[17/255,34/255,51/255]);
 assert.deepEqual(target.model,before);validateAsset(result.model);
});

test('a quarter-metre brush retains its physical footprint instead of adopting the active fine canvas step',()=>{
 const source=fixture(.25),brush=capture(source.s.model,source.body),target=fixture(.0625);
 target.s.patch({originTicks:[100,100,100]});
 const result=stamp(target.s.model,brush,[64,64,32]);
 const object=result.model.objects.find((o:any)=>o.objectId===result.objectIds[0]),c=result.model.canvases.find((c:any)=>c.canvasId===object.canvasIds[0]);
 assert.equal(c.voxelStepM,.25);assert.equal(brush.boundsTicks.max[0]-brush.boundsTicks.min[0],16);
 assert.equal(object.cellKeys.length,3);assert.equal(c.cells.length,3);validateAsset(result.model);
});

test('locked source-canvas reuse is rejected and successful session stamps have a single undo/redo step',()=>{
 const {s,body}=fixture(),brush=capture(s.model,body);s.patch({locked:true});
 const locked=structuredClone(s.model);assert.throws(()=>stamp(s.model,brush,[40,42,18]),/锁定/);assert.deepEqual(s.model,locked);
 s.patch({locked:false});s.past=[];s.future=[];
 assert.equal(typeof (s as any).stampObjectBrush,'function','CanvasSession brush operation is missing');
 const before=structuredClone(s.model),ids=(s as any).stampObjectBrush(brush,[40,42,18]);
 assert.equal(s.past.length,1);assert.equal(ids.length,1);assert.deepEqual(s.selectedObjectIds,ids);assert.equal(s.editObjectId,null);
 const after=structuredClone(s.model);s.undo();
 assert.deepEqual(s.model.canvases,before.canvases);assert.deepEqual(s.model.objects,before.objects);
 s.redo();assert.deepEqual(s.model.canvases,after.canvases);assert.deepEqual(s.model.objects,after.objects);assert.deepEqual(s.selectedObjectIds,ids);
});

test('unknown brush objects and non-finite placement coordinates reject without mutating assets',()=>{
 const {s,body}=fixture(),before=structuredClone(s.model);
 assert.throws(()=>capture(s.model,'missing'),/不存在|选择/);
 const brush=capture(s.model,body);assert.throws(()=>stamp(s.model,brush,[NaN,0,0]),/坐标|位置/);assert.deepEqual(s.model,before);
});
