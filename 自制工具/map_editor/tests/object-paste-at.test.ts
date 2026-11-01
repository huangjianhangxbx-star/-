import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type Vec3} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';

function fixture(){
 const a=createAsset('object-paste-at');a.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}];const s=new CanvasSession(a),id=s.joinObjects(s.model.objects!.map(o=>o.objectId),s.model.objects![0].objectId)!,m=structuredClone(s.model),c=m.canvases![0];
 c.paintSource=composeLayers([{id:'paint',name:'绘画',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#123456'}}},{id:'hidden',name:'隐藏原稿',visible:false,locked:true,faces:{'1,0,0,0':{'7':'#abcdef'}}}]);c.faceTone={schema:'xinghai-face-tone-1',faces:{'1,0,0,0':{gain:.7,affectPaint:true}}};
 const session=new CanvasSession(validateAsset(m));session.setObjectSelection([id],id);session.past=[];return {s:session,id};
}
function paste(s:CanvasSession,clip:any,delta:Vec3):string[]{assert.equal(typeof (s as any).pasteObjectsAt,'function','Explicit object paste placement is missing');return (s as any).pasteObjectsAt(clip,delta);}
function world(s:CanvasSession,id:string){const object=s.model.objects!.find(o=>o.objectId===id)!,c=s.model.canvases!.find(c=>c.canvasId===object.canvasIds[0])!;return object.cellKeys!.map(k=>k.split(',').map((v,i)=>c.originTicks[i]+Number(v)*c.voxelStepM/.03125));}

test('source-position object paste preserves the original and selects one independently movable overlapping copy with one undo',()=>{
 const {s,id}=fixture(),before=structuredClone(s.model),clip=s.copyObjects([id]),ids=paste(s,clip,[0,0,0]);
 assert.deepEqual(world(s,ids[0]),world(s,id),'No automatic X translation');assert.equal(s.model.canvases!.length,2);assert.deepEqual(s.model.canvases![0],before.canvases![0]);assert.deepEqual(s.model.objects!.find(o=>o.objectId===id),before.objects![0]);assert.deepEqual(s.selectedObjectIds,ids);assert.equal(s.editObjectId,null);assert.equal(s.past.length,1);
 assert.deepEqual(s.active.paintSource,before.canvases![0].paintSource);assert.deepEqual(s.active.faceTone,before.canvases![0].faceTone);const after=structuredClone(s.model);s.undo();assert.deepEqual(s.model.objects,before.objects);s.redo();assert.deepEqual(s.model.objects,after.objects);
 s.moveObjects(ids,[0,16,0]);assert.deepEqual(world(s,id),[[0,0,0],[8,0,0]]);assert.deepEqual(world(s,ids[0]),[[0,16,0],[8,16,0]]);validateAsset(JSON.parse(JSON.stringify(s.model)));
});

test('explicit negative and positive XYZ placements translate the entire clipboard exactly without moving source objects',()=>{
 for(const delta of [[-16,0,0],[0,16,0],[0,0,-8]] as Vec3[]){const {s,id}=fixture(),before=structuredClone(s.model.objects![0]),clip=s.copyObjects([id]),ids=paste(s,clip,delta);assert.deepEqual(world(s,ids[0]),world(s,id).map(p=>p.map((v,i)=>v+delta[i])));assert.deepEqual(s.model.objects!.find(o=>o.objectId===id),before);assert.equal(s.model.canvases!.length,1);validateAsset(s.model);}
});

test('nonoverlapping object paste preserves the destination canvas editable base and existing overlap copies',()=>{
 const {s,id}=fixture();s.editor.begin();s.editor.addVoxelCopy('existing-overlay',[{x:0,y:0,z:0,color:2}]);s.editor.commit();s.sync();const before=structuredClone(s.active.voxelCopies),clip=s.copyObjects([id]),ids=paste(s,clip,[0,16,0]);
 assert.deepEqual(s.active.voxelCopies,before);assert.equal(s.active.baseCells!.length,4);assert.equal(s.active.cells.find(c=>c.x===0&&c.y===0)!.color,2);assert.deepEqual(world(s,ids[0]),[[0,16,0],[8,16,0]]);validateAsset(s.model);
});

test('misaligned placement and exhausted overlapping-canvas capacity reject atomically rather than choosing an offset',()=>{
 const {s,id}=fixture(),clip=s.copyObjects([id]),before=structuredClone(s.model);assert.throws(()=>paste(s,clip,[1,0,0]),/对齐|网格/);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);
 for(let i=1;i<32;i++)s.duplicate(s.model.canvases![0]);const prior=structuredClone(s.model),depth=s.past.length;assert.throws(()=>paste(s,clip,[0,0,0]),/画布.*(预算|上限|32)|32.*画布/);assert.deepEqual(s.model,prior);assert.equal(s.past.length,depth);
});
