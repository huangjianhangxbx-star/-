import {remapPaint} from './surface-paint.ts';
import {remapFaceTone} from './face-tone.ts';
import {joinPaint} from './paint-layers.ts';
import {objectClipboard,type ModelObjectClipboard} from './model-objects.ts';
import {validateAsset,type AssetDocument,type Cell,type Vec3} from './workshop-documents.ts';
import type {ModelCanvas} from './workshop-canvases.ts';

const TICK=.03125;
const cellKey=(c:Pick<Cell,'x'|'y'|'z'>)=>[c.x,c.y,c.z].join(',');
export type TemporaryObjectBrush={
 name:string;
 sourceObjectId:string;
 clipboard:ModelObjectClipboard;
 boundsTicks:{min:Vec3;max:Vec3};
 anchorTicks:Vec3;
 stepTicks:number;
 sideColor?:number;
};

/** A detached snapshot of one actual object; organizational collections never expand it. */
export function captureTemporaryObjectBrush(input:AssetDocument,objectId:string):TemporaryObjectBrush {
 const model=validateAsset(input),object=model.objects?.find(o=>o.objectId===objectId);
 if(!object)throw Error('请选择一个存在的物体作为临时画笔');
 if(object.canvasIds.length!==1||!object.cellKeys?.length)throw Error('临时画笔需要一张画布中的非空物体');
 const clipboard=objectClipboard(model,[objectId]);clipboard.collections=[];
 const canvas=clipboard.canvases[0],stepTicks=canvas.voxelStepM/TICK;
 const min=[Infinity,Infinity,Infinity] as Vec3,max=[-Infinity,-Infinity,-Infinity] as Vec3;
 for(const c of canvas.cells)for(const [axis,value]of [c.x,c.y,c.z].entries()){
  min[axis]=Math.min(min[axis],canvas.originTicks[axis]+value*stepTicks);
  max[axis]=Math.max(max[axis],canvas.originTicks[axis]+(value+1)*stepTicks);
 }
 const anchorTicks:Vec3=[(min[0]+max[0])/2,(min[1]+max[1])/2,min[2]];
 return {name:object.name,sourceObjectId:object.objectId,clipboard,boundsTicks:{min,max},anchorTicks,stepTicks,...(model.sideColor===undefined?{}:{sideColor:model.sideColor})};
}

type Bounds={min:Vec3;max:Vec3};
function boundsForCell(c:Cell,canvas:ModelCanvas):Bounds {
 const stride=canvas.voxelStepM/TICK,min=[c.x,c.y,c.z].map((v,i)=>canvas.originTicks[i]+v*stride) as Vec3;
 return {min,max:min.map(v=>v+stride) as Vec3};
}
function bucketKeys(b:Bounds):string[]{
 const keys:string[]=[];
 for(let x=Math.floor(b.min[0]/8);x<=Math.floor((b.max[0]-1)/8);x++)
  for(let y=Math.floor(b.min[1]/8);y<=Math.floor((b.max[1]-1)/8);y++)
   for(let z=Math.floor(b.min[2]/8);z<=Math.floor((b.max[2]-1)/8);z++)keys.push([x,y,z].join(','));
 return keys;
}
function rejectCollisions(model:AssetDocument,incoming:Cell[],canvas:ModelCanvas){
 const occupied=new Map<string,Bounds[]>();
 for(const existing of model.canvases!)for(const cell of existing.cells){const bounds=boundsForCell(cell,existing);for(const key of bucketKeys(bounds)){if(!occupied.has(key))occupied.set(key,[]);occupied.get(key)!.push(bounds);}}
 for(const cell of incoming){const bounds=boundsForCell(cell,canvas);for(const key of bucketKeys(bounds))for(const other of occupied.get(key)??[])
  if(bounds.min.every((v,i)=>v<other.max[i]&&bounds.max[i]>other.min[i]))throw Error('临时画笔位置已被体素占用，请移到空处');
 }
}
function materialProperties(material:AssetDocument['materialProfile']['colors'][number]){
 const {colorId,...properties}=material;return JSON.stringify(properties);
}

