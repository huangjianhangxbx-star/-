import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorDocument} from '../core/document.ts';
import {planGizmoTransform, previewGizmoDocument, applyGizmoTransform} from '../core/voxel-gizmo.ts';

const cell=(x:number,y:number,z:number)=>({x,y,z,color:0,owner:'volume' as const});
const coords=(cells:any[])=>cells.map(c=>[c.x,c.y,c.z]).sort((a,b)=>a.join(',').localeCompare(b.join(',')));

test('moving a selection previews relocated solid before commit and supports undo',()=>{
 const editor=new EditorDocument();editor.begin();editor.put(0,0,0,0,'volume');editor.put(1,0,0,0,'volume');editor.commit();
 const selection=[cell(0,0,0)];
 const plan=planGizmoTransform(editor,selection,{kind:'move',delta:[0,1,0]});
 assert.deepEqual(coords(previewGizmoDocument(editor,plan).cells),[[0,1,0],[1,0,0]]);
 assert.deepEqual(coords(editor.doc.cells),[[0,0,0],[1,0,0]]);
 applyGizmoTransform(editor,plan);
 assert.deepEqual(coords(editor.doc.cells),[[0,1,0],[1,0,0]]);
 editor.undo();assert.deepEqual(coords(editor.doc.cells),[[0,0,0],[1,0,0]]);
});

test('rotation snaps selected asymmetric voxels around their common pivot on every axis',()=>{
 const editor=new EditorDocument();editor.begin();for(const c of [cell(0,0,0),cell(1,0,0),cell(1,1,0)])editor.put(c.x,c.y,c.z,0,'volume');editor.commit();
 const selected=editor.doc.cells;
 assert.deepEqual(coords(planGizmoTransform(editor,selected,{kind:'rotate',axis:'z',turns:1}).destination),coords([cell(1,0,0),cell(1,1,0),cell(0,1,0)]));
 assert.deepEqual(coords(planGizmoTransform(editor,selected,{kind:'rotate',axis:'x',turns:1}).destination),coords([cell(0,0,0),cell(1,0,0),cell(1,0,1)]));
 assert.deepEqual(coords(planGizmoTransform(editor,selected,{kind:'rotate',axis:'y',turns:1}).destination),coords([cell(0,0,0),cell(0,0,-1),cell(0,1,-1)]));
});

test('overlapping pasted group moves and rotates without erasing underlying model',()=>{
 const editor=new EditorDocument();editor.begin();editor.put(0,0,0,0,'volume');editor.addVoxelCopy('copy',[cell(0,0,0),cell(1,0,0)]);editor.commit();
 const plan=planGizmoTransform(editor,[cell(0,0,0),cell(1,0,0)],{kind:'rotate',axis:'z',turns:1},'copy');
 const preview=previewGizmoDocument(editor,plan);
 assert.deepEqual(coords(preview.cells),coords([cell(0,0,0),cell(0,1,0)]));
 assert.equal(editor.doc.voxelCopies?.[0].cells[1].y,0);
 applyGizmoTransform(editor,plan);
 assert.deepEqual(coords(editor.doc.cells),coords(preview.cells));
 editor.undo();assert.deepEqual(coords(editor.doc.cells),coords([cell(0,0,0),cell(1,0,0)]));
});
