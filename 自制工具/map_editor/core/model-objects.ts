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
  return {objectId:crypto.randomUUID(),name:canvas.name,canvasIds:[canvas.canvasId],originTicks:[...canvas.originTicks]};
}
/** Upgrade authoring structure in place conceptually: never create another asset identity. */
export function ensureModelObjects(input:AssetDocument):AssetDocument {
  let asset=validateAsset(input);
  if(!asset.canvases){
    const {cells,baseCells,voxelCopies,protectedColumns,editor,...rest}=asset;
    asset={...rest,schema:'xinghai-workshop-asset-2',cells:[],protectedColumns:[],canvases:[{
      canvasId:crypto.randomUUID(),name:asset.name||'主体',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],
      cells,protectedColumns,...(editor?{editor}:{}),...(baseCells?{baseCells}:{}),...(voxelCopies?{voxelCopies}:{}),
    }]};
  }
  asset.objects??=asset.canvases!.map(newObject);
  return validateAsset(asset);
}
export function pruneObjectOwnership(model:AssetDocument):void {
  const canvases=new Set(model.canvases!.map(c=>c.canvasId));
  model.objects=model.objects!.map(o=>({...o,canvasIds:o.canvasIds.filter(id=>canvases.has(id))})).filter(o=>o.canvasIds.length);
  const owned=new Set(model.objects.flatMap(o=>o.canvasIds));
  for(const c of model.canvases!)if(!owned.has(c.canvasId))model.objects.push(newObject(c));
  const live=new Set(model.objects.map(o=>o.objectId));
  if(model.objectCollections)model.objectCollections=model.objectCollections.map(c=>({...c,memberIds:c.memberIds.filter(id=>live.has(id))})).filter(c=>c.memberIds.length);
}
export function expandedObjectIds(model:AssetDocument, ids:readonly string[]):string[] {
  const result=new Set(ids.filter(id=>model.objects?.some(o=>o.objectId===id)));
  for(const collection of model.objectCollections??[])if(collection.memberIds.some(id=>result.has(id)))for(const id of collection.memberIds)result.add(id);
  return [...result];
}
export function objectClipboard(model:AssetDocument,ids:readonly string[]):ModelObjectClipboard {
  const objects=model.objects!.filter(o=>ids.includes(o.objectId)), canvases=new Set(objects.flatMap(o=>o.canvasIds));
  return structuredClone({objects,canvases:model.canvases!.filter(c=>canvases.has(c.canvasId)),collections:(model.objectCollections??[]).map(c=>({...c,memberIds:c.memberIds.filter(id=>ids.includes(id))})).filter(c=>c.memberIds.length),palette:model.palette,materials:model.materialProfile.colors});
}
export function pasteObjectClipboard(model:AssetDocument,clipboard:ModelObjectClipboard):string[] {
  if(!clipboard.objects.length)return [];
  const canvasIds=new Map(clipboard.canvases.map(c=>[c.canvasId,crypto.randomUUID()])),objectIds=new Map(clipboard.objects.map(o=>[o.objectId,crypto.randomUUID()]));
  const colorMap=new Map<number,number>();
  const oldPaletteLength=model.palette.length;
  const color=(index:number)=>{
    if(colorMap.has(index))return colorMap.get(index)!;
    const value=clipboard.palette[index], material=clipboard.materials[index];
    const spec=({colorId,...rest}:AssetDocument['materialProfile']['colors'][number])=>JSON.stringify(rest);
    let target=model.palette.findIndex((v,i)=>v===value&&spec(model.materialProfile.colors[i])===spec(material));
    if(target<0){target=model.palette.length;if(target>=64)throw Error('材质色板容量已满');model.palette.push(value);model.materialProfile.colors.push({...structuredClone(material),colorId:crypto.randomUUID()});}
    colorMap.set(index,target);return target;
  };
  for(const original of clipboard.canvases){
    const c=structuredClone(original);c.canvasId=canvasIds.get(c.canvasId)!;c.locked=false;
    mapCanvasCells(c,cell=>({...cell,color:color(cell.color)}));
    for(const copy of c.voxelCopies??[])copy.copyId=crypto.randomUUID();
    model.canvases!.push(c);
  }
  for(const original of clipboard.objects)model.objects!.push({...structuredClone(original),objectId:objectIds.get(original.objectId)!,name:original.name+' 副本',canvasIds:original.canvasIds.map(id=>canvasIds.get(id)!)});
  if(clipboard.collections.length)model.objectCollections??=[];
  for(const c of clipboard.collections)model.objectCollections!.push({collectionId:crypto.randomUUID(),name:c.name+' 副本',memberIds:c.memberIds.map(id=>objectIds.get(id)!)});
  if(model.palette.length!==oldPaletteLength)model.materialProfile.paletteRevision++;
  return [...objectIds.values()];
}
function mapCanvasCells(canvas:ModelCanvas, mapper:(cell:Cell)=>Cell):void {
  // Visible cells may alias base/copy cells after an editor sync. Replace them so a source is transformed once.
  canvas.cells=canvas.cells.map(mapper);
  if(canvas.baseCells)canvas.baseCells=canvas.baseCells.map(mapper);
  if(canvas.voxelCopies)canvas.voxelCopies=canvas.voxelCopies.map(copy=>({...copy,cells:copy.cells.map(mapper)}));
}
function rotated(v:Vec3,axis:number,turns:number,cell=false):Vec3 {
  const p=[...v] as Vec3,a=(axis+1)%3,b=(axis+2)%3;
  for(let i=0;i<((turns%4)+4)%4;i++){const before=p[a];p[a]=-p[b]-(cell?1:0);p[b]=before;}
  return p;
}
/** Rotate lower cell corners, not just centers, so occupied volumes remain grid aligned. */
export function rotateObjectData(model:AssetDocument, ids:readonly string[],axis:number,turns:number,pivot:Vec3):void {
  if(![0,1,2].includes(axis)||!Number.isSafeInteger(turns))throw Error('旋转轴或角度无效');
  const objects=model.objects!.filter(o=>ids.includes(o.objectId)),owned=new Set(objects.flatMap(o=>o.canvasIds));
  const point=(v:Vec3)=>rotated(v.map((n,i)=>n-pivot[i]) as Vec3,axis,turns).map((n,i)=>n+pivot[i]) as Vec3;
  for(const o of objects)o.originTicks=point(o.originTicks);
  for(const c of model.canvases!.filter(c=>owned.has(c.canvasId))){
    c.originTicks=point(c.originTicks);
    const protectedKeys=new Set(c.protectedColumns), newProtected=new Set<string>();
    if(axis===2)for(const key of protectedKeys){const [x,y]=key.split(',').map(Number),r=rotated([x,y,0],axis,turns,true);newProtected.add(`${r[0]},${r[1]}`);}
    else for(const cell of c.cells)if(protectedKeys.has(`${cell.x},${cell.y}`)){const r=rotated([cell.x,cell.y,cell.z],axis,turns,true);newProtected.add(`${r[0]},${r[1]}`);}
    c.protectedColumns=[...newProtected];
    mapCanvasCells(c,cell=>{const [x,y,z]=rotated([cell.x,cell.y,cell.z],axis,turns,true);return {...cell,x,y,z};});
    const ref=c.editor?.reference;if(ref)[ref.x,ref.y,ref.z]=rotated([ref.x,ref.y,ref.z],axis,turns);
  }
}
const cellKey=(c:Pick<Cell,'x'|'y'|'z'>)=>`${c.x},${c.y},${c.z}`;
/** Partition every source layer so moving a separated overlay cannot uncover an accidental duplicate. */
export function separateCanvasCells(source:ModelCanvas, selected:readonly Pick<Cell,'x'|'y'|'z'>[]):ModelCanvas|null {
  const live=new Set(source.cells.map(cellKey)), keys=new Set(selected.map(cellKey).filter(k=>live.has(k)));
  if(!keys.size)return null;
  const copy=structuredClone(source);copy.canvasId=crypto.randomUUID();copy.name+=' 分离';copy.locked=false;delete copy.editor;
  const partition=(canvas:ModelCanvas, include:boolean)=>{
    const keep=(c:Cell)=>keys.has(cellKey(c))===include;
    canvas.cells=canvas.cells.filter(keep);
    if(canvas.baseCells)canvas.baseCells=canvas.baseCells.filter(keep);
    if(canvas.voxelCopies)canvas.voxelCopies=canvas.voxelCopies.map(v=>({...v,copyId:include?crypto.randomUUID():v.copyId,cells:v.cells.filter(keep)})).filter(v=>v.cells.length);
    const columns=new Set(canvas.cells.map(c=>`${c.x},${c.y}`));canvas.protectedColumns=canvas.protectedColumns.filter(k=>columns.has(k));
  };
  partition(copy,true);partition(source,false);return copy;
}
