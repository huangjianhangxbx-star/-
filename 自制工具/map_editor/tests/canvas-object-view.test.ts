import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CanvasView} from '../desktop/canvas-view.ts';
import {createAsset} from '../core/workshop-documents.ts';
import {CanvasSession,ensureModelObjects} from '../core/workshop-canvases.ts';

test('object transform previews move only selected same-canvas cells and cancel restores base',()=>{
 const asset=createAsset('preview');asset.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:0}];
 const session=new CanvasSession(ensureModelObjects(asset));
 const terrain=new THREE.Group(),scene=new THREE.Scene();scene.add(terrain);
 const rendered:any[]=[];
 const view:any={scene,terrain,editable:true,host:{dataset:{}},disposeGeometry:(g:THREE.Group)=>g.clear(),fillTerrain:(g:THREE.Group,a:any)=>{rendered.push({root:g,cells:a.cells});},camera:new THREE.PerspectiveCamera()};
 const canvas=new CanvasView(view);canvas.update(session);
 const id=session.model.objects![0].objectId;
 assert.deepEqual(canvas.objectQuery().bounds([id]).max.toArray(),[.25,.25,-0]);
 canvas.previewObjects([id],{kind:'move',delta:[2,0,0]},[0,0,0]);
 assert.equal(terrain.visible,false);assert.equal(rendered.length,2);
 assert.deepEqual(rendered[0].cells.map((c:any)=>c.x),[1]);assert.equal(rendered[0].root.position.x,0);
 assert.deepEqual(rendered[1].cells.map((c:any)=>c.x),[0]);assert.equal(rendered[1].root.position.x,.5);
 canvas.previewObjects([id],null,[0,0,0]);assert.equal(terrain.visible,true);
});

test('internal edit keeps same-canvas sibling geometry visible as context',()=>{
 const asset=createAsset('context');asset.cells=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}];
 const session=new CanvasSession(asset),owner=session.model.objects![0];session.setEditObject(owner.objectId);
 const terrain=new THREE.Group(),scene=new THREE.Scene();scene.add(terrain);
 const rendered:any[]=[];
 const view:any={scene,terrain,editable:true,host:{dataset:{}},disposeGeometry:(g:THREE.Group)=>g.clear(),fillTerrain:(g:THREE.Group,a:any)=>rendered.push({root:g,cells:a.cells}),camera:new THREE.PerspectiveCamera()};
 const canvas=new CanvasView(view);canvas.update(session);
 assert.equal(terrain.visible,true,'the edited owner terrain remains visible');
 assert.deepEqual(session.editor.doc.cells.map(c=>c.x),[0],'only current owner is editable');
 assert.deepEqual(rendered.flatMap(r=>r.cells).map(c=>c.x),[1],'same-canvas sibling has its own visible context geometry');
 assert.equal(rendered[0].root.visible,true);
});

test('selection builds only selected object boxes and reuses its query for the gizmo',()=>{
 const asset=createAsset('selected-only');asset.cells=Array.from({length:500},(_,x)=>({x,y:0,z:0,color:0}));
 const session=new CanvasSession(asset),id=session.model.objects![7].objectId;
 const terrain=new THREE.Group(),scene=new THREE.Scene();scene.add(terrain);
 let bounds:THREE.Box3|undefined;
 const view:any={scene,terrain,editable:true,host:{dataset:{}},disposeGeometry:(g:THREE.Group)=>g.clear(),fillTerrain:()=>{},setObjectGizmo:(box:THREE.Box3)=>{bounds=box;},camera:new THREE.PerspectiveCamera()};
 const canvas=new CanvasView(view);canvas.update(session);
 assert.deepEqual(canvas.objectEntries([id]).map(e=>e.id),[id],'do not allocate boxes for unselected objects');
 const entries=canvas.objectEntries.bind(canvas);let calls=0;
 canvas.objectEntries=(ids?:readonly string[])=>{calls++;return entries(ids);};
 canvas.objectSelection([id],true);
 assert.equal(calls,1,'outlines and gizmo share one filtered query');
 assert.deepEqual(bounds!.min.toArray(),[1.75,0,-.25]);assert.deepEqual(bounds!.max.toArray(),[2,.25,-0]);
});
