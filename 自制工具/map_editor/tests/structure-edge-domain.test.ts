import test from 'node:test';
import assert from 'node:assert/strict';
import {createAsset, type AssetDocument, type Cell} from '../core/workshop-documents.ts';
import {CanvasSession, type ModelCanvas} from '../core/workshop-canvases.ts';
import {StructureEdgeDomain} from '../core/structure-edge-domain.ts';

const key=(c:Pick<Cell,'x'|'y'|'z'>)=>`${c.x},${c.y},${c.z}`;
function fixture(cells:Cell[],step=.25,origin:[number,number,number]=[0,0,0]){
  const session=new CanvasSession(createAsset('structure'));
  const canvas=session.active;canvas.cells=cells;canvas.voxelStepM=step;canvas.originTicks=origin;
  session.model.objects=[{objectId:'target',name:'Target',canvasIds:[canvas.canvasId],originTicks:[0,0,0],cellKeys:cells.map(key)}];
  return session.model;
}
const c=(x:number,y:number,z:number,color=0):Cell=>({x,y,z,color});
const cuboid=(x:number,y:number,z:number)=>Array.from({length:x*y*z},(_,i)=>c(i%x,Math.floor(i/x)%y,Math.floor(i/(x*y))));
function canvas(model:AssetDocument,cells:Cell[],step=.25,origin:[number,number,number]=[0,0,0],id='other'):ModelCanvas{
  const out:ModelCanvas={canvasId:id,name:id,visible:false,locked:true,voxelStepM:step,originTicks:origin,cells,protectedColumns:[]};
  model.canvases!.push(out);model.objects!.push({objectId:id,name:id,canvasIds:[id],originTicks:[0,0,0],cellKeys:cells.map(key)});return out;
}

test('A01 continuous differently colored slab has twelve outer segments and no voxel seams',()=>{
 const model=fixture(cuboid(3,2,1).map((v,i)=>({...v,color:i%2}))),before=structuredClone(model);
 const domain=new StructureEdgeDomain(model,'target');
 assert.equal(domain.edges.length,12);assert.equal(domain.diagnostics.ambiguous,0);
 assert.ok(domain.edges.every(e=>e.start.every(Number.isInteger)&&e.end.every(Number.isInteger)));
 assert.ok(!domain.edges.some(e=>e.axis===1&&e.start[0]===16&&e.start[2]===16));
 assert.deepEqual(model,before);
 const recolored=structuredClone(model);recolored.revision++;recolored.canvases![0].cells.forEach(v=>v.color=2);recolored.anchorM=[.125,-.25,6];
 const again=new StructureEdgeDomain(recolored,'target');assert.equal(again.fingerprint,domain.fingerprint);assert.deepEqual(again.edges,domain.edges);
});

test('A02 steps recognize exposed top rims while concave foot and flat wall seams are excluded',()=>{
 const model=fixture([c(0,0,0),c(1,0,0),c(2,0,0),c(0,0,1),c(1,0,1),c(0,0,2)]),d=new StructureEdgeDomain(model,'target');
 assert.ok(d.edges.some(e=>e.axis===1&&e.start[0]===16&&e.start[2]===48&&e.faces.includes(4)));
 assert.ok(d.edges.some(e=>e.axis===1&&e.start[0]===32&&e.start[2]===32&&e.faces.includes(4)));
 assert.ok(!d.edges.some(e=>e.axis===1&&e.start[0]===16&&e.start[2]===32),'concave corner at step foot');
 assert.ok(!d.edges.some(e=>e.axis===0&&e.start[1]===0&&e.start[2]===16&&e.start[0]<32),'flat deep side wall grid seam');
 assert.ok(d.diagnostics.concave>0);
});

