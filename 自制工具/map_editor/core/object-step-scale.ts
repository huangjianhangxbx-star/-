import {EditorDocument,createMap} from './document.ts';
import {planStepScale,type StepScaleAxis} from './voxel-step-scale.ts';
import {VoxelSelection,voxelKey} from './voxel-selection.ts';
import {validateAsset,type AssetDocument,type Cell,type Vec3} from './workshop-documents.ts';
import {mapPaintLayers} from './paint-layers.ts';
import {MAX_PAINT_FACES,MAX_PAINT_PIXELS,paintResolution,parsePaintFaceKey,type SurfacePaint} from './surface-paint.ts';
import {FACE_TONE_BUDGET,type FaceTone} from './face-tone.ts';

export type ObjectStepScaleAxis=StepScaleAxis;
export type ObjectStepScalePlan={model:AssetDocument;before:Vec3;after:Vec3;sourceCount:number;destinationCount:number};
type Block={min:Vec3;max:Vec3;span:Vec3};
const coordinates=(cell:Pick<Cell,'x'|'y'|'z'>):Vec3=>[cell.x,cell.y,cell.z];

/** Scale one object on its native grid; identity, author layers and the world pivot stay fixed. */
export function planObjectStepScale(input:AssetDocument,objectId:string,axis:StepScaleAxis,steps:number):ObjectStepScalePlan{
 const model=validateAsset(input),object=model.objects?.find(o=>o.objectId===objectId);
 if(!object||object.canvasIds.length!==1||!object.cellKeys?.length)throw Error('请单选同一画布中的非空物体进行步进缩放');
 const canvas=model.canvases?.find(c=>c.canvasId===object.canvasIds[0]);if(!canvas)throw Error('物体画布不存在');
 if(canvas.locked||!canvas.visible)throw Error('物体所在画布已锁定或隐藏');
 const owned=new Set(object.cellKeys),selection=new VoxelSelection();selection.replace(canvas.cells.filter(c=>owned.has(voxelKey(c))));
 const editor=new EditorDocument({...createMap(),palette:model.palette,materialProfile:model.materialProfile,cells:canvas.cells,protectedColumns:canvas.protectedColumns,...(model.sideColor===undefined?{}:{sideColor:model.sideColor})});
 const preview=planStepScale(editor,selection,axis,steps),{before,after}=preview;
 if(preview.conflicts.length)throw Error(`缩放与其他物体冲突（${preview.conflicts.length} 格），模型未改变`);
 if(!preview.destination.length)throw Error('缩小会使整个物体消失，请减少缩小步数');
 const result={model,before,after,sourceCount:preview.source.length,destinationCount:preview.destination.length};
 if(before.every((n,i)=>n===after[i]))return result;
 const otherCount=model.canvases!.reduce((n,c)=>n+(c.canvasId===canvas.canvasId?0:c.cells.length),0);
 if(otherCount+canvas.cells.length-preview.source.length+preview.destination.length>250000)throw Error('缩放超过资产 25 万格预算');
 const sourceMin=selection.bounds!.min,start=before.map((n,i)=>sourceMin[i]+Math.floor((n-after[i])/2)),destinations=new Map<string,Cell[]>(),blocks=new Map<string,Block>();
 for(const cell of preview.destination){
  const source=coordinates(cell).map((n,i)=>sourceMin[i]+Math.max(0,Math.min(before[i]-1,Math.round((n-start[i]+.5)*before[i]/after[i]-.5)))),key=source.join(',');
  const rows=destinations.get(key)??[];rows.push(cell as Cell);destinations.set(key,rows);
 }
 for(const [key,cells]of destinations){const min=[Infinity,Infinity,Infinity] as Vec3,max=[-Infinity,-Infinity,-Infinity] as Vec3;for(const cell of cells)coordinates(cell).forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);});blocks.set(key,{min,max,span:min.map((n,i)=>max[i]-n+1) as Vec3});}
 const remapRows=(rows:Cell[])=>rows.flatMap(cell=>owned.has(voxelKey(cell))?(destinations.get(voxelKey(cell))??[]).map(p=>({...cell,x:p.x,y:p.y,z:p.z})):[cell]);
 canvas.cells=[...canvas.cells.filter(c=>!owned.has(voxelKey(c))),...preview.destination as Cell[]];
 if(canvas.baseCells!==undefined||canvas.voxelCopies!==undefined){
  canvas.baseCells=remapRows(canvas.baseCells??[]);canvas.voxelCopies=canvas.voxelCopies?.map(copy=>({...copy,cells:remapRows(copy.cells)}))??[];
  if(canvas.baseCells.length+canvas.voxelCopies.reduce((n,c)=>n+c.cells.length,0)>250000)throw Error('缩放超过重叠副本 25 万格预算');
  const composed=new Map(canvas.baseCells.map(c=>[voxelKey(c),c]));for(const copy of canvas.voxelCopies)for(const c of copy.cells)composed.set(voxelKey(c),c);
  if(composed.size!==canvas.cells.length||canvas.cells.some(c=>{const row=composed.get(voxelKey(c));return !row||row.color!==c.color||(row.owner??'height')!==(c.owner??'height');}))throw Error('本次缩放无法无损保留重叠副本覆盖层，模型未改变');
  // EditorDocument reconstructs visibility in author-layer order. Keep that
  // same order so its first sync cannot introduce a second sorting-only undo.
  canvas.cells=[...composed.values()];
 }
 const blockFor=(key:string,kind:string)=>{const block=blocks.get(key);if(!block)throw Error(`本次缩小会丢失${kind}原稿所在体素，请减少缩小步数或先处理该面原稿`);return block;};
 const n=paintResolution(canvas.voxelStepM);
 let pixelCount=0,faceCount=0;
 const mapFaces=(source:SurfacePaint):SurfacePaint=>{
  const faces:SurfacePaint['faces']={};
  for(const [id,pixels]of Object.entries(source.faces)){
   const p=parsePaintFaceKey(id),key=p.slice(0,3).join(',');
   if(!owned.has(key)){pixelCount+=Object.keys(pixels).length;faceCount++;faces[id]=pixels;continue;}
   if(!Object.keys(pixels).length)continue;
   const block=blockFor(key,'绘画'),face=p[3],normal=Math.floor(face/2),t=[0,1,2].filter(a=>a!==normal),width=block.span[t[0]],height=block.span[t[1]];
   pixelCount+=Object.keys(pixels).length*width*height;if(pixelCount>MAX_PAINT_PIXELS)throw Error('缩放后的绘画原稿超过像素预算，请减小步数');
   for(const [index,color]of Object.entries(pixels)){
    const u=Number(index)%n,v=Math.floor(Number(index)/n);
    for(let dx=0;dx<width;dx++)for(let dy=0;dy<height;dy++){
     const x=u*width+dx,y=v*height+dy,point=[...block.min];point[normal]=face%2?block.min[normal]:block.max[normal];point[t[0]]+=Math.floor(x/n);point[t[1]]+=Math.floor(y/n);
     const dest=point.join(',')+','+face;if(!faces[dest]){if(++faceCount>MAX_PAINT_FACES)throw Error('缩放后的绘画原稿超过面数预算');faces[dest]={};}faces[dest][(y%n)*n+x%n]=color;
    }
   }
  }
  if(pixelCount>MAX_PAINT_PIXELS||faceCount>MAX_PAINT_FACES)throw Error('缩放后的绘画原稿超过预算');
  return {...source,faces};
 };
 if(canvas.paintSource)canvas.paintSource=mapPaintLayers(canvas.paintSource,mapFaces);
 if(canvas.faceTone){
  const faces:FaceTone['faces']={};let count=0;
  for(const [id,tone]of Object.entries(canvas.faceTone.faces)){
   const p=parsePaintFaceKey(id),key=p.slice(0,3).join(',');
   if(!owned.has(key)){faces[id]=tone;count++;continue;}
   const block=blockFor(key,'暗面'),face=p[3],normal=Math.floor(face/2),t=[0,1,2].filter(a=>a!==normal);
   count+=block.span[t[0]]*block.span[t[1]];if(count>FACE_TONE_BUDGET)throw Error('缩放后的暗面标记超过面数预算');
   for(let a=block.min[t[0]];a<=block.max[t[0]];a++)for(let b=block.min[t[1]];b<=block.max[t[1]];b++){const point=[...block.min];point[normal]=face%2?block.min[normal]:block.max[normal];point[t[0]]=a;point[t[1]]=b;faces[point.join(',')+','+face]={...tone};}
  }
  canvas.faceTone={...canvas.faceTone,faces};
 }
 object.cellKeys=preview.destination.map(voxelKey);
 result.model=validateAsset(model);return result;
}
