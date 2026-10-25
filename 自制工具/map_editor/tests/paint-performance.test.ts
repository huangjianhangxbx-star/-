import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAsset} from '../core/workshop-documents.ts';
import {SurfacePaintLayer} from '../desktop/surface-paint-layer.ts';
import {applyPaintDelta,emptyPaint} from '../desktop/paint-command-queue.ts';
import {PaintSurfaceDomain} from '../core/paint-surface-domain.ts';
import {PaintSelection,fillPixels,fillPixelsChunked} from '../core/paint-selection.ts';
test('paint overlays retain resources, skip unchanged faces and release the last erased face',()=>{
 (globalThis as any).document={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})};
 const asset=createAsset('layer');asset.cells=[{x:0,y:0,z:0,color:0}];asset.paintSource=applyPaintDelta(emptyPaint(),[{key:'0,0,0,4',index:'0',color:'#123456'}]);const layer=new SurfacePaintLayer(new THREE.Group());layer.update(asset);const mesh=layer.group.children[0] as THREE.Mesh,geometry=mesh.geometry,material=mesh.material,texture=(material as THREE.MeshBasicMaterial).map;for(let i=0;i<20;i++){asset.paintSource=applyPaintDelta(asset.paintSource,[{key:'0,0,0,4',index:'0',color:i%2?'#123456':'#abcdef'}]);layer.update(asset);assert.equal(layer.group.children[0],mesh);assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal((mesh.material as THREE.MeshBasicMaterial).map,texture);}const count=layer.stats.updated;layer.update(asset);assert.equal(layer.stats.updated,count);assert.equal(layer.stats.created,1);asset.paintSource=emptyPaint();layer.update(asset);assert.equal(layer.group.children.length,0);assert.equal(layer.stats.removed,1);layer.dispose();
});
test('cooperative fills equal the reference, and cancellation returns no partial mask',async()=>{
 const cells=Array.from({length:9},(_,x)=>({x:x-4,y:0,z:0})),domain=new PaintSurfaceDomain(cells,new Set(cells.map(c=>[c.x,c.y,c.z].join(','))),.25),start=domain.pixel({face:4,plane:1},0,0)!,selection=new PaintSelection();
 for(const range of ['face','plane','selection']){if(range==='selection')selection.change('4:1',domain.chartPixels({face:4,plane:1}).filter(p=>p.u%2===0),'replace');const expected=fillPixels(domain,start,range,selection,()=> '#123456',0,()=>true);const actual=await fillPixelsChunked(domain,start,range,selection,()=> '#123456',0,()=>true,()=>false,async()=>{});assert.deepEqual(actual!.map(p=>p.key+':'+p.index).sort(),expected.map(p=>p.key+':'+p.index).sort());}
 selection.clear();let checks=0;const cancelled=await fillPixelsChunked(domain,start,'plane',selection,()=> '#123456',0,()=>true,()=>++checks>40,async()=>{});assert.equal(cancelled,null);
});

import {CanvasSession,upgradeCanvases} from '../core/workshop-canvases.ts';
test('pure paint fast commit preserves opaque-owner and asset-wide pixel budgets atomically',()=>{
 const a=createAsset('budget');a.cells=Array.from({length:1026},(_,x)=>({x,y:0,z:0,color:0}));const model=upgradeCanvases(a,'first');const other=structuredClone(model.canvases![0]);other.canvasId='other';other.originTicks=[0,16,0];other.paintSource=emptyPaint();for(let x=0;x<1010;x++){const pixels:Record<string,string>={};for(let i=0;i<256;i++)pixels[i]='#123456';other.paintSource.faces[x+',0,0,4']=pixels;}model.canvases!.push(other);const session=new CanvasSession(model);session.setEditObject(session.model.objects!.find(o=>o.canvasIds[0]===session.activeId)!.objectId);const source=emptyPaint();for(let x=0;x<16;x++){const pixels:Record<string,string>={};for(let i=0;i<256;i++)pixels[i]='#123456';source.faces[x+',0,0,4']=pixels;}const before=structuredClone(session.model);assert.throws(()=>session.paint(source),/资产预算/);assert.deepEqual(session.model,before);assert.equal(session.past.length,0);
 session.model.materialProfile.colors[0].alpha=.5;assert.throws(()=>session.paint(applyPaintDelta(emptyPaint(),[{key:'0,0,0,4',index:'0',color:'#123456'}])),/不透明/);assert.equal(session.past.length,0);
});
