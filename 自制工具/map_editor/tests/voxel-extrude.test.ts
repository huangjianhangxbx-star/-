import test from 'node:test';import assert from 'node:assert/strict';
import {EditorDocument,createMap} from '../core/document.ts';
import {VoxelSelection,voxelKey,type SelectionCell} from '../core/voxel-selection.ts';
import {CanvasSession} from '../core/workshop-canvases.ts';import {createAsset} from '../core/workshop-documents.ts';import {composeLayers} from '../core/paint-layers.ts';
const cells:SelectionCell[]=[{x:0,y:0,z:0,color:1,owner:'volume'},{x:1,y:0,z:0,color:2,owner:'volume'},{x:0,y:1,z:0,color:3,owner:'volume'}];
const fixture=(rows=cells)=>{const editor=new EditorDocument({...createMap(),cells:rows}),selection=new VoxelSelection();selection.replace(rows);return{editor,selection};};
const api=()=>import('../core/voxel-extrude.ts');

test('six directional extensions duplicate only each outer column boundary and leave interior cells unchanged',async()=>{
 const {planVoxelExtrude,applyVoxelExtrude}=await api();
 for(const [face,want]of [[0,[['2,0,0',2],['3,0,0',2],['1,1,0',3],['2,1,0',3]]],[1,[['-1,0,0',1],['-2,0,0',1],['-1,1,0',3],['-2,1,0',3]]],[2,[['0,2,0',3],['0,3,0',3],['1,1,0',2],['1,2,0',2]]],[3,[['0,-1,0',1],['0,-2,0',1],['1,-1,0',2],['1,-2,0',2]]],[4,[['0,0,1',1],['0,0,2',1],['1,0,1',2],['1,0,2',2],['0,1,1',3],['0,1,2',3]]],[5,[['0,0,-1',1],['0,0,-2',1],['1,0,-1',2],['1,0,-2',2],['0,1,-1',3],['0,1,-2',3]]]] as const){
  const{editor,selection}=fixture(),before=structuredClone(editor.doc),p=planVoxelExtrude(editor,selection,face,2);
  assert.deepEqual(p.additions.map(c=>[voxelKey(c),c.color]).sort(),[...want].sort());assert.deepEqual(p.removals,[]);assert.deepEqual(p.conflicts,[]);assert.ok(p.additions.every(c=>c.owner==='volume'));assert.deepEqual(editor.doc,before);
  applyVoxelExtrude(editor,p);for(const c of cells)assert.deepEqual(editor.cells.get(voxelKey(c)),c);assert.equal(editor.cells.size,cells.length+want.length);assert.equal(editor.past.length,1);assert.equal(editor.doc.voxelSize,.25);
  editor.undo();assert.deepEqual(editor.doc.cells,before.cells);editor.redo();assert.equal(editor.cells.size,cells.length+want.length);
 }
});
test('negative steps trim only the continuous selected end and never jump holes or unselected cells',async()=>{
 const {planVoxelExtrude,applyVoxelExtrude}=await api();
 for(const[face,want]of [[0,['4,0,0','5,0,0']],[1,['-4,0,0','-3,0,0']]]as const){
  const rows=[-4,-3,0,1,4,5].map(x=>({x,y:0,z:0,color:0,owner:'volume'})),{editor,selection}=fixture(rows),p=planVoxelExtrude(editor,selection,face,-10);assert.deepEqual(p.removals.map(voxelKey).sort(),[...want].sort());applyVoxelExtrude(editor,p);assert.equal(editor.cells.size,4);
 }
 const rows=[0,1,2].map(x=>({x,y:0,z:0,color:0})),{editor,selection}=fixture(rows);selection.replace([rows[0],rows[2]]);const p=planVoxelExtrude(editor,selection,0,-3);assert.deepEqual(p.removals.map(voxelKey),['2,0,0']);assert.deepEqual(p.destination.map(voxelKey),['0,0,0']);applyVoxelExtrude(editor,p);assert.ok(editor.cells.has('1,0,0'),'the unselected middle voxel remains untouched');
});
test('foreign and occupied targets reject atomically, including changes after a preview was computed',async()=>{
 const{planVoxelExtrude,applyVoxelExtrude}=await api(),{editor,selection}=fixture([{x:0,y:0,z:0,color:0}]);const before=structuredClone(editor.doc),blocked=new Set(['1,0,0']),p=planVoxelExtrude(editor,selection,0,2,blocked);assert.deepEqual(p.conflicts,['1,0,0']);assert.throws(()=>applyVoxelExtrude(editor,p),/冲突/);assert.deepEqual(editor.doc,before);assert.equal(editor.past.length,0);
 const clear=planVoxelExtrude(editor,selection,0,1);assert.throws(()=>applyVoxelExtrude(editor,clear,blocked),/冲突|变化/);assert.deepEqual(editor.doc,before);
 editor.begin();editor.put(1,0,0,0,'height');editor.commit();const occupied=structuredClone(editor.doc),depth=editor.past.length;assert.throws(()=>applyVoxelExtrude(editor,clear),/冲突|变化/);assert.deepEqual(editor.doc,occupied);assert.equal(editor.past.length,depth);
});
test('zero is history-free, stale sources and illegal parameters fail, and target budget or bounds never partially execute',async()=>{
 const{planVoxelExtrude,applyVoxelExtrude}=await api(),{editor,selection}=fixture(),zero=planVoxelExtrude(editor,selection,4,0);applyVoxelExtrude(editor,zero);assert.equal(editor.past.length,0);assert.deepEqual(zero.source,zero.destination);
 assert.throws(()=>planVoxelExtrude(editor,selection,6,1),/方向|面/);assert.throws(()=>planVoxelExtrude(editor,selection,0,.5),/整数/);assert.throws(()=>planVoxelExtrude(editor,selection,0,250001),/预算/);
 const edge=fixture([{x:8192,y:0,z:0,color:0}]);assert.throws(()=>planVoxelExtrude(edge.editor,edge.selection,0,1),/越界/);assert.equal(edge.editor.past.length,0);
 const stale=planVoxelExtrude(editor,selection,4,1);editor.begin();editor.put(0,0,0,4,'volume');editor.commit();assert.throws(()=>applyVoxelExtrude(editor,stale),/源.*变化/);
});
test('owner proxies and paint authorship remain isolated; deleting overlap endpoints undo restores every original',async()=>{
 const{planVoxelExtrude,applyVoxelExtrude}=await api();
 for(const[face,steps]of [[0,1],[1,-1]]as const){
  const a=createAsset('extrude'),own=[{x:0,y:0,z:0,color:0},{x:1,y:0,z:0,color:1}],other={x:10,y:0,z:0,color:2};a.schema='xinghai-workshop-asset-2';a.cells=[];a.canvases=[{canvasId:'c',name:'c',voxelStepM:.125,originTicks:[8,0,0],visible:true,locked:false,protectedColumns:[],cells:[...own,other],baseCells:[{...own[0],color:3},own[1],other],voxelCopies:[{copyId:'copy',cells:[own[0]]}],paintSource:composeLayers([{id:'hidden',name:'原稿',visible:false,locked:true,faces:{'0,0,0,4':{'0':'#ff0000'},'1,0,0,4':{'1':'#00ff00'},'10,0,0,4':{'2':'#0000ff'}}}]),faceTone:{schema:'xinghai-face-tone-1',faces:{'0,0,0,4':{gain:.4,affectPaint:true},'1,0,0,4':{gain:.5,affectPaint:false}}}}];a.objects=[{objectId:'own',name:'own',canvasIds:['c'],originTicks:[8,0,0],cellKeys:['0,0,0','1,0,0']},{objectId:'foreign',name:'foreign',canvasIds:['c'],originTicks:[8,0,0],cellKeys:['10,0,0']}];
  const s=new CanvasSession(a);s.setEditObject('own');const before=structuredClone(s.model),selection=new VoxelSelection();selection.replace(s.editor.cells.values());const p=planVoxelExtrude(s.editor,selection,face,steps,new Set(['10,0,0']));applyVoxelExtrude(s.editor,p);s.sync();assert.equal(s.past.length,1);assert.deepEqual(s.model.objects![1],before.objects![1]);assert.deepEqual(s.active.paintSource!.layers!.map(({faces,...meta})=>meta),before.canvases![0].paintSource!.layers!.map(({faces,...meta})=>meta));assert.deepEqual(s.active.paintSource!.layers![0].faces['10,0,0,4'],{'2':'#0000ff'});assert.ok(p.destination.every(c=>c.x!==10));
  if(steps>0){assert.deepEqual(s.active.paintSource,before.canvases![0].paintSource);assert.deepEqual(s.active.faceTone,before.canvases![0].faceTone);}else{assert.equal(s.active.paintSource!.layers![0].faces['0,0,0,4'],undefined);assert.equal(s.active.faceTone!.faces['0,0,0,4'],undefined);assert.ok(s.active.faceTone!.faces['1,0,0,4']);}
  s.undo();assert.deepEqual({...s.model,revision:before.revision},before);
 }
});
test('ordinary volume protection markers do not block extension and the entire last end can be removed',async()=>{
 const{planVoxelExtrude,applyVoxelExtrude}=await api(),{editor,selection}=fixture([{x:0,y:0,z:0,color:1,owner:'volume'}]);editor.data.protectedColumns=['0,0'];editor.recompose();
 const grow=planVoxelExtrude(editor,selection,4,1);applyVoxelExtrude(editor,grow);selection.replace(grow.destination);const trim=planVoxelExtrude(editor,selection,5,-5);assert.deepEqual(trim.after,[0,0,0]);applyVoxelExtrude(editor,trim);assert.equal(editor.cells.size,0);editor.undo();assert.deepEqual([...editor.cells.keys()].sort(),['0,0,0','0,0,1']);
});
test('apply preserves an unrelated active gesture and plans preview safely on detached editors',async()=>{
 const{planVoxelExtrude,applyVoxelExtrude}=await api(),{editor,selection}=fixture(),p=planVoxelExtrude(editor,selection,4,1),before=structuredClone(editor.doc),detached=new EditorDocument(editor.doc);applyVoxelExtrude(detached,p);assert.deepEqual(editor.doc,before);assert.equal(editor.past.length,0);assert.equal(detached.past.length,1);
 editor.begin();editor.put(20,20,20,0,'volume');const gesture=structuredClone(editor.doc);assert.throws(()=>applyVoxelExtrude(editor,p),/当前.*笔画/);assert.deepEqual(editor.doc,gesture);assert.ok(editor.before);editor.cancel();assert.deepEqual(editor.doc,before);
 const foreign=fixture(),blocked=new Set([voxelKey(cells[0])]);assert.throws(()=>planVoxelExtrude(foreign.editor,foreign.selection,4,1,blocked),/其他物体/);assert.equal(foreign.editor.past.length,0);
});
