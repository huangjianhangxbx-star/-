import {validateAsset,type AssetDocument,type Cell} from './workshop-documents.ts';
import {shapeRock,type RockOptions,type RockResult} from './rock-shaping.ts';

export type RockAssetSettings={protectPaint?:boolean;protectedKeys?:ReadonlySet<string>;selectionKeys?:ReadonlySet<string>;protectColumns?:boolean};
export type RockAssetPlan={
 sourceStamp:string;
 objectId:string;
 canvasId:string;
 scope:{kind:'selection'|'object';cellCount:number};
 result:RockResult;
 nextModel:AssetDocument;
 surfaces:{removed:number;revealed:number;paintedAffected:number};
};
const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as const;
const key=(c:Pick<Cell,'x'|'y'|'z'>)=>`${c.x},${c.y},${c.z}`;
const neighbor=(c:Pick<Cell,'x'|'y'|'z'>,f:number)=>`${c.x+directions[f][0]},${c.y+directions[f][1]},${c.z+directions[f][2]}`;
// Full serialization is deliberate: freshness must never rely on a lossy geometry hash,
// revision alone, or omit hidden paint / source layers / ownership / material edits.
export const rockAssetStamp=(model:AssetDocument)=>'rock-asset-1:'+JSON.stringify(model);
const trusted=new WeakMap<RockAssetPlan,RockAssetPlan>();

/** Frozen-source sculpt plan. Only selected owner cells seed growth or receive cuts. */
export function planRockAsset(model:AssetDocument,objectId:string,options:RockOptions,settings:RockAssetSettings={}):RockAssetPlan {
 validateAsset(model);
 const object=model.objects?.find(o=>o.objectId===objectId);
 if(!object||object.canvasIds.length!==1||!object.cellKeys||object.cellKeys.length<2)
  throw Error('请选择单个已合并岩体；至少需要 2 个体素，跨画布请先合并画布');
 const canvas=model.canvases?.find(c=>c.canvasId===object.canvasIds[0]);
 if(!canvas||canvas.locked||!canvas.visible)throw Error('目标画布已锁定或隐藏');
 const targetKeys=new Set(object.cellKeys),protectedKeys=new Set(settings.protectedKeys??[]);
 const selectionKeys=settings.selectionKeys===undefined?undefined:new Set([...settings.selectionKeys].filter(k=>targetKeys.has(k)));
 if(selectionKeys&&!selectionKeys.size)throw Error('请先选择需要塑形的体素；编辑模式不会自动处理整个物体');
 const occupied=new Map(canvas.cells.map(c=>[key(c),c]));
 if(settings.protectColumns){const columns=new Set(canvas.protectedColumns);for(const cell of canvas.cells)if(columns.has(`${cell.x},${cell.y}`))protectedKeys.add(key(cell));}
 if(settings.protectPaint!==false)for(const paintedKey of Object.keys(canvas.paintSource?.faces??{})){
  const owner=occupied.get(paintedKey.split(',').slice(0,3).join(','));
  if(!owner)continue;
  protectedKeys.add(key(owner));
  // Hidden paint is source data too: preserve the occupancy of every neighbor,
  // keeping both visible and occluded painted surfaces' exposure unchanged.
  for(let f=0;f<6;f++)protectedKeys.add(neighbor(owner,f));
 }
 const result=shapeRock(canvas.cells,{...options,localSurface:true,scopeKeys:selectionKeys,cellSize:canvas.voxelStepM,targetKeys,protectedKeys,blockedColumns:settings.protectColumns?new Set(canvas.protectedColumns):undefined,locked:false,hidden:false});
 const removed=new Set(result.removedCellKeys);
 // Verify the generator's write boundary before installing any geometry.
 if([...removed].some(k=>!targetKeys.has(k)||!occupied.has(k)||(selectionKeys&&!selectionKeys.has(k))))throw Error('塑形结果超出目标范围');
 const added=result.addedCells,addedKeys=added.map(key);
 if(new Set(addedKeys).size!==addedKeys.length||addedKeys.some(k=>occupied.has(k)))throw Error('增生结果存在重复占用');
 const nextModel=structuredClone(model),nextCanvas=nextModel.canvases!.find(c=>c.canvasId===canvas.canvasId)!;
 const keep=(c:Cell)=>!removed.has(key(c));
 nextCanvas.cells=nextCanvas.cells.filter(keep).concat(added);
 if(nextCanvas.baseCells)nextCanvas.baseCells=nextCanvas.baseCells.filter(keep).concat(added);
 if(nextCanvas.voxelCopies)for(const copy of nextCanvas.voxelCopies)copy.cells=copy.cells.filter(keep);
 nextModel.objects!.find(o=>o.objectId===objectId)!.cellKeys=object.cellKeys.filter(k=>!removed.has(k)).concat(addedKeys);
 const nextOccupied=new Map(nextCanvas.cells.map(c=>[key(c),c]));
 const exposed=(map:Map<string,Cell>,c:Cell,f:number)=>map.has(key(c))&&!map.has(neighbor(c,f));
 let removedFaces=0,revealed=0,paintedAffected=0;
 for(const cell of new Map([...canvas.cells,...added].map(c=>[key(c),c])).values())for(let f=0;f<6;f++){
  const before=exposed(occupied,cell,f),after=exposed(nextOccupied,cell,f);
  if(before&&!after)removedFaces++;
  if(!before&&after)revealed++;
 }
 for(const faceKey of Object.keys(canvas.paintSource?.faces??{})){
  const [x,y,z,f]=faceKey.split(',').map(Number),cell=occupied.get(`${x},${y},${z}`)!;
  if(removed.has(key(cell))||exposed(occupied,cell,f)!==exposed(nextOccupied,cell,f)){
   paintedAffected++;
   if(settings.protectPaint===false)delete nextCanvas.paintSource!.faces[faceKey];
  }
 }
 if(settings.protectPaint!==false&&paintedAffected)throw Error('塑形影响受保护彩绘区域');
 const plan:RockAssetPlan={sourceStamp:rockAssetStamp(model),objectId,canvasId:canvas.canvasId,scope:{kind:selectionKeys?'selection':'object',cellCount:selectionKeys?.size??targetKeys.size},result,nextModel:validateAsset(nextModel),surfaces:{removed:removedFaces,revealed,paintedAffected}};
 // Public previews are mutable render data. Preserve a private verified snapshot so
 // callers cannot inject arbitrary next assets or tamper with the accepted result.
 trusted.set(plan,structuredClone(plan));
 return plan;
}

/** Only plans created by this module can cross the history transaction boundary. */
export function verifiedRockAssetPlan(plan:RockAssetPlan,model:AssetDocument):RockAssetPlan {
 const value=trusted.get(plan);
 if(!value)throw Error('岩体预览无效，请重新打开工具');
 if(value.sourceStamp!==rockAssetStamp(model))throw Error('源模型已变化，请重新预览岩体塑形');
 return structuredClone(value);
}
