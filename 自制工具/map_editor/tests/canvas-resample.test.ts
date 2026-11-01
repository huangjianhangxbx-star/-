import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type AssetDocument,type Cell} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';

const api:any=await import('../core/canvas-resample.ts').catch((error:any)=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const key=(c:Pick<Cell,'x'|'y'|'z'>)=>[c.x,c.y,c.z].join(',');
const cell=(x:number,y=0,z=0,color=0):Cell=>({x,y,z,color,owner:'volume'});
function fixture(cells=[cell(0)],step=.25){
 const a=createAsset('resample');a.cells=cells;a.name='重采样';const s=new CanvasSession(a),m=structuredClone(s.model),c=m.canvases![0];c.voxelStepM=step;c.originTicks=[4,-8,2];
 m.objects=[{objectId:'body',name:'主体',canvasIds:[c.canvasId],originTicks:[12,-4,10],cellKeys:cells.map(key)}];m.anchorM=[.25,0,0];return new CanvasSession(validateAsset(m));
}
function resample(model:AssetDocument,id:string,step:number):any{assert.equal(typeof api.resampleCanvas,'function','Canvas resampling is missing');return api.resampleCanvas(model,id,step);}
const volume=(c:any)=>c.cells.length*c.voxelStepM**3;

test('an empty default canvas always exists and same-step resampling is a history-free noop',()=>{
 const s=new CanvasSession(createAsset('empty'));assert.ok(s.active);assert.equal(s.model.canvases!.length,1);assert.throws(()=>s.removeCanvases([s.activeId]),/保留.*画布/);
 assert.equal(typeof (s as any).resampleCanvas,'function','CanvasSession resampling is missing');const before=structuredClone(s.model),depth=s.past.length,report=(s as any).resampleCanvas(s.activeId,.25);
 assert.equal(report.beforeCells,0);assert.equal(report.afterCells,0);assert.equal(report.warnings.length,0);assert.equal(s.past.length,depth);assert.deepEqual(s.model,before);
});

test('subdivision preserves world volume, grid origin, root, object identity and pivot with one undo/redo command',()=>{
 const s=fixture([cell(-1),cell(0,0,0,1)]),id=s.activeId;s.add('不受影响',.125);s.patch({originTicks:[120,0,0]});const other=structuredClone(s.active);s.select(id);s.setEditObject('body');s.past=[];
 const before=structuredClone(s.model);assert.equal(typeof (s as any).resampleCanvas,'function');const report=(s as any).resampleCanvas(id,.0625);
 assert.equal(report.beforeCells,2);assert.equal(report.afterCells,128);assert.equal(report.volumeDeltaM3,0);assert.equal(volume(s.active),volume(before.canvases![0]));assert.deepEqual(s.active.originTicks,[4,-8,2]);assert.deepEqual(s.model.anchorM,before.anchorM);
 assert.deepEqual(s.model.objects![0].originTicks,before.objects![0].originTicks);assert.equal(s.model.objects![0].objectId,'body');assert.equal(s.model.objects![0].cellKeys!.length,128);assert.equal(s.editObjectId,'body');assert.deepEqual(s.model.canvases![1],other);assert.equal(s.past.length,1);
 assert.equal(Math.min(...s.active.cells.map(c=>c.x)),-4);assert.equal(Math.max(...s.active.cells.map(c=>c.x)),3);
 const after=structuredClone(s.active);s.undo();assert.deepEqual(s.active,before.canvases![0]);s.redo();assert.deepEqual(s.active,after);validateAsset(s.model);
});

test('editable paint layers, hidden pixels, face tones and overlapping copy originals survive fine/coarse roundtrip',()=>{
 const s=fixture(),m=structuredClone(s.model),c=m.canvases![0];c.baseCells=structuredClone(c.cells);c.voxelCopies=[{copyId:'overlay',cells:[cell(0,0,0,1)]}];c.cells=[cell(0,0,0,1)];
 c.paintSource=composeLayers([{id:'a',name:'手绘',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ff0000','255':'#0000ff'}}},{id:'b',name:'遮盖原稿',visible:false,locked:true,faces:{'0,0,0,0':{'17':'#00ff00'}}}]);c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.6,affectPaint:true}}};
 const before=validateAsset(m),fine=resample(before,c.canvasId,.0625).model,fc=fine.canvases[0];assert.equal(fc.baseCells.length,64);assert.equal(fc.voxelCopies[0].cells.length,64);assert.equal(fc.voxelCopies[0].copyId,'overlay');assert.equal(Object.keys(fc.faceTone.faces).length,16);
 assert.deepEqual(fc.paintSource.layers.map(({faces,...meta}:any)=>meta),c.paintSource.layers!.map(({faces,...meta})=>meta));
 assert.equal(fc.paintSource.layers[0].faces['0,0,3,4']['0'],'#ff0000');assert.equal(fc.paintSource.layers[0].faces['3,3,3,4']['15'],'#0000ff');
 const coarse=resample(fine,c.canvasId,.25).model.canvases[0];assert.deepEqual(coarse.paintSource,c.paintSource);assert.deepEqual(coarse.faceTone,c.faceTone);assert.deepEqual(coarse.baseCells,c.baseCells);assert.deepEqual(coarse.voxelCopies,c.voxelCopies);assert.deepEqual(before,m);
});

test('all six fully painted negative-coordinate faces retain their exact world texels and tone through subdivision and coarsening',()=>{
 const s=fixture([cell(-1,-1,-1)]),m=structuredClone(s.model),c=m.canvases![0],faces:Record<string,Record<string,string>>={},tones:Record<string,{gain:number;affectPaint:boolean}>={};
 for(let face=0;face<6;face++){const id='-1,-1,-1,'+face;faces[id]={};for(let pixel=0;pixel<256;pixel++)faces[id][pixel]='#'+((face+1)*65536+pixel*17).toString(16).padStart(6,'0');tones[id]={gain:(face+1)/8,affectPaint:face%2===0};}
 c.paintSource=composeLayers([{id:'six-faces',name:'六面原稿',visible:true,locked:false,faces}]);c.faceTone={schema:'xinghai-face-tone-1',faces:tones};
 const fine=resample(validateAsset(m),c.canvasId,.0625).model,roundtrip=resample(fine,c.canvasId,.25).model.canvases[0];
 assert.deepEqual(roundtrip.paintSource,c.paintSource);assert.deepEqual(roundtrip.faceTone,c.faceTone);assert.equal(volume(roundtrip),volume(c));
});

function coarseOwners(extra=true){
 const cubes=Array.from({length:8},(_,i)=>cell(i%2,Math.floor(i/2)%2,Math.floor(i/4),i<6?1:2));if(extra)cubes.push(cell(2,0,0,2));const s=fixture(cubes,.125),m=structuredClone(s.model),id=s.activeId;
 m.objects=[{objectId:'owner-a',name:'A',canvasIds:[id],originTicks:[0,0,0],cellKeys:cubes.slice(0,6).map(key)},{objectId:'owner-b',name:'B',canvasIds:[id],originTicks:[16,0,0],cellKeys:cubes.slice(6).map(key)}];return validateAsset(m);
}
test('coarsening uses maximum overlap ownership and deterministic color, reporting collisions and added volume',()=>{
 const model=coarseOwners(),id=model.canvases![0].canvasId,before=structuredClone(model),r=resample(model,id,.25),c=r.model.canvases[0];
 assert.equal(c.cells.length,2);assert.equal(c.cells.find((v:any)=>v.x===0).color,1);assert.deepEqual(r.model.objects.find((o:any)=>o.objectId==='owner-a').cellKeys,['0,0,0']);assert.deepEqual(r.model.objects.find((o:any)=>o.objectId==='owner-b').cellKeys,['1,0,0']);
 assert.equal(r.report.ownerConflicts,1);assert.equal(r.report.colorConflicts,1);assert.ok(r.report.volumeDeltaM3>0);assert.ok(r.report.warnings.length);assert.deepEqual(model,before);
 const swallowed=coarseOwners(false);assert.throws(()=>resample(swallowed,swallowed.canvases![0].canvasId,.25),/物体.*(消失|丢失|吞)|整.*物体/);
});

test('coarsening surface paint projects to the new exterior and chooses the nearest outward source on pixel conflicts',()=>{
 const s=fixture([cell(0),cell(0,0,1)],.125),m=structuredClone(s.model),c=m.canvases![0];
 c.paintSource=composeLayers([{id:'paint',name:'原稿',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ff0000'},'0,0,1,4':{'0':'#0000ff'}}}]);c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.2,affectPaint:false},'0,0,1,4':{gain:.8,affectPaint:true}}};
 const r=resample(validateAsset(m),c.canvasId,.25),next=r.model.canvases[0];assert.equal(next.paintSource.layers[0].faces['0,0,0,4']['0'],'#0000ff');assert.deepEqual(next.faceTone.faces['0,0,0,4'],{gain:.8,affectPaint:true});assert.equal(r.report.paintConflicts,1);assert.equal(r.report.toneConflicts,1);assert.ok(r.report.warnings.length);
});

test('coarsening rejects overlay precedence that cannot express the majority result without destroying author layers',()=>{
 const cells=Array.from({length:8},(_,i)=>cell(i%2,Math.floor(i/2)%2,Math.floor(i/4))),s=fixture(cells,.125),m=structuredClone(s.model),c=m.canvases![0];c.baseCells=structuredClone(cells);c.voxelCopies=[{copyId:'small-overlay',cells:[cell(0,0,0,1)]}];c.cells[0].color=1;
 const before=validateAsset(m);assert.throws(()=>resample(before,c.canvasId,.25),/粗化.*(副本|覆盖)|保留细格|重叠/);assert.deepEqual(m,before);
});

test('coarsened objects keep usable operation pivots for subsequent moves and XYZ rotations while asset root and undo remain exact',()=>{
 const original=fixture([cell(0)],.125),m=structuredClone(original.model);m.canvases![0].originTicks=[0,0,0];m.objects![0].originTicks=[2,2,2];const s=new CanvasSession(validateAsset(m)),before=structuredClone(s.model),id=s.activeId;s.past=[];
 assert.equal(typeof (s as any).resampleCanvas,'function');const report=(s as any).resampleCanvas(id,.25);
 for(const axis of [0,1,2])assert.doesNotThrow(()=>s.rotateObjects(['body'],axis,1),'The new coarse object must remain directly operable');
 s.moveObjects(['body'],[8,0,0]);validateAsset(s.model);assert.deepEqual(s.model.anchorM,before.anchorM);assert.ok(report.warnings.some((message:string)=>/操作轴|枢轴/.test(message)));
 while(s.past.length)s.undo();assert.deepEqual(s.model.objects![0].originTicks,[2,2,2]);assert.equal(s.active.voxelStepM,.125);assert.deepEqual(s.model.anchorM,before.anchorM);s.redo();assert.equal(s.active.voxelStepM,.25);
});

test('cell/source budgets, native bounds and locked canvases reject atomically before session history changes',()=>{
 const cubes=Array.from({length:4096},(_,i)=>cell(i%16,Math.floor(i/16)%16,Math.floor(i/256))),big=fixture(cubes),before=structuredClone(big.model);assert.throws(()=>resample(big.model,big.activeId,.0625),/预算/);assert.deepEqual(big.model,before);
 const edge=fixture([cell(4096)]);assert.throws(()=>resample(edge.model,edge.activeId,.125),/坐标|范围|边界/);
 const s=fixture();s.patch({locked:true});const prior=structuredClone(s.model),depth=s.past.length;assert.equal(typeof (s as any).resampleCanvas,'function');assert.throws(()=>(s as any).resampleCanvas(s.activeId,.125),/锁定/);assert.deepEqual(s.model,prior);assert.equal(s.past.length,depth);
 assert.throws(()=>resample(before,big.activeId,.1),/精度|尺寸|步长/);
});

test('hidden source-copy budgets and protected-column subdivision are validated without flattening or discarding metadata',()=>{
 const cells=Array.from({length:2000},(_,i)=>cell(i%16,Math.floor(i/16)%16,Math.floor(i/256))),s=fixture(cells),m=structuredClone(s.model),c=m.canvases![0];c.baseCells=structuredClone(c.cells);c.voxelCopies=[{copyId:'hidden-source',cells:structuredClone(c.cells)}];
 assert.throws(()=>resample(validateAsset(m),c.canvasId,.0625),/副本|预算/);
 const p=fixture(),source=structuredClone(p.model);source.canvases![0].protectedColumns=['-1,0'];const finer=resample(source,p.activeId,.125).model;
 assert.deepEqual(new Set(finer.canvases[0].protectedColumns),new Set(['-2,0','-2,1','-1,0','-1,1']));assert.deepEqual(resample(finer,p.activeId,.25).model.canvases[0].protectedColumns,['-1,0']);
 source.canvases![0].protectedColumns=['4096,0'];assert.throws(()=>resample(source,p.activeId,.125),/保护列|边界|范围/);
});
