import {joinPaint} from './paint-layers.ts';
import {filterFaceTone,remapFaceTone} from './face-tone.ts';
import {filterPaint,remapPaint} from './surface-paint.ts';
import { validateAsset, type AssetDocument, type Cell, type ModelObject, type ModelObjectCollection, type Vec3 } from './workshop-documents.ts';
import type { ModelCanvas } from './workshop-canvases.ts';

export type ModelObjectClipboard = {
  objects: ModelObject[];
  canvases: ModelCanvas[];
  collections: ModelObjectCollection[];
  palette: AssetDocument['palette'];
  materials: AssetDocument['materialProfile']['colors'];
};
export function newObject(canvas:ModelCanvas):ModelObject {
  return {objectId:crypto.randomUUID(),name:canvas.name,canvasIds:[canvas.canvasId],originTicks:[...canvas.originTicks],cellKeys:canvas.cells.map(cellKey)};
}
/** Upgrade authoring structure in place conceptually: never create another asset identity. */
export function ensureModelObjects(input:AssetDocument):AssetDocument {
  let asset=validateAsset(input);
  if(!asset.canvases){
    const {cells,paintSource,faceTone,baseCells,voxelCopies,protectedColumns,editor,...rest}=asset;
    asset={...rest,schema:'xinghai-workshop-asset-2',cells:[],protectedColumns:[],canvases:[{
      canvasId:crypto.randomUUID(),name:asset.name||'主体',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],
      cells,protectedColumns,...(paintSource?{paintSource}:{}),...(faceTone?{faceTone}:{}),...(editor?{editor}:{}),...(baseCells?{baseCells}:{}),...(voxelCopies?{voxelCopies}:{}),
    }]};
  }
  const normalized:ModelObject[]=[],replacements=new Map<string,string[]>();
  for(const o of asset.objects??[]){
    const start=normalized.length;
    if(o.cellKeys!==undefined){normalized.push(o);continue;}
    if(o.canvasIds.length>1){for(const [i,id] of o.canvasIds.entries()){const c=asset.canvases!.find(c=>c.canvasId===id)!;normalized.push({...newObject(c),objectId:i===0?o.objectId:crypto.randomUUID(),name:o.name});}}
    else for(const id of o.canvasIds){const c=asset.canvases!.find(c=>c.canvasId===id)!;for(const cell of c.cells)normalized.push({objectId:crypto.randomUUID(),name:c.name,canvasIds:[c.canvasId],originTicks:[cell.x,cell.y,cell.z].map((n,i)=>c.originTicks[i]+(n+.5)*c.voxelStepM/.03125) as Vec3,cellKeys:[cellKey(cell)]});}
    replacements.set(o.objectId,normalized.slice(start).map(o=>o.objectId));
  }
  if(asset.objectCollections)asset.objectCollections=asset.objectCollections.map(c=>({...c,memberIds:c.memberIds.flatMap(id=>replacements.get(id)??[id])}));
  asset.objects=normalized;pruneObjectOwnership(asset);return validateAsset(asset);
}
export function pruneObjectOwnership(model:AssetDocument):void {
 const claimed=new Set<string>(),objects:ModelObject[]=[],liveByCanvas=new Map(model.canvases!.map(c=>[c.canvasId,new Set(c.cells.map(cellKey))]));
 for(const o of model.objects??[]){const c=model.canvases!.find(c=>c.canvasId===o.canvasIds[0]);if(!c)continue;
 const live=liveByCanvas.get(c.canvasId)!;o.cellKeys=(o.cellKeys??c.cells.map(cellKey)).filter(k=>{const id=c.canvasId+':'+k;if(!live.has(k)||claimed.has(id))return false;claimed.add(id);return true;});if(o.cellKeys.length)objects.push(o);}
 for(const c of model.canvases!)for(const cell of c.cells)if(!claimed.has(c.canvasId+':'+cellKey(cell)))objects.push({objectId:crypto.randomUUID(),name:c.name,canvasIds:[c.canvasId],originTicks:[cell.x,cell.y,cell.z].map((n,i)=>c.originTicks[i]+(n+.5)*c.voxelStepM/.03125) as Vec3,cellKeys:[cellKey(cell)]});
 model.objects=objects;const live=new Set(objects.map(o=>o.objectId));if(model.objectCollections)model.objectCollections=model.objectCollections.map(c=>({...c,memberIds:c.memberIds.filter(id=>live.has(id))})).filter(c=>c.memberIds.length);
}
export function expandedObjectIds(model:AssetDocument, ids:readonly string[]):string[] {
  const live=new Set(model.objects?.map(o=>o.objectId));
  const result=new Set(ids.filter(id=>live.has(id)));
  for(const collection of model.objectCollections??[])if(collection.memberIds.some(id=>result.has(id)))for(const id of collection.memberIds)result.add(id);
  return [...result];
}
export function objectClipboard(model:AssetDocument,ids:readonly string[]):ModelObjectClipboard {
  const selected=new Set(ids),objects=model.objects!.filter(o=>selected.has(o.objectId)), keysByCanvas=new Map<string,Set<string>>();
  for(const o of objects)for(const id of o.canvasIds){let keys=keysByCanvas.get(id);if(!keys)keysByCanvas.set(id,keys=new Set());for(const key of o.cellKeys!)keys.add(key);}
  return structuredClone({objects,canvases:model.canvases!.filter(c=>keysByCanvas.has(c.canvasId)).map(c=>({...c,cells:c.cells.filter(v=>keysByCanvas.get(c.canvasId)!.has(cellKey(v))),baseCells:undefined,voxelCopies:undefined,paintSource:filterPaint(c.paintSource,keysByCanvas.get(c.canvasId)!),faceTone:filterFaceTone(c.faceTone,keysByCanvas.get(c.canvasId)!)})),collections:(model.objectCollections??[]).map(c=>({...c,memberIds:c.memberIds.filter(id=>selected.has(id))})).filter(c=>c.memberIds.length),palette:model.palette,materials:model.materialProfile.colors});
}
export function pasteObjectClipboard(model:AssetDocument,clipboard:ModelObjectClipboard):string[] {
  if(!clipboard.objects.length)return [];
  const objectIds=new Map(clipboard.objects.map(o=>[o.objectId,crypto.randomUUID()]));
  const pasteDelta=new Map<string,Vec3>();const canvasIds=new Map<string,string>(),keysByCanvas=new Map<string,Map<string,string>>();
  for(const original of clipboard.canvases){let target=model.canvases!.find(c=>c.canvasId===original.canvasId&&c.voxelStepM===original.voxelStepM&&!c.locked);
    if(!target){target={...structuredClone(original),canvasId:crypto.randomUUID(),cells:[],faceTone:undefined,paintSource:undefined,baseCells:undefined,voxelCopies:undefined,locked:false};model.canvases!.push(target);}
    canvasIds.set(original.canvasId,target.canvasId);const keys=new Map<string,string>();keysByCanvas.set(original.canvasId,keys);const stride=target.voxelStepM/.03125;
    const gridDelta=original.originTicks.map((n,i)=>(n-target.originTicks[i])/stride);
    if(gridDelta.some(n=>!Number.isInteger(n)))throw Error('粘贴需要画布网格对齐');
    const occupied=new Set(target.cells.map(cellKey));let offset=1;while(original.cells.some(v=>occupied.has([v.x+gridDelta[0]+offset,v.y+gridDelta[1],v.z+gridDelta[2]].join(','))))offset++;
    pasteDelta.set(original.canvasId,[offset*stride,0,0]);
    for(const v of original.cells){const properties=(m:AssetDocument['materialProfile']['colors'][number])=>{const {colorId,...rest}=m;return JSON.stringify(rest);};let color=model.palette.findIndex((hex,i)=>hex===clipboard.palette[v.color]&&properties(model.materialProfile.colors[i])===properties(clipboard.materials[v.color]));if(color<0){if(model.materialProfile.colors.length>=64)throw Error('材质色板容量已满');color=model.palette.length;model.palette.push(clipboard.palette[v.color]);model.materialProfile.colors.push({...structuredClone(clipboard.materials[v.color]),colorId:crypto.randomUUID()});model.materialProfile.paletteRevision++;}const cell={...v,x:v.x+offset+(original.originTicks[0]-target.originTicks[0])/stride,y:v.y+(original.originTicks[1]-target.originTicks[1])/stride,z:v.z+(original.originTicks[2]-target.originTicks[2])/stride,color};keys.set(cellKey(v),cellKey(cell));target.cells.push(cell);}
    const toned=remapFaceTone(original.faceTone,keys);if(toned)target.faceTone={schema:'xinghai-face-tone-1',faces:{...target.faceTone?.faces,...toned.faces}};
    const painted=remapPaint(original.paintSource,keys,original.voxelStepM);if(painted)target.paintSource=joinPaint(target.paintSource,painted);
  }
  for(const original of clipboard.objects)model.objects!.push({...structuredClone(original),objectId:objectIds.get(original.objectId)!,name:original.name+' 副本',originTicks:original.originTicks.map((n,i)=>n+pasteDelta.get(original.canvasIds[0])![i]) as Vec3,canvasIds:original.canvasIds.map(id=>canvasIds.get(id)!),cellKeys:original.cellKeys!.map(k=>keysByCanvas.get(original.canvasIds[0])!.get(k)!)});
  if(clipboard.collections.length)model.objectCollections??=[];
  for(const c of clipboard.collections)model.objectCollections!.push({collectionId:crypto.randomUUID(),name:c.name+' 副本',memberIds:c.memberIds.map(id=>objectIds.get(id)!)});

  return [...objectIds.values()];
}
/** Explicit world translation. Occupied source positions use independent canvases, never a forced offset. */
export function pasteObjectClipboardAt(model:AssetDocument,clipboard:ModelObjectClipboard,deltaTicks:Vec3):string[] {
  if(!Array.isArray(deltaTicks)||deltaTicks.length!==3||deltaTicks.some(n=>!Number.isSafeInteger(n)))throw Error('物体粘贴位置坐标无效');
  if(!clipboard.objects.length)return [];
  for(const source of clipboard.canvases)if(deltaTicks.some(n=>!Number.isInteger(n/(source.voxelStepM/.03125))))throw Error('物体粘贴需要源体素网格对齐');
  const objectIds=new Map(clipboard.objects.map(o=>[o.objectId,crypto.randomUUID()])),canvasIds=new Map<string,string>(),keysByCanvas=new Map<string,Map<string,string>>();
  const properties=(m:AssetDocument['materialProfile']['colors'][number])=>{const {colorId,...rest}=m;return JSON.stringify(rest);},palette=new Map<number,number>();
  const colorFor=(index:number)=>{if(palette.has(index))return palette.get(index)!;let color=model.palette.findIndex((hex,i)=>hex===clipboard.palette[index]&&properties(model.materialProfile.colors[i])===properties(clipboard.materials[index]));if(color<0){if(model.palette.length>=64)throw Error('材质色板容量已满');color=model.palette.length;model.palette.push(clipboard.palette[index]);model.materialProfile.colors.push({...structuredClone(clipboard.materials[index]),colorId:crypto.randomUUID()});model.materialProfile.paletteRevision++;}palette.set(index,color);return color;};
  for(const source of clipboard.canvases){
    const stride=source.voxelStepM/.03125;
    const compatible=(c:ModelCanvas)=>c.visible&&!c.locked&&c.voxelStepM===source.voxelStepM&&c.originTicks.every((v,i)=>Number.isInteger((source.originTicks[i]+deltaTicks[i]-v)/stride));
    const free=(c:ModelCanvas)=>{const occupied=new Set(c.cells.map(cellKey)),d=source.originTicks.map((v,i)=>(v+deltaTicks[i]-c.originTicks[i])/stride);return !source.cells.some(v=>occupied.has([v.x+d[0],v.y+d[1],v.z+d[2]].join(',')));};
    let target=model.canvases!.find(c=>c.canvasId===source.canvasId&&compatible(c)&&free(c))??model.canvases!.find(c=>compatible(c)&&free(c));
    if(!target){if(model.canvases!.length>=32)throw Error('原位重叠复制需要独立画布，已达到 32 张画布上限；请移动预览到空处或先整理画布');target={canvasId:crypto.randomUUID(),name:(source.name+' · 重叠副本').slice(0,200),visible:true,locked:false,voxelStepM:source.voxelStepM,originTicks:[...source.originTicks],cells:[],protectedColumns:[]};model.canvases!.push(target);}
    canvasIds.set(source.canvasId,target.canvasId);const map=new Map<string,string>();keysByCanvas.set(source.canvasId,map);
    const delta=source.originTicks.map((v,i)=>(v+deltaTicks[i]-target!.originTicks[i])/stride),cells=source.cells.map(v=>{const c={...v,x:v.x+delta[0],y:v.y+delta[1],z:v.z+delta[2],color:colorFor(v.color)};map.set(cellKey(v),cellKey(c));return c;});
    if(target.baseCells!==undefined||target.voxelCopies!==undefined)target.baseCells=(target.baseCells??target.cells).concat(cells);
    target.cells=target.cells.concat(cells);
    const tone=remapFaceTone(source.faceTone,map);if(tone)target.faceTone={schema:'xinghai-face-tone-1',faces:{...target.faceTone?.faces,...tone.faces}};
    const paint=remapPaint(source.paintSource,map,source.voxelStepM);if(paint)target.paintSource=joinPaint(target.paintSource,paint);
  }
  const names=new Set(model.objects!.map(o=>o.name));
  for(const source of clipboard.objects){const base=source.name.slice(0,185)+' 副本';let name=base,n=2;while(names.has(name))name=base+' '+n++;names.add(name);
    model.objects!.push({...structuredClone(source),objectId:objectIds.get(source.objectId)!,name,canvasIds:source.canvasIds.map(id=>canvasIds.get(id)!),originTicks:source.originTicks.map((v,i)=>v+deltaTicks[i]) as Vec3,cellKeys:source.cellKeys!.map(key=>keysByCanvas.get(source.canvasIds[0])!.get(key)!)});
  }
  if(clipboard.collections.length)model.objectCollections??=[];
  for(const c of clipboard.collections)model.objectCollections!.push({collectionId:crypto.randomUUID(),name:(c.name+' 副本').slice(0,200),memberIds:c.memberIds.map(id=>objectIds.get(id)!)});
  return [...objectIds.values()];
}
/** Move/delete owned coordinates in every stored layer, then derive the visible composition. */
export function remapOwnedCanvasCells(canvas:ModelCanvas,mapping:ReadonlyMap<string,string>,removed:ReadonlySet<string>=new Set()):void {
  const destinations=new Set(mapping.values());
  const transform=(cells:Cell[])=>{
    const result:Cell[]=[];
    for(const cell of cells){const key=cellKey(cell);if(removed.has(key))continue;const target=mapping.get(key);
      if(target){const [x,y,z]=target.split(',').map(Number);result.push({...cell,x,y,z});}
      else if(!destinations.has(key))result.push(cell);
    }
    return result;
  };
  if(canvas.baseCells!==undefined||canvas.voxelCopies!==undefined){
    canvas.baseCells=transform(canvas.baseCells??canvas.cells);
    canvas.voxelCopies=(canvas.voxelCopies??[]).map(copy=>({...copy,cells:transform(copy.cells)})).filter(copy=>copy.cells.length);
    const visible=new Map(canvas.baseCells.map(cell=>[cellKey(cell),cell]));
    for(const copy of canvas.voxelCopies)for(const cell of copy.cells)visible.set(cellKey(cell),cell);
    canvas.cells=[...visible.values()];
  }else canvas.cells=transform(canvas.cells);
}
function rotated(v:Vec3,axis:number,turns:number,cell=false):Vec3 {
  const p=[...v] as Vec3,a=(axis+1)%3,b=(axis+2)%3;
  for(let i=0;i<((turns%4)+4)%4;i++){const before=p[a];p[a]=-p[b]-(cell?1:0);p[b]=before;}
  return p;
}
/** Rotate lower cell corners, not just centers, so occupied volumes remain grid aligned. */
export function rotateObjectData(model:AssetDocument, ids:readonly string[],axis:number,turns:number,pivot:Vec3):void {
  if(![0,1,2].includes(axis)||!Number.isSafeInteger(turns))throw Error('旋转轴或角度无效');
  const selectedIds=new Set(ids),objects=model.objects!.filter(o=>selectedIds.has(o.objectId));
  for(const c of model.canvases!){const selected=objects.filter(o=>o.canvasIds.includes(c.canvasId)),keys=new Set(selected.flatMap(o=>o.cellKeys!));if(!keys.size)continue;const stride=c.voxelStepM/.03125;const changed=new Map<string,Cell>();const moved=new Map<string,string>();for(const v of c.cells)if(keys.has(cellKey(v))){const center=[v.x,v.y,v.z].map((n,i)=>c.originTicks[i]+(n+.5)*stride-pivot[i]) as Vec3;const point=rotated(center,axis,turns).map((n,i)=>(n+pivot[i]-c.originTicks[i])/stride-.5);if(point.some(n=>!Number.isInteger(n)))throw Error('旋转需要网格对齐');const cell={...v,x:point[0],y:point[1],z:point[2]};changed.set(cellKey(cell),cell);moved.set(cellKey(v),cellKey(cell));}
  if(c.faceTone)c.faceTone=remapFaceTone(c.faceTone,moved,axis,turns);if(c.paintSource)c.paintSource=remapPaint(c.paintSource,moved,c.voxelStepM,axis,turns);remapOwnedCanvasCells(c,moved);for(const o of model.objects!.filter(o=>o.canvasIds.includes(c.canvasId)))o.cellKeys=selectedIds.has(o.objectId)?o.cellKeys!.map(k=>moved.get(k)!):o.cellKeys!.filter(k=>!changed.has(k));}
  for(const o of objects)o.originTicks=rotated(o.originTicks.map((n,i)=>n-pivot[i]) as Vec3,axis,turns).map((n,i)=>n+pivot[i]) as Vec3;
  pruneObjectOwnership(model);

}
const cellKey=(c:Pick<Cell,'x'|'y'|'z'>)=>`${c.x},${c.y},${c.z}`;
/** Partition every source layer so moving a separated overlay cannot uncover an accidental duplicate. */
export function separateCanvasCells(source:ModelCanvas, selected:readonly Pick<Cell,'x'|'y'|'z'>[]):ModelCanvas|null {
  const live=new Set(source.cells.map(cellKey)), keys=new Set(selected.map(cellKey).filter(k=>live.has(k)));
  if(!keys.size)return null;
  const copy=structuredClone(source);copy.canvasId=crypto.randomUUID();copy.name+=' 分离';copy.locked=false;delete copy.editor;
  const partition=(canvas:ModelCanvas, include:boolean)=>{
    canvas.faceTone=filterFaceTone(canvas.faceTone,new Set(canvas.cells.filter(c=>keys.has(cellKey(c))===include).map(cellKey)));
    canvas.paintSource=filterPaint(canvas.paintSource,new Set(canvas.cells.filter(c=>keys.has(cellKey(c))===include).map(cellKey)));
    const keep=(c:Cell)=>keys.has(cellKey(c))===include;
    canvas.cells=canvas.cells.filter(keep);
    if(canvas.baseCells)canvas.baseCells=canvas.baseCells.filter(keep);
    if(canvas.voxelCopies)canvas.voxelCopies=canvas.voxelCopies.map(v=>({...v,copyId:include?crypto.randomUUID():v.copyId,cells:v.cells.filter(keep)})).filter(v=>v.cells.length);
    const columns=new Set(canvas.cells.map(c=>`${c.x},${c.y}`));canvas.protectedColumns=canvas.protectedColumns.filter(k=>columns.has(k));
  };
  partition(copy,true);partition(source,false);return copy;
}
