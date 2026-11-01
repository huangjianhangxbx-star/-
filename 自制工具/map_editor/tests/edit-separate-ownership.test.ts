import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset,validateAsset,type Cell} from '../core/workshop-documents.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';
import {composeLayers} from '../core/paint-layers.ts';
import {applyGizmoTransform,planGizmoTransform} from '../core/voxel-gizmo.ts';

const cell=(x:number,color=x):Cell=>({x,y:0,z:0,color,owner:'volume'});
const key=(c:Pick<Cell,'x'|'y'|'z'>)=>[c.x,c.y,c.z].join(',');
function fixture(copies=false){
 const asset=createAsset('separate-ownership');asset.name='主体';asset.cells=[cell(0),cell(1),cell(2),cell(8,4)];
 const first=new CanvasSession(asset),members=first.model.objects!.filter(o=>o.cellKeys![0]!=='8,0,0').map(o=>o.objectId),owner=first.joinObjects(members,members[0])!,other=first.model.objects!.find(o=>o.cellKeys!.includes('8,0,0'))!.objectId;
 const model=structuredClone(first.model),c=model.canvases![0];
 c.paintSource=composeLayers([{id:'paint',name:'手绘',visible:true,locked:false,faces:{'1,0,0,4':{'0':'#123456'},'2,0,0,0':{'1':'#334455'}}},{id:'hidden',name:'隐藏稿',visible:false,locked:true,faces:{'2,0,0,4':{'2':'#778899'}}}]);
 c.faceTone={schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.8,affectPaint:false},'2,0,0,0':{gain:.6,affectPaint:true}}};
 if(copies){c.baseCells=structuredClone(c.cells);c.voxelCopies=[{copyId:'shared-overlay',cells:[cell(0,2),cell(2,3),cell(8,5)]}];const visible=new Map(c.baseCells.map(c=>[key(c),c]));for(const row of c.voxelCopies)for(const v of row.cells)visible.set(key(v),v);c.cells=[...visible.values()];}
 const session=new CanvasSession(validateAsset(model));session.setEditObject(owner);session.setObjectSelection([owner],owner);session.past=[];session.future=[];
 return {session,owner,other};
}
const owned=(s:CanvasSession,id:string)=>s.model.objects!.find(o=>o.objectId===id)!.cellKeys!;

test('partial separation keeps the old edit scope, creates a distinctly named owner and preserves native source data',()=>{
 const {session:s,owner,other}=fixture(true),before=structuredClone(s.model),part=s.separateCells([cell(2),cell(8),cell(99)])!;
 assert.equal(s.editObjectId,owner);assert.deepEqual(owned(s,owner),['0,0,0','1,0,0']);assert.deepEqual(owned(s,part),['2,0,0']);assert.deepEqual(owned(s,other),['8,0,0']);
 assert.notEqual(s.model.objects!.find(o=>o.objectId===part)!.name,s.model.objects!.find(o=>o.objectId===owner)!.name);
 assert.deepEqual(s.active,before.canvases![0]);assert.deepEqual([...s.editor.cells.keys()],['0,0,0','1,0,0']);
 assert.ok(s.editor.doc.voxelCopies.every((copy:any)=>copy.cells.every((c:Cell)=>!['2,0,0','8,0,0'].includes(key(c)))));
 assert.equal(s.past.length,1);s.undo();assert.deepEqual(s.model.objects,before.objects);assert.deepEqual(s.model.canvases,before.canvases);s.redo();assert.deepEqual(owned(s,part),['2,0,0']);
 const reopened=new CanvasSession(validateAsset(JSON.parse(JSON.stringify(s.model))));reopened.setEditObject(owner);assert.deepEqual([...reopened.editor.cells.keys()],['0,0,0','1,0,0']);assert.deepEqual(reopened.active,s.active);
});

test('editing the old object cannot select, overwrite, erase or move the separated owner',()=>{
 for(const action of ['overwrite','erase','move']){
  const {session:s,owner}=fixture(true),part=s.separateCells([cell(2)])!,before=structuredClone(s.active),separated=structuredClone(s.active.cells.find(c=>c.x===2)!);
  assert.equal(s.editor.cells.has('2,0,0'),false);
  if(action==='move'){const selected=[s.editor.cells.get('0,0,0')!];applyGizmoTransform(s.editor,planGizmoTransform(s.editor,selected,{kind:'move',delta:[2,0,0]}));}
  else{s.editor.begin();s.editor.put(2,0,0,6,'volume',action==='erase');s.editor.commit();}
  s.sync();assert.deepEqual(s.active.cells.find(c=>c.x===2),separated);assert.deepEqual(owned(s,part),['2,0,0']);assert.equal(s.editObjectId,owner);
  assert.deepEqual(s.active.paintSource!.layers!.map(l=>l.faces['2,0,0,0']),before.paintSource!.layers!.map(l=>l.faces['2,0,0,0']));assert.deepEqual(s.active.faceTone!.faces['2,0,0,0'],before.faceTone!.faces['2,0,0,0']);validateAsset(s.model);
 }
});

