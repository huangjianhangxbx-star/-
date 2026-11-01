import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EditorDocument,createMap} from '../core/document.ts';
import {EditOperationSession} from '../core/edit-operation.ts';
import {creativeConfig} from '../core/creative-build.ts';
import type {Vec3} from '../core/workshop-documents.ts';

const api:any=await import('../core/axis-line-stroke.ts').catch((error:any)=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
type Pointer={clientX:number;clientY:number};
function drag(){assert.equal(typeof api.ProjectedAxisDrag,'function','Projected axis drag is missing');return new api.ProjectedAxisDrag();}
function stroke(options?:Record<string,number>){assert.equal(typeof api.AxisLineStroke,'function','Axis line stroke is missing');return new api.AxisLineStroke(options);}
const linear=(p:Vec3):Pointer=>({clientX:p[0]*20+p[2]*8,clientY:p[1]*20-p[2]*16});
const moved=(p:Pointer,a:Pointer,b:Pointer,n:number):Pointer=>({clientX:p.clientX+(b.clientX-a.clientX)*n,clientY:p.clientY+(b.clientY-a.clientY)*n});
function projected(){
 const camera=new THREE.OrthographicCamera(-5,5,4,-4,.1,100);camera.position.set(7,9,11);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
 return (p:Vec3):Pointer=>{const v=new THREE.Vector3(p[0]*.25,p[2]*.25,-p[1]*.25).project(camera);return {clientX:(v.x+1)*500,clientY:(1-v.y)*400};};
}

test('real orthographic projections select signed X, Y and Z while preserving the drag origin grid phase',()=>{
 const project=projected(),origin:Vec3=[.5,-1.25,2],start={clientX:431,clientY:329};
 for(const axis of [0,1,2])for(const steps of [-7,6]){
  const d=drag(),next=[...origin] as Vec3;next[axis]++;
  d.begin(origin,start,project);const result=d.sample(moved(start,project(origin),project(next),steps));
  const expected=[...origin];expected[axis]+=steps;
  assert.equal(result.axis,axis);assert.equal(result.steps,steps);assert.deepEqual(result.end,expected);
 }
});

test('a six-pixel dead zone suppresses jitter, then one axis remains locked despite a later direction change',()=>{
 const d=drag(),start={clientX:100,clientY:80};d.begin([0,0,0],start,linear,[0,1]);
 assert.deepEqual(d.sample({clientX:105,clientY:80}),{axis:null,steps:0,end:[0,0,0]});
 assert.equal(d.sample({clientX:120,clientY:81}).axis,0);
 const turned=d.sample({clientX:140,clientY:250});assert.equal(turned.axis,0);assert.deepEqual(turned.end,[2,0,0]);
 d.cancel();assert.equal(d.active,false);assert.equal(d.sample(start),null);
 d.begin([0,0,0],start,linear,[0,1]);assert.equal(d.sample({clientX:100,clientY:120}).axis,1);d.reset();assert.equal(d.active,false);
});

test('native event-like pointers with inherited coordinate getters can lock and extend a Shift line',()=>{
 class PointerInput extends Event {
  #x:number;#y:number;
  constructor(x:number,y:number){super('pointermove');this.#x=x;this.#y=y;}
  get clientX(){return this.#x;}
  get clientY(){return this.#y;}
 }
 const start=new PointerInput(100,80),end=new PointerInput(140,80);
 assert.equal(Object.hasOwn(start,'clientX'),false);
 const d=drag();d.begin([2,3,1],start,linear,[0,1]);assert.deepEqual(d.sample(end),{axis:0,steps:2,end:[4,3,1]});
 const s=stroke();s.begin({x:2,y:3,z:1,face:4},start,linear);
 const frame=s.sample(end);assert.equal(frame.axis,0);assert.deepEqual(frame.hits.map((p:any)=>[p.x,p.y,p.z]),[[2,3,1],[3,3,1],[4,3,1]]);
});

test('an axis pointing into the camera is ignored and paste drags do not inherit modeling line or coordinate budgets',()=>{
 const d=drag(),project=(p:Vec3)=>({clientX:p[0]*10,clientY:p[1]*10});
 d.begin([0,0,0],{clientX:0,clientY:0},project,[2]);assert.deepEqual(d.sample({clientX:500,clientY:500}),{axis:null,steps:0,end:[0,0,0]});
 d.begin([8192,0,0],{clientX:0,clientY:0},project,[0]);assert.deepEqual(d.sample({clientX:90000,clientY:0}),{axis:0,steps:9000,end:[17192,0,0]});
});

test('stroke emits every cell in either direction and translates source-cell metadata without changing the start face',()=>{
 const s=stroke(),hit={x:2,y:3,z:1,face:4,cell:{x:2,y:3,z:0,color:3}},start=linear([2,3,1]);
 s.begin(hit,start,linear);const frame=s.sample({clientX:start.clientX-80,clientY:start.clientY+1});
 assert.equal(frame.axis,0);assert.deepEqual(frame.hits.map((p:any)=>[p.x,p.y,p.z]),[[2,3,1],[1,3,1],[0,3,1],[-1,3,1],[-2,3,1]]);
 assert.ok(frame.hits.every((p:any)=>p.face===4&&p.cell.z===0&&p.cell.x===p.x&&p.cell.color===3));
 frame.hits[0].cell.color=9;assert.equal(hit.cell.color,3);
 assert.deepEqual(s.release(),{x:-2,y:3,z:1,face:4,cell:{x:-2,y:3,z:0,color:3}});assert.equal(s.active,false);assert.equal(s.sample(start),null);
});

test('side work planes permit vertical lines and explicit volume work planes exclude their normal axis',()=>{
 const project=projected();
 for(const [face,axis]of [[0,2],[2,2],[4,1]] as [number,number][]){
  const s=stroke(),origin:Vec3=[0,0,0],next=[...origin] as Vec3;next[axis]++;
  s.begin({x:0,y:0,z:0,face},project(origin),project);const frame=s.sample(moved(project(origin),project(origin),project(next),-4));
  assert.equal(frame.axis,axis);assert.equal(frame.hits.length,5);assert.ok(frame.hits.every((p:any)=>[p.x,p.y,p.z][Math.floor(face/2)]===0));
 }
 const s=stroke();s.begin({x:0,y:0,z:0,face:4},{clientX:0,clientY:0},linear,{planeAxis:0});
 const frame=s.sample({clientX:0,clientY:80});assert.equal(frame.axis,1);assert.ok(frame.hits.every((p:any)=>p.x===0));
});

test('a frozen surface line extends beyond the starting support in stack and creative without stair steps',()=>{
 for(const mode of ['stack','creative']){
  const e=new EditorDocument();e.begin();e.volume(0,0,0,0);e.commit();e.past=[];
  const operation=new EditOperationSession(e),config=mode==='creative'?creativeConfig(1,'add'):{...creativeConfig(1,'add'),mode:'stack'};
  operation.begin(config);const s=stroke(),hit={x:0,y:0,z:1,face:4,cell:{x:0,y:0,z:0,color:0}};
  s.begin(hit,{clientX:0,clientY:0},linear);const frame=s.sample({clientX:80,clientY:0});
  for(const point of frame.hits)operation.apply(mode==='creative'?operation.creative(point,true):operation.brush(point));
  operation.commit();assert.equal(e.past.length,1);assert.deepEqual(e.doc.cells.filter((c:any)=>c.z===1).map((c:any)=>c.x).sort((a:number,b:number)=>a-b),[0,1,2,3,4]);
  assert.ok(!e.doc.cells.some((c:any)=>c.z>1));e.undo();assert.equal(e.doc.cells.length,1);e.redo();assert.equal(e.doc.cells.length,6);
 }
});

test('releasing Shift resumes normal hits in the same transaction, and cancellation removes the entire line',()=>{
 const e=new EditorDocument(),operation=new EditOperationSession(e);operation.begin({...creativeConfig(0,'add'),mode:'volume'});
 const s=stroke();s.begin({x:0,y:0,z:0,face:4},{clientX:0,clientY:0},linear);
 for(const point of s.sample({clientX:60,clientY:0}).hits)operation.apply(operation.brush(point));
 const endpoint=s.release();assert.deepEqual([endpoint.x,endpoint.y,endpoint.z],[3,0,0]);
 operation.apply(operation.brush({x:3,y:2,z:0,face:4}));assert.equal(operation.active,true);assert.equal(e.past.length,0);
 operation.cancel();s.cancel();assert.equal(e.cells.size,0);assert.equal(e.past.length,0);assert.equal(s.active,false);
});

test('line point and coordinate limits reject large gestures without allocating or changing the last valid endpoint',()=>{
 const s=stroke();s.begin({x:0,y:0,z:0,face:4},{clientX:0,clientY:0},linear);
 assert.equal(s.sample({clientX:20*512,clientY:0}).hits.length,513);
 assert.throws(()=>s.sample({clientX:20*513,clientY:0}),/预算|跨度|513/);assert.equal(s.release().x,512);
 s.begin({x:8191,y:0,z:0,face:4},{clientX:0,clientY:0},linear);assert.throws(()=>s.sample({clientX:40,clientY:0}),/坐标|范围|边界/);
 assert.throws(()=>s.begin({x:0,y:0,z:0,face:9},{clientX:0,clientY:0},linear),/面|方向/);
 const d=drag();assert.throws(()=>d.begin([0,0,0],{clientX:NaN,clientY:0},linear),/坐标|位置|投影/);
});

test('native voxel budget failures cancel the whole surface line, including earlier samples in that stroke',()=>{
 const map=createMap();map.cells=Array.from({length:249999},(_,i)=>({x:i%500,y:Math.floor(i/500),z:0,color:0,owner:'volume'}));
 const e=new EditorDocument(map),operation=new EditOperationSession(e);operation.begin({...creativeConfig(1,'add'),mode:'stack'});
 const s=stroke();s.begin({x:0,y:0,z:1,face:4},{clientX:0,clientY:0},linear);const frame=s.sample({clientX:20,clientY:0});
 assert.throws(()=>{for(const point of frame.hits)operation.apply(operation.brush(point));},/预算/);
 operation.cancel();s.cancel();assert.equal(e.cells.size,249999);assert.ok(!e.cells.has('0,0,1'));assert.equal(e.past.length,0);
});
