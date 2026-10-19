import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorDocument} from '../core/document.ts';
import {meshMap} from '../core/mesher.ts';
import {createAsset,validateAsset} from '../core/workshop-documents.ts';
import {fromEditingMap,toEditingMap,toNativeV1} from '../core/workshop-adapter.ts';
import {VoxelSelection} from '../core/voxel-selection.ts';
import {planStepScale} from '../core/voxel-step-scale.ts';
import {EditOperationSession} from '../core/edit-operation.ts';

const config={mode:'selection',action:'add',color:0,shape:'square',size:1,thickness:1,level:0,direction:1,tag:''} as const;

test('overlapping copy survives source save and reload without duplicate export faces',()=>{
  const source=createAsset('overlap-test');
  const editor=new EditorDocument(toEditingMap(source));
  editor.begin();editor.put(0,0,0,0,'height');editor.commit();
  editor.begin();editor.addVoxelCopy('copy-1',[{x:0,y:0,z:0,color:1,owner:'height'}]);editor.commit();
  assert.equal(editor.doc.cells.length,1);
  assert.equal(editor.doc.voxelCopies.length,1);
  assert.equal(meshMap(editor.doc).length,6);
  const saved=validateAsset(fromEditingMap(source,editor.doc));
  assert.equal(toNativeV1(saved).cells.length,1,'FBX input must contain one composited voxel');
  const reopened=new EditorDocument(toEditingMap(saved));
  assert.equal(reopened.doc.voxelCopies[0].copyId,'copy-1');
  assert.equal(reopened.doc.cells.length,1);
  reopened.begin();reopened.moveVoxelCopy('copy-1',[2,0,0]);reopened.commit();
  assert.deepEqual(reopened.doc.cells.map((c:any)=>c.x).sort(),[0,2]);
  assert.equal(meshMap(reopened.doc).length,12);
  reopened.undo();assert.equal(reopened.doc.cells.length,1);
  reopened.redo();assert.equal(reopened.doc.cells.length,2);
  assert.equal(validateAsset(fromEditingMap(saved,reopened.doc)).voxelCopies?.[0].cells[0].x,2);
});

test('erasing an overlapping voxel removes it from the one visible model',()=>{
  const editor=new EditorDocument();
  editor.begin();editor.put(0,0,0,0,'height');editor.commit();
  editor.begin();editor.addVoxelCopy('copy-1',[{x:0,y:0,z:0,color:1,owner:'height'}]);editor.commit();
  editor.begin();editor.put(0,0,0,0,'height',true);editor.commit();
  assert.equal(editor.doc.cells.length,0);
  assert.equal(editor.doc.baseCells.length,0);
  editor.undo();assert.equal(editor.doc.cells.length,1);
});

test('shrinking a copied overlapping selection replaces the selected model instead of creating another copy',()=>{
 const doc=new EditorDocument();
 doc.begin();for(let x=0;x<3;x++)doc.put(x,0,0,0,'height');doc.commit();
 doc.begin();doc.addVoxelCopy('copy-1',[...doc.cells.values()]);doc.commit();
 const selection=new VoxelSelection();selection.replace(doc.cells.values());
 const preview=planStepScale(doc,selection,'x',-1);
 const op=new EditOperationSession(doc);op.begin(config);op.apply(op.stepScale(preview));op.commit();
 assert.deepEqual(doc.doc.cells.map((c:any)=>c.x),[1]);
 assert.equal(doc.doc.voxelCopies?.flatMap((copy:any)=>copy.cells).length,0);
 doc.undo();assert.equal(doc.doc.cells.length,3);
 doc.redo();assert.deepEqual(doc.doc.cells.map((c:any)=>c.x),[1]);
});