test('A03 ring hole exposes its true top rim and surface queries never project through air to a back wall',()=>{
 const cells=cuboid(3,3,1).filter(v=>v.x!==1||v.y!==1),model=fixture(cells),d=new StructureEdgeDomain(model,'target');
 assert.ok(d.edges.some(e=>e.faces.includes(4)&&e.start[0]===16&&e.start[2]===16));
 assert.equal(d.pixel(4,16,20,20),null);assert.equal(d.surfaceExists(4,16,20,20),false);
 assert.equal(d.pixel(0,16,20,8)?.face,0);assert.equal(d.pixel(0,48,20,8)?.face,0);
 assert.equal(d.pixel(0,16,55,8),null);
});

test('A04 diagonal contacts report ambiguity and overlapping exterior ownership is not silently chosen',()=>{
 const diagonal=new StructureEdgeDomain(fixture([c(0,0,0),c(1,1,0)]),'target');
 assert.ok(diagonal.diagnostics.ambiguous>0);assert.ok(diagonal.diagnostics.nonManifold>0);
 const model=fixture([c(0,0,0)]);canvas(model,[c(0,0,0)]);
 const overlapping=new StructureEdgeDomain(model,'target');
 assert.ok(overlapping.diagnostics.ambiguous>0);assert.ok(overlapping.diagnostics.overlapping>0);assert.equal(overlapping.pixel(4,16,4,4),null);
});

test('A05 foreign owner contributes continuous geometry but never gains target write ownership',()=>{
 const model=fixture([c(0,0,0),c(1,0,0)]),target=model.objects![0];target.cellKeys=['0,0,0'];
 model.objects!.push({objectId:'foreign',name:'Foreign',canvasIds:[target.canvasIds[0]],originTicks:[0,0,0],cellKeys:['1,0,0']});
 const d=new StructureEdgeDomain(model,'target');assert.equal(d.edges.length,12);
 assert.equal(d.pixel(0,16,3,3),null);assert.equal(d.surfaceExists(4,16,20,3),true);assert.equal(d.pixel(4,16,20,3),null);
 const isolated=new StructureEdgeDomain(model,'target','target');assert.equal(isolated.edges.length,12);assert.equal(isolated.pixel(0,16,3,3),null);assert.equal(isolated.surfaceExists(0,16,3,3),true);
});

test('A06 mixed precision partial side cover divides long edge at exact foreign breakpoints',()=>{
 const model=fixture([c(0,0,0)]);canvas(model,[c(0,0,0)],.125,[8,0,0]);
 const d=new StructureEdgeDomain(model,'target');
 assert.equal(d.pixel(0,16,3,3),null);assert.ok(d.pixel(0,16,10,3));
 assert.ok(!d.edges.some(e=>e.axis===2&&e.start[0]===16&&e.start[1]===0&&e.start[2]===0));
 assert.ok(d.edges.some(e=>e.axis===2&&e.start[0]===16&&e.start[1]===0&&e.start[2]===8&&e.end[2]===16));
 assert.equal(d.surfaceExists(0,16,3,3),false);assert.equal(d.surfaceExists(0,24,3,3),true);
});

test('A06 three precision coplanar canvases do not create a false contact line',()=>{
 const model=fixture([c(0,0,0)]);canvas(model,cuboid(2,2,2),.125,[8,0,0]);canvas(model,cuboid(4,4,4),.0625,[16,0,0],'fine');
 const d=new StructureEdgeDomain(model,'target');assert.equal(d.edges.length,12);assert.equal(d.diagnostics.ambiguous,0);
 assert.ok(!d.edges.some(e=>e.axis===1&&[16,32].includes(e.start[0])&&e.start[2]===16));
 assert.equal(d.pixel(0,16,4,4),null);
});

test('A07 negative coordinates and nonzero origins preserve native UV and ignore Root',()=>{
 for(const step of [.25,.125,.0625]){
  const n=step*64,model=fixture([c(-2,1,-1)],step,[3,-5,7]);model.palette=['#123456','#abcdef'];model.sideColor=1;
  const d=new StructureEdgeDomain(model,'target'),p=d.pixel(4,14,6-2*n+3,-10+n+2)!;
  assert.ok(p);assert.equal(p.key,'-2,1,-1,4');assert.equal(p.index,2*n+3);assert.deepEqual(d.globalUV(p),[6-2*n+3,-10+n+2]);
  assert.equal(d.baseColor(p),'#123456');assert.equal(d.baseColor(d.pixel(0,6-n,-10+n+2,14-n+1)!),'#abcdef');
  assert.deepEqual(model.anchorM,[0,0,0]);assert.ok(d.edges.every(e=>e.start[0]>=6-2*n&&e.end[0]<=6-n));
 }
});

