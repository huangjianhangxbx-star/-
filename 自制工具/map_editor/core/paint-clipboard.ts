import type {SurfacePaint} from './surface-paint.ts';
import {PaintSurfaceDomain,type SurfacePixel,pixelKey} from './paint-surface-domain.ts';
export type PaintPatch={width:number;height:number;pixels:{u:number;v:number;color:string}[]};
export function copyPaintPatch(source:SurfacePaint,selected:SurfacePixel[],domain:PaintSurfaceDomain):PaintPatch{
 if(!selected.length)throw Error('先框选要复制的绘图');
 const points=selected.map(p=>({uv:domain.uv(p),color:source.faces[p.key]?.[p.index]}));
 const minU=points.reduce((n,p)=>Math.min(n,p.uv[0]),Infinity),minV=points.reduce((n,p)=>Math.min(n,p.uv[1]),Infinity);
 const maxU=points.reduce((n,p)=>Math.max(n,p.uv[0]),-Infinity),maxV=points.reduce((n,p)=>Math.max(n,p.uv[1]),-Infinity);
 const pixels=points.filter(p=>p.color).map(p=>({u:p.uv[0]-minU,v:p.uv[1]-minV,color:p.color!}));
 if(!pixels.length)throw Error('选区内没有绘图笔迹');
 return {width:maxU-minU+1,height:maxV-minV+1,pixels};
}
type V=[number,number,number];
type Frame={pixel:SurfacePixel;u:V;v:V};
const axis=(a:number,sign=1):V=>[0,1,2].map(i=>i===a?sign:0) as V;
const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0);
const neg=(v:V)=>v.map(n=>-n) as V;
function walk(d:PaintSurfaceDomain,frame:Frame,du:number,dv:number):Frame|null{
 const p=frame.pixel,n=d.n,a=p.face>>1,normal=axis(a,p.face%2?-1:1),t=[0,1,2].filter(i=>i!==a);
 const pos=[p.x*n*2,p.y*n*2,p.z*n*2] as V;pos[a]+=p.face%2?0:2*n;pos[t[0]]+=p.u*2+1;pos[t[1]]+=p.v*2+1;
 const dir=frame.u.map((v,i)=>v*du+frame.v[i]*dv) as V;
 const at=(center:V,norm:V):SurfacePixel|null=>{
  const ax=norm.findIndex(v=>v!==0),face=ax*2+(norm[ax]<0?1:0),tangent=[0,1,2].filter(i=>i!==ax);
  if(center[ax]%(2*n)!==0)return null;
  return d.pixel({face,plane:center[ax]/(2*n)},Math.floor(center[tangent[0]]/2),Math.floor(center[tangent[1]]/2));
 };
 const flat=at(pos.map((v,i)=>v+2*dir[i]) as V,normal);if(flat)return {...frame,pixel:flat};
 for(const bend of [-1,1]){
  const norm=bend===-1?dir:neg(dir),forward=bend===-1?neg(normal):normal;
  const pixel=at(pos.map((v,i)=>v+dir[i]+bend*normal[i]) as V,norm);
  if(pixel){const turn=(v:V)=>v.map((x,i)=>x-dot(v,dir)*dir[i]+dot(v,dir)*forward[i]) as V;return {pixel,u:turn(frame.u),v:turn(frame.v)};}
 }
 return null;
}
export function placePaintPatch(patch:PaintPatch,d:PaintSurfaceDomain,hit:SurfacePixel,turns:number,scale:number,wrap:boolean){
 if(!Number.isFinite(scale)||scale<.125||scale>8)throw Error('粘贴比例为12.5%到800%');
 const rotation=((turns%4)+4)%4,w=Math.max(1,Math.round(patch.width*scale)),h=Math.max(1,Math.round(patch.height*scale));
 if(w*h>262144)throw Error('粘贴范围超过像素预算');
 const width=rotation%2?h:w,height=rotation%2?w:h,colors=new Map(patch.pixels.map(p=>[p.u+','+p.v,p.color])),wanted=new Map<string,string>();
 for(let v=0;v<h;v++)for(let u=0;u<w;u++){
  const color=colors.get(Math.min(patch.width-1,Math.floor(u/scale))+','+Math.min(patch.height-1,Math.floor(v/scale)));if(!color)continue;
  const uv=rotation===0?[u,v]:rotation===1?[h-1-v,u]:rotation===2?[w-1-u,h-1-v]:[v,w-1-u];
  wanted.set((uv[0]-Math.floor(width/2))+','+(uv[1]-Math.floor(height/2)),color);
 }
 const out:{pixel:SurfacePixel;color:string}[]=[],seenSurface=new Set<string>(),uv=d.uv(hit),chart=d.chart(hit);
 if(!wrap){for(const [id,color] of wanted){const [u,v]=id.split(',').map(Number),pixel=d.pixel(chart,uv[0]+u,uv[1]+v);if(pixel)out.push({pixel,color});}return out;}
 const tangents=[0,1,2].filter(a=>a!==(hit.face>>1)),pending:{u:number;v:number;frame:Frame}[]=[{u:0,v:0,frame:{pixel:hit,u:axis(tangents[0]),v:axis(tangents[1])}}],seen=new Set<string>(['0,0']);
 for(let i=0;i<pending.length;i++){
  const {u,v,frame}=pending[i],color=wanted.get(u+','+v),id=pixelKey(frame.pixel);
  if(color&&!seenSurface.has(id)){out.push({pixel:frame.pixel,color});seenSurface.add(id);}
  for(const [du,dv] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=u+du,y=v+dv,key=x+','+y;if(seen.has(key)||x< -Math.floor(width/2)||x>=Math.ceil(width/2)||y< -Math.floor(height/2)||y>=Math.ceil(height/2))continue;
   const next=walk(d,frame,du,dv);if(next){seen.add(key);pending.push({u:x,v:y,frame:next});}
  }
 }
 return out;
}
