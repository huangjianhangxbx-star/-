import type {BrushConfig} from './brush.ts';
import {faceNormals,faceOffsets} from './surface.ts';
export function creativeConfig(color:number,action:'add'|'erase'):BrushConfig {
 return {mode:'creative',action,color,shape:'square',size:1,thickness:1,level:0,direction:1,tag:''};
}
export function creativeCell(hit:{x:number;y:number;z:number;face?:number},action:string){
 const face=hit.face??4,n=faceNormals[face],offset=faceOffsets[face];if(!n)throw Error('命中面无效');
 const source=[hit.x,hit.y,hit.z].map((v,i)=>v+offset[i]);
 const target=source.map((v,i)=>v+(action==='add'?n[i]:0));
 return {source,target,face};
}
export function interpolateScreen(a:{clientX:number;clientY:number},b:{clientX:number;clientY:number}){
 const n=Math.max(1,Math.ceil(Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY)/4));
 if(n>4096)throw Error('单次采样跨度过大');
 return Array.from({length:n},(_,i)=>({clientX:a.clientX+(b.clientX-a.clientX)*(i+1)/n,clientY:a.clientY+(b.clientY-a.clientY)*(i+1)/n}));
}
export class MiddleGesture {
 private origin:{x:number;y:number}|null=null;
 dragging=false;
 get active(){return this.origin!==null;}
 begin(x:number,y:number){this.origin={x,y};this.dragging=false;}
 move(x:number,y:number){if(this.origin&&Math.hypot(x-this.origin.x,y-this.origin.y)>5)this.dragging=true;return this.dragging;}
 end(){const result=this.origin?(this.dragging?'pan':'pick'):null;this.cancel();return result;}
 cancel(){this.origin=null;this.dragging=false;}
}