test('A09 mask changes are outside geometry identity and pixel validity rejects non-native planes and indices',()=>{
 const d=new StructureEdgeDomain(fixture([c(0,0,0)]),'target');assert.equal(d.pixel(4,15,1,1),null);assert.equal(d.pixel(4,16,1.5,1),null);
 assert.equal(d.nativePixel('0,0,0,4',17)?.index,17);assert.equal(d.nativePixel('0,0,0,4',256),null);assert.equal(d.nativePixel('0,0,0,4',-1),null);
});

test('mixed precision T contacts and intersections equal an independent fine-grid union oracle',()=>{
 let seed=7123;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return seed>>>0;};
 for(let sample=0;sample<12;sample++){
  const model=fixture([c(0,0,0)]);
  for(let i=0;i<6;i++)canvas(model,[c(0,0,0)],[.25,.125,.0625][rand()%3],[0,1,2].map(()=>((rand()%17)-4)*2) as [number,number,number],'random'+i);
  const d=new StructureEdgeDomain(model,'target'),occupied=new Set<string>();
  // Test-only exhaustive 1/32 m microcells are an independent oracle, never the production representation.
  for(const cv of model.canvases!){const n=cv.voxelStepM*32;for(const v of cv.cells)for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++)occupied.add([cv.originTicks[0]+v.x*n+x,cv.originTicks[1]+v.y*n+y,cv.originTicks[2]+v.z*n+z].join(','));}
  const candidates=new Set<string>(),expected=new Set<string>(),actual=new Set<string>();
  for(const k of occupied){const p=k.split(',').map(Number);for(let axis=0;axis<3;axis++){const t=[0,1,2].filter(a=>a!==axis);for(let q=0;q<4;q++){const at=[...p];at[t[0]]+=q&1?1:0;at[t[1]]+=q&2?1:0;candidates.add([axis,...at].join(','));}}}
  for(const k of candidates){const [axis,...p]=k.split(',').map(Number),t=[0,1,2].filter(a=>a!==axis);let mask=0;for(let q=0;q<4;q++){const at=[...p];at[t[0]]+=q&1?0:-1;at[t[1]]+=q&2?0:-1;if(occupied.has(at.join(',')))mask|=1<<q;}if([1,2,4,8].includes(mask))expected.add(k);}
  for(const e of d.edges)for(let at=e.start[e.axis];at<e.end[e.axis];at+=2){const p=e.start.map(v=>v/2);p[e.axis]=at/2;actual.add([e.axis,...p].join(','));}
  assert.deepEqual(actual,expected,'convex union segments in fixture '+sample);
 }
});

test('native analysis rejects hidden targets and stays sparse across widely separated geometry',()=>{
 const model=fixture([c(-1000000,0,0),c(1000000,0,0)]),d=new StructureEdgeDomain(model,'target');assert.equal(d.edges.length,24);
 model.canvases![0].visible=false;assert.throws(()=>new StructureEdgeDomain(model,'target'),/隐藏/);
});

test('analysis rejects fractional native coordinates before indexing and invalidates changed ownership',()=>{
 assert.throws(()=>new StructureEdgeDomain(fixture([c(.5,0,0)]),'target'),/坐标/);
 const model=fixture([c(0,0,0)]);canvas(model,[c(0,0,0)],.125,[8,0,0]);const a=new StructureEdgeDomain(model,'target');
 model.objects![1].objectId='changed-ownership';const b=new StructureEdgeDomain(model,'target');assert.notEqual(a.fingerprint,b.fingerprint);
});