/** Return a new valid document, without silently overwriting cells or altering the source. */
export function stampTemporaryObjectBrush(input:AssetDocument,brush:TemporaryObjectBrush,targetTicks:Vec3):{model:AssetDocument;objectIds:string[]} {
 if(!Array.isArray(targetTicks)||targetTicks.length!==3||targetTicks.some(v=>!Number.isFinite(v)))throw Error('临时画笔位置坐标无效');
 const model=validateAsset(input);
 if(brush.clipboard.objects.length!==1||brush.clipboard.canvases.length!==1||!brush.clipboard.canvases[0].cells.length)throw Error('临时画笔快照无效');
 const source=brush.clipboard.canvases[0],stride=source.voxelStepM/TICK;
 if(![2,4,8].includes(stride)||brush.stepTicks!==stride)throw Error('临时画笔精度无效');
 const delta=targetTicks.map((v,i)=>Math.round((v-brush.anchorTicks[i])/stride)*stride) as Vec3;
 if(delta.some(v=>!Number.isSafeInteger(v)))throw Error('临时画笔位置坐标超出范围');
 const original=model.canvases?.find(c=>c.canvasId===source.canvasId);
 if(original?.locked)throw Error('目标画布已锁定');
 if(original&&!original.visible)throw Error('目标画布已隐藏');
 const aligned=(c:ModelCanvas)=>c.voxelStepM===source.voxelStepM&&c.originTicks.every((v,i)=>Number.isInteger((source.originTicks[i]+delta[i]-v)/stride));
 let target=original&&aligned(original)?original:model.canvases?.find(c=>!c.locked&&c.visible&&aligned(c));
 const created=!target;
 if(!target)target={canvasId:crypto.randomUUID(),name:(brush.name+' 画布').slice(0,200),visible:true,locked:false,voxelStepM:source.voxelStepM,originTicks:[...source.originTicks],cells:[],protectedColumns:[]};
 const gridDelta=source.originTicks.map((v,i)=>(v+delta[i]-target!.originTicks[i])/stride);
 const keyMap=new Map<string,string>(),cells=source.cells.map(v=>{
  const cell={...v,x:v.x+gridDelta[0],y:v.y+gridDelta[1],z:v.z+gridDelta[2]};keyMap.set(cellKey(v),cellKey(cell));return cell;
 });
 rejectCollisions(model,cells,target);
 const paletteMap=new Map<number,number>(),slots=new Set(cells.map(c=>c.color));
 if(brush.sideColor!==undefined)slots.add(brush.sideColor);
 for(const index of slots){
  const hex=brush.clipboard.palette[index],material=brush.clipboard.materials[index];
  if(!hex||!material)throw Error('临时画笔材质缺失');
  let mapped=model.palette.findIndex((value,i)=>value===hex&&materialProperties(model.materialProfile.colors[i])===materialProperties(material));
  if(mapped<0){
   if(model.materialProfile.colors.length>=64)throw Error('材质色板容量已满');
   mapped=model.palette.length;model.palette.push(hex);model.materialProfile.colors.push({...structuredClone(material),colorId:crypto.randomUUID()});model.materialProfile.paletteRevision++;
  }
  paletteMap.set(index,mapped);
 }
 const capturedSide=brush.sideColor===undefined?undefined:paletteMap.get(brush.sideColor);
 if(capturedSide!==model.sideColor)throw Error('目标模型侧面材质不同，无法保持临时画笔外观');
 const authored=cells.map(c=>({...c,color:paletteMap.get(c.color)!}));
 // A stamp adds cells; it must not flatten existing overlay copies and lose
 // the original voxels underneath them. Incoming cells cannot overlap either.
 if(target.baseCells!==undefined||target.voxelCopies!==undefined)target.baseCells=(target.baseCells??target.cells).concat(authored);
 target.cells=target.cells.concat(authored);
 const paint=remapPaint(source.paintSource,keyMap,source.voxelStepM);
 if(paint)target.paintSource=joinPaint(target.paintSource,paint);
 const tone=remapFaceTone(source.faceTone,keyMap);
 if(tone)target.faceTone={schema:'xinghai-face-tone-1',faces:{...target.faceTone?.faces,...tone.faces}};
 if(created)model.canvases!.push(target);
 const originalObject=brush.clipboard.objects[0],id=crypto.randomUUID();
 model.objects??=[];model.objects.push({...structuredClone(originalObject),objectId:id,name:(brush.name+' 笔刷').slice(0,200),canvasIds:[target.canvasId],originTicks:originalObject.originTicks.map((v,i)=>v+delta[i]) as Vec3,cellKeys:originalObject.cellKeys!.map(k=>keyMap.get(k)!)});
 return {model:validateAsset(model),objectIds:[id]};
}
