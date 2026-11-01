import {validateAsset,type AssetDocument,type Cell,type Vec3} from './workshop-documents.ts';
import {composeLayers} from './paint-layers.ts';
import {parsePaintFaceKey,paintResolution,type SurfacePaint} from './surface-paint.ts';
import type {ModelCanvas} from './workshop-canvases.ts';
import type {FaceTone} from './face-tone.ts';

export type CanvasResampleReport={canvasId:string;fromStep:number;toStep:number;beforeCells:number;afterCells:number;ownerConflicts:number;colorConflicts:number;paintConflicts:number;toneConflicts:number;volumeDeltaM3:number;warnings:string[]};
const key=(p:Pick<Cell,'x'|'y'|'z'>)=>[p.x,p.y,p.z].join(',');
const pos=(p:Cell):Vec3=>[p.x,p.y,p.z];
const pointKey=(p:readonly number[])=>p.join(',');
function ranked<T extends string|number>(values:T[]):T {
 const votes=new Map<T,number>();for(const value of values)votes.set(value,(votes.get(value)??0)+1);
 return [...votes].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:a[0]>b[0]?1:0))[0][0];
}
function majority(cells:Cell[],point:Vec3):Cell {
 const color=ranked(cells.map(c=>c.color)),same=cells.filter(c=>c.color===color),owner=ranked(same.map(c=>c.owner??'height'));
 return {...same.find(c=>(c.owner??'height')===owner)!,x:point[0],y:point[1],z:point[2]};
}
function groups(cells:Cell[],ratio:number){
 const result=new Map<string,Cell[]>();for(const cell of cells){const id=pointKey(pos(cell).map(v=>Math.floor(v*ratio)));if(!result.has(id))result.set(id,[]);result.get(id)!.push(cell);}return result;
}
function split(cells:Cell[],ratio:number):Cell[]{
 const result:Cell[]=[];for(const cell of cells)for(let x=0;x<ratio;x++)for(let y=0;y<ratio;y++)for(let z=0;z<ratio;z++)result.push({...cell,x:cell.x*ratio+x,y:cell.y*ratio+y,z:cell.z*ratio+z});return result;
}
function resampleRows(cells:Cell[],ratio:number):Cell[]{return ratio>1?split(cells,ratio):[...groups(cells,ratio)].map(([id,rows])=>majority(rows,id.split(',').map(Number) as Vec3));}

function appearance(source:ModelCanvas,target:ModelCanvas,report:CanvasResampleReport){
 const ratio=source.voxelStepM/target.voxelStepM,oldN=paintResolution(source.voxelStepM),newN=paintResolution(target.voxelStepM),live=new Set(target.cells.map(key)),surfaces=new Map<string,Vec3>();
 const exterior=(point:Vec3,face:number):Vec3=>{
  const id=pointKey(point)+','+face,cached=surfaces.get(id);if(cached)return cached;
  const axis=Math.floor(face/2),sign=face%2?-1:1,path:string[]=[];let cursor=[...point] as Vec3;
  while(true){const cache=surfaces.get(pointKey(cursor)+','+face);if(cache){cursor=cache;break;}path.push(pointKey(cursor)+','+face);const next=[...cursor] as Vec3;next[axis]+=sign;if(!live.has(pointKey(next)))break;cursor=next;}
  for(const id of path)surfaces.set(id,cursor);return cursor;
 };
 const projected=(p:number[],u:number,v:number):{point:Vec3;index:number;priority:number}=>{
  const face=p[3],axis=Math.floor(face/2),positive=face%2===0,axes=[0,1,2].filter(a=>a!==axis),q=[0,0,0] as Vec3;
  const pixels=[p[axes[0]]*oldN+u,p[axes[1]]*oldN+v];q[axes[0]]=Math.floor(pixels[0]/newN);q[axes[1]]=Math.floor(pixels[1]/newN);
  q[axis]=ratio>1?(p[axis]+(positive?1:0))*ratio-(positive?1:0):Math.floor(p[axis]*ratio);
  const point=ratio<1?exterior(q,face):q,index=((pixels[1]%newN+newN)%newN)*newN+(pixels[0]%newN+newN)%newN;
  return {point,index,priority:(p[axis]+(positive?1:0))*(positive?1:-1)};
 };
 const mapFaces=(faces:SurfacePaint['faces'])=>{
  const result:SurfacePaint['faces']={},priorities=new Map<string,number>();
  for(const [face,pixels]of Object.entries(faces)){
   const p=parsePaintFaceKey(face);
   for(const [index,color]of Object.entries(pixels)){
    const mapped=projected(p,Number(index)%oldN,Math.floor(Number(index)/oldN)),id=pointKey(mapped.point)+','+p[3],slot=id+':'+mapped.index;
    if(!live.has(pointKey(mapped.point)))throw Error('绘画重采样找不到所属体素');
    if(priorities.has(slot)){report.paintConflicts++;if(priorities.get(slot)!>mapped.priority)continue;}
    priorities.set(slot,mapped.priority);(result[id]??={})[mapped.index]=color;
   }
  }
  return result;
 };
 if(source.paintSource){const paint=source.paintSource;target.paintSource=paint.layers?composeLayers(paint.layers.map(layer=>({...layer,faces:mapFaces(layer.faces)}))):{...paint,faces:mapFaces(paint.faces)};}
 if(source.faceTone){
  const faces:FaceTone['faces']={},priorities=new Map<string,number>();
  if(ratio>1&&Object.keys(source.faceTone.faces).length*ratio*ratio>250000)throw Error('暗面细分超过面数预算');
  for(const [id,value]of Object.entries(source.faceTone.faces)){
   const p=parsePaintFaceKey(id),face=p[3],n=ratio>1?ratio:1;
   for(let a=0;a<n;a++)for(let b=0;b<n;b++){
    const mapped=projected(p,a*newN,b*newN),dest=pointKey(mapped.point)+','+face;
    if(priorities.has(dest)){if(JSON.stringify(faces[dest])!==JSON.stringify(value))report.toneConflicts++;if(priorities.get(dest)!>mapped.priority)continue;}
    priorities.set(dest,mapped.priority);faces[dest]={...value};
   }
  }
  target.faceTone={...source.faceTone,faces};
 }
}

