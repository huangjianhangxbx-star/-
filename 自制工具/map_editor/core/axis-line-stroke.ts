import type {Vec3} from './workshop-documents.ts';

export type Axis=0|1|2;
export type ScreenPoint={clientX:number;clientY:number};
export type AxisProjector=(point:Vec3)=>ScreenPoint|null;
export type ProjectedAxisSample={axis:Axis|null;steps:number;end:Vec3};
type AxisVector={axis:Axis;x:number;y:number;lengthSquared:number};
const isAxis=(value:number):value is Axis=>value===0||value===1||value===2;
function screen(point:ScreenPoint){if(!point||![point.clientX,point.clientY].every(Number.isFinite))throw Error('鼠标投影坐标无效');}
function vector(point:Vec3){if(!Array.isArray(point)||point.length!==3||point.some(v=>!Number.isFinite(v)))throw Error('起点坐标无效');}

/** Shared screen-space axis choice. It has no modeling or placement budget policy. */
export class ProjectedAxisDrag {
 private origin:Vec3|null=null;
 private pointer:ScreenPoint={clientX:0,clientY:0};
 private vectors:AxisVector[]=[];
 private locked:Axis|null=null;
 private threshold:number;
 constructor(options:{thresholdPx?:number}={}){
  this.threshold=options.thresholdPx??6;
  if(!Number.isFinite(this.threshold)||this.threshold<0)throw Error('轴锁定门槛无效');
 }
 get active(){return this.origin!==null;}
 get axis(){return this.locked;}
 begin(origin:Vec3,pointer:ScreenPoint,project:AxisProjector,axes:readonly Axis[]=[0,1,2]){
  vector(origin);screen(pointer);
  if(!axes.length||axes.some(axis=>!isAxis(axis)))throw Error('可选轴方向无效');
  const base=project([...origin]),vectors:AxisVector[]=[];
  if(base){screen(base);for(const axis of new Set(axes)){
   const point=[...origin] as Vec3;point[axis]++;
   const projected=project(point);if(!projected)continue;screen(projected);
   const x=projected.clientX-base.clientX,y=projected.clientY-base.clientY,lengthSquared=x*x+y*y;
   // The view direction has no usable screen-space extent.
   if(lengthSquared>1e-8)vectors.push({axis,x,y,lengthSquared});
  }}
  this.origin=[...origin];this.pointer={clientX:pointer.clientX,clientY:pointer.clientY};this.vectors=vectors;this.locked=null;
 }
 sample(pointer:ScreenPoint):ProjectedAxisSample|null {
  if(!this.origin)return null;screen(pointer);
  const x=pointer.clientX-this.pointer.clientX,y=pointer.clientY-this.pointer.clientY;
  let axis=this.locked;
  if(axis===null&&Math.hypot(x,y)>=this.threshold){
   let score=-Infinity;
   for(const candidate of this.vectors){const dot=x*candidate.x+y*candidate.y,next=dot*dot/candidate.lengthSquared;
    if(next>score){score=next;axis=candidate.axis;}}
  }
  if(axis===null)return {axis:null,steps:0,end:[...this.origin]};
  const basis=this.vectors.find(v=>v.axis===axis)!,steps=Math.round((x*basis.x+y*basis.y)/basis.lengthSquared)||0,end=[...this.origin] as Vec3;
  if(!Number.isSafeInteger(steps))throw Error('轴移动坐标超出安全范围');
  end[axis]+=steps;if(end.some(v=>!Number.isFinite(v)))throw Error('轴移动坐标超出安全范围');
  this.locked=axis;return {axis,steps,end};
 }
 cancel(){this.origin=null;this.vectors=[];this.locked=null;}
 reset(){this.cancel();}
}

export type AxisLineHit={x:number;y:number;z:number;face?:number;cell?:{x:number;y:number;z:number;[key:string]:unknown};[key:string]:unknown};
export type AxisLineSample={axis:Axis|null;steps:number;hits:AxisLineHit[];end:AxisLineHit};
export type AxisLineStart={planeAxis?:Axis;axes?:readonly Axis[]};
const coordinates=['x','y','z'] as const;
const copyHit=(hit:AxisLineHit):AxisLineHit=>({...hit,...(hit.cell?{cell:{...hit.cell}}:{})});
function checkHit(hit:AxisLineHit){
 if(!coordinates.every(key=>Number.isSafeInteger(hit[key])&&Math.abs(hit[key])<=8192))throw Error('直线笔画坐标超出范围');
 if(hit.face!==undefined&&(!Number.isInteger(hit.face)||hit.face<0||hit.face>5))throw Error('起笔表面方向无效');
 if(hit.cell&&!coordinates.every(key=>Number.isSafeInteger(hit.cell![key])&&Math.abs(hit.cell![key])<=8192))throw Error('起笔体素坐标超出范围');
}

/** Frozen-face continuous hits; the caller keeps one EditOperationSession transaction. */
export class AxisLineStroke {
 private drag:ProjectedAxisDrag;
 private start:AxisLineHit|null=null;
 private last:AxisLineHit|null=null;
 private maxPoints:number;
 constructor(options:{thresholdPx?:number;maxPoints?:number}={}){
  this.drag=new ProjectedAxisDrag(options);this.maxPoints=options.maxPoints??513;
  if(!Number.isSafeInteger(this.maxPoints)||this.maxPoints<1||this.maxPoints>250000)throw Error('直线笔画点数预算无效');
 }
 get active(){return this.start!==null;}
 get axis(){return this.drag.axis;}
 begin(hit:AxisLineHit,pointer:ScreenPoint,project:AxisProjector,options:AxisLineStart={}):AxisLineSample {
  checkHit(hit);const plane=options.planeAxis??Math.floor((hit.face??4)/2);
  if(!isAxis(plane))throw Error('起笔工作面方向无效');
  const axes=options.axes??([0,1,2] as Axis[]).filter(axis=>axis!==plane);
  this.drag.begin([hit.x,hit.y,hit.z],pointer,project,axes);this.start=copyHit(hit);this.last=copyHit(hit);
  return {axis:null,steps:0,hits:[copyHit(hit)],end:copyHit(hit)};
 }
 private point(axis:Axis|null,steps:number):AxisLineHit {
  const hit=copyHit(this.start!);if(axis!==null){const key=coordinates[axis];hit[key]+=steps;if(hit.cell)hit.cell[key]+=steps;}return hit;
 }
 sample(pointer:ScreenPoint):AxisLineSample|null {
  if(!this.start)return null;const frame=this.drag.sample(pointer)!;
  const count=Math.abs(frame.steps)+1;if(count>this.maxPoints)throw Error(`直线笔画跨度超过 ${this.maxPoints} 点预算`);
  const end=this.point(frame.axis,frame.steps);checkHit(end);
  const sign=Math.sign(frame.steps),hits=Array.from({length:count},(_,i)=>this.point(frame.axis,i*sign));
  this.last=copyHit(end);return {axis:frame.axis,steps:frame.steps,hits,end};
 }
 release(){const end=this.last?copyHit(this.last):null;this.cancel();return end;}
 cancel(){this.drag.cancel();this.start=null;this.last=null;}
 reset(){this.cancel();}
}