test('foreign-only selections are noops and successive separated parts receive distinct names',()=>{
 const {session:s}=fixture(),before=structuredClone(s.model);assert.equal(s.separateCells([cell(8),cell(99)]),null);assert.deepEqual(s.model,before);assert.equal(s.past.length,0);
 const a=s.separateCells([cell(2)])!,b=s.separateCells([cell(1)])!;
 assert.notEqual(s.model.objects!.find(o=>o.objectId===a)!.name,s.model.objects!.find(o=>o.objectId===b)!.name,'Two newly separated parts must be distinguishable in the object list');
});

test('separating every owned voxel leaves a safe empty original edit scope that can receive new modeling',()=>{
 const {session:s,owner}=fixture(true),part=s.separateCells([cell(0),cell(1),cell(2)])!;
 assert.equal(s.editObjectId,owner);assert.deepEqual(owned(s,owner),[]);assert.equal(s.editor.cells.size,0);assert.deepEqual(owned(s,part),['0,0,0','1,0,0','2,0,0']);validateAsset(s.model);
 s.editor.begin();s.editor.volume(4,0,0,1);s.editor.commit();s.sync();assert.deepEqual(owned(s,owner),['4,0,0']);assert.deepEqual(owned(s,part),['0,0,0','1,0,0','2,0,0']);
 const reopened=new CanvasSession(validateAsset(JSON.parse(JSON.stringify(s.model))));reopened.setEditObject(owner);assert.deepEqual([...reopened.editor.cells.keys()],['4,0,0']);
});

for(const action of ['move','rotate','delete'])test(`a separated object's ${action} preserves unrelated base/copy layers and remains a valid saved model`,()=>{
 const {session:s,owner}=fixture(true),part=s.separateCells([cell(2)])!;s.setEditObject(null);const before=structuredClone(s.active),otherOverlay=before.voxelCopies![0].cells.filter(c=>c.x!==2),oldObject=structuredClone(s.model.objects!.find(o=>o.objectId===owner));
 assert.doesNotThrow(()=>{if(action==='move')s.moveObjects([part],[0,16,0]);else if(action==='rotate')s.rotateObjects([part],2,1);else s.removeObjects([part]);});
 assert.ok(s.active.baseCells,'Object transforms must not flatten the target canvas base layer');assert.ok(s.active.voxelCopies,'Object transforms must not discard unrelated editable copy groups');
 assert.equal(s.active.voxelCopies![0].copyId,'shared-overlay');assert.deepEqual(s.active.voxelCopies![0].cells.filter(c=>c.x===0&&c.y===0||c.x===8),otherOverlay);
 assert.deepEqual(s.model.objects!.find(o=>o.objectId===owner),oldObject);validateAsset(s.model);new CanvasSession(validateAsset(JSON.parse(JSON.stringify(s.model))));
 if(action==='delete'){assert.ok(!s.model.objects!.some(o=>o.objectId===part));assert.ok(!s.active.cells.some(c=>c.x===2&&c.y===0));}
 else{const target=action==='move'?'2,2,0':'0,2,0';assert.deepEqual(owned(s,part),[target]);assert.ok(Object.keys(s.active.paintSource!.layers![0].faces).some(k=>k.startsWith(target+',')));assert.ok(Object.keys(s.active.faceTone!.faces).some(k=>k.startsWith(target+',')));}
 s.undo();assert.deepEqual(s.active,before);s.redo();validateAsset(s.model);
});

test('moving a separated layered object onto another owner consumes destination rows without duplicate copy composition',()=>{
 const {session:s,owner}=fixture(true),part=s.separateCells([cell(2)])!;s.setEditObject(null);
 s.moveObjects([part],[-16,0,0]);assert.deepEqual(owned(s,part),['0,0,0']);assert.deepEqual(owned(s,owner),['1,0,0']);
 assert.equal(s.active.baseCells!.filter(c=>key(c)==='0,0,0').length,1);assert.equal(s.active.voxelCopies![0].cells.filter(c=>key(c)==='0,0,0').length,1);assert.equal(s.active.cells.find(c=>key(c)==='0,0,0')!.color,3);validateAsset(s.model);
 s.removeObjects([part]);assert.ok(!s.active.cells.some(c=>key(c)==='0,0,0'),'Deleting the moved object must not reveal an accidentally retained destination row');validateAsset(s.model);
});

test('deleting a separated object leaves another canvas copy stack exactly intact',()=>{
 const {session:s}=fixture(true),part=s.separateCells([cell(2)])!;s.setEditObject(null);s.add('其他画布',.125);
 s.editor.begin();s.editor.volume(0,0,0,1);s.editor.commit();s.sync();s.editor.begin();s.editor.addVoxelCopy('other-canvas-copy',[cell(0,5)]);s.editor.commit();s.sync();
 const before=structuredClone(s.active);s.removeObjects([part]);assert.deepEqual(s.active,before);validateAsset(s.model);
});