/** Resample a native canvas in place in world space, returning a detached, fully valid model. */
export function resampleCanvas(input:AssetDocument,id:string,step:number):{model:AssetDocument;report:CanvasResampleReport}{
 if(![.25,.125,.0625].includes(step))throw Error('画布体素步长只支持 0.25 / 0.125 / 0.0625 米');
 const model=validateAsset(input),canvas=model.canvases?.find(c=>c.canvasId===id);if(!canvas)throw Error('画布不存在');
 const report:CanvasResampleReport={canvasId:id,fromStep:canvas.voxelStepM,toStep:step,beforeCells:canvas.cells.length,afterCells:canvas.cells.length,ownerConflicts:0,colorConflicts:0,paintConflicts:0,toneConflicts:0,volumeDeltaM3:0,warnings:[]};
 if(canvas.voxelStepM===step)return {model,report};
 if(canvas.locked||!canvas.visible)throw Error('画布已锁定或隐藏，不能重采样');
 const source=structuredClone(canvas),ratio=source.voxelStepM/step,objects=model.objects?.filter(o=>o.canvasIds.includes(id))??[],owners=new Map<string,string>();for(const object of objects)for(const key of object.cellKeys??[])owners.set(key,object.objectId);
 const layers=source.baseCells!==undefined||source.voxelCopies!==undefined,stored=layers?[source.baseCells??source.cells,...(source.voxelCopies??[]).map(copy=>copy.cells)]:[source.cells];
 if(ratio>1){
  const count=source.cells.length*ratio**3,other=model.canvases!.reduce((n,c)=>n+(c.canvasId===id?0:c.cells.length),0);
  if(count+other>250000||stored.reduce((n,rows)=>n+rows.length,0)*ratio**3>250000)throw Error('细分超过体素/副本 25 万格预算，模型未改变');
  for(const rows of stored)for(const cell of rows)if(pos(cell).some(v=>v*ratio< -8192||(v+1)*ratio-1>8192))throw Error('细分后的体素坐标超出原生边界');
  if(new Set(source.protectedColumns).size*ratio**2>250000)throw Error('保护列细分超过 25 万列预算');
  for(const column of source.protectedColumns)if(column.split(',').map(Number).some(v=>v*ratio< -8192||(v+1)*ratio-1>8192))throw Error('保护列细分后超出原生坐标边界');
 }
 const memberships=new Map(objects.map(o=>[o.objectId,new Set<string>()]));
 if(ratio>1){
  canvas.cells=split(source.cells,ratio);for(const cell of canvas.cells){const original=pointKey(pos(cell).map(v=>Math.floor(v/ratio))),owner=owners.get(original);if(owner)memberships.get(owner)!.add(key(cell));}
 }else{
  canvas.cells=[];for(const [id,rows]of groups(source.cells,ratio)){
   const candidates=rows.map(row=>owners.get(key(row))??''),winner=ranked(candidates),selected=rows.filter(row=>(owners.get(key(row))??'')===winner);
   if(new Set(candidates).size>1)report.ownerConflicts++;if(new Set(rows.map(c=>c.color)).size>1)report.colorConflicts++;
   canvas.cells.push(majority(selected,id.split(',').map(Number) as Vec3));if(winner)memberships.get(winner)!.add(id);
  }
  const lost=objects.filter(o=>o.cellKeys?.length&&!memberships.get(o.objectId)!.size);if(lost.length)throw Error('粗化会使整个物体丢失：'+lost.map(o=>o.name).join('、')+'；请保留细格、调整间距，或先用 Ctrl+J 合并需要同格的物体');
 }
 for(const object of objects){
  object.cellKeys=[...memberships.get(object.objectId)!];
  if(ratio<1){
   const stride=step/.03125,original=object.originTicks;
   // All three coordinates must share a corner or cell-center phase. Snapping
   // axes independently to half steps can still make a 90-degree turn invalid.
   const candidates=[stride/2,0].map(phase=>original.map((value,axis)=>{
    const base=source.originTicks[axis]+phase,min=Math.ceil((-65536-base)/stride),max=Math.floor((65536-base)/stride);
    return base+Math.max(min,Math.min(max,Math.round((value-base)/stride)))*stride;
   }) as Vec3).sort((a,b)=>a.reduce((n,v,i)=>n+(v-original[i])**2,0)-b.reduce((n,v,i)=>n+(v-original[i])**2,0));
   if(candidates[0].some((v,i)=>v!==original[i])){object.originTicks=candidates[0];report.warnings.push(`“${object.name}”的操作轴已吸附到新网格；资产根设置保持不变`);}
  }
 }
 if(layers){
  canvas.baseCells=resampleRows(source.baseCells??source.cells,ratio);canvas.voxelCopies=(source.voxelCopies??[]).map(copy=>({...copy,cells:resampleRows(copy.cells,ratio)}));
  const composed=new Map(canvas.baseCells.map(c=>[key(c),c]));for(const copy of canvas.voxelCopies)for(const c of copy.cells)composed.set(key(c),c);
  if(canvas.cells.some(c=>{const visible=composed.get(key(c));return !visible||visible.color!==c.color||(visible.owner??'height')!==(c.owner??'height');}))throw Error('本次粗化的重叠副本/覆盖层与多数体素结果冲突，无法无损保留覆盖层；请保留细格或先处理重叠');
 }
 const protectedColumns=new Set<string>();for(const column of source.protectedColumns){const [x,y]=column.split(',').map(Number),n=ratio>1?ratio:1;for(let a=0;a<n;a++)for(let b=0;b<n;b++)protectedColumns.add([Math.floor(x*ratio)+a,Math.floor(y*ratio)+b].join(','));}canvas.protectedColumns=[...protectedColumns];
 canvas.voxelStepM=step;appearance(source,canvas,report);
 report.afterCells=canvas.cells.length;report.volumeDeltaM3=canvas.cells.length*step**3-source.cells.length*source.voxelStepM**3;
 if(report.ownerConflicts)report.warnings.push(`${report.ownerConflicts} 个粗格包含不同物体，已按最大重叠体积归属`);
 if(report.colorConflicts)report.warnings.push(`${report.colorConflicts} 个粗格合并了不同底色，已保留多数颜色`);
 if(report.paintConflicts)report.warnings.push(`${report.paintConflicts} 个图层像素投影重叠，已取最靠外表面的原稿`);
 if(report.toneConflicts)report.warnings.push(`${report.toneConflicts} 个面暗部标记重叠，已取最靠外表面的标记`);
 if(report.volumeDeltaM3)report.warnings.push(`粗化网格量化导致体积变化 ${report.volumeDeltaM3.toFixed(6)} m³`);
 return {model:validateAsset(model),report};
}
