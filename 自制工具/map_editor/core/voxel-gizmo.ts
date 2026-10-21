import type {EditorDocument} from './document.ts';
import type {SelectionCell as Cell} from './voxel-selection.ts';

export type GizmoTransform = {kind:'move';delta:[number,number,number]} | {kind:'rotate';axis:'x'|'y'|'z';turns:number};
export type GizmoPlan = {source:Cell[];destination:Cell[];conflicts:string[];copyId:string|null};
const key=(c:Cell)=>`${c.x},${c.y},${c.z}`;

function rotate(cell:Cell,axis:'x'|'y'|'z',turns:number,pivot:number[]):Cell{
 const value=[cell.x,cell.y,cell.z];
 const [a,b]=axis==='x'?[1,2]:axis==='y'?[2,0]:[0,1];
 for(let i=0;i<((turns%4)+4)%4;i++){
  const u=value[a]-pivot[a],v=value[b]-pivot[b];
  value[a]=pivot[a]-v;value[b]=pivot[b]+u;
 }
 return {...cell,x:Math.round(value[0]),y:Math.round(value[1]),z:Math.round(value[2])};
}

export function planGizmoTransform(editor:EditorDocument,selected:Cell[],transform:GizmoTransform,copyId:string|null=null):GizmoPlan{
 if(!selected.length)throw Error('请先选择体素');
 if(transform.kind==='move'&&!transform.delta.every(Number.isSafeInteger))throw Error('移动量必须为整数格');
 if(transform.kind==='rotate'&&(!['x','y','z'].includes(transform.axis)||!Number.isSafeInteger(transform.turns)))throw Error('旋转只允许 90° 步进');
 const copy=copyId?editor.doc.voxelCopies?.find((group:any)=>group.copyId===copyId):null;
 if(copyId&&!copy)throw Error('选中的体素组已变化，请重新选择');
 const source:Cell[]=copy?copy.cells.map((c:Cell)=>({...c})):selected.map(c=>{
  const live=editor.cells.get(key(c));
  if(!live||live.color!==c.color||live.owner!==c.owner)throw Error('选区源体素已变化，请重新选择');
  return {...live};
 });
 const min=[0,1,2].map(i=>Math.min(...source.map(c=>[c.x,c.y,c.z][i])));
 const max=[0,1,2].map(i=>Math.max(...source.map(c=>[c.x,c.y,c.z][i])));
 const pivot=min.map((n,i)=>(n+max[i])/2);
 if(transform.kind==='rotate'){
  const [a,b]=transform.axis==='x'?[1,2]:transform.axis==='y'?[2,0]:[0,1];
  if((max[a]-min[a])%2!==(max[b]-min[b])%2){pivot[a]=Math.floor(pivot[a]);pivot[b]=Math.floor(pivot[b]);}
 }
 const destination=source.map(c=>transform.kind==='move'?{...c,x:c.x+transform.delta[0],y:c.y+transform.delta[1],z:c.z+transform.delta[2]}:rotate(c,transform.axis,transform.turns,pivot));
 if(destination.some(c=>[c.x,c.y,c.z].some(n=>!Number.isSafeInteger(n)||Math.abs(n)>8192)))throw Error('变换结果坐标越界');
 const sourceKeys=new Set(source.map(key));
 const conflicts=copy?[]:destination.map(key).filter(k=>editor.cells.has(k)&&!sourceKeys.has(k));
 if(!copy&&editor.cells.size-sourceKeys.size+new Set(destination.map(key)).size>250000)throw Error('体素预算超限');
 return {source,destination,conflicts,copyId};
}

export function previewGizmoDocument(editor:EditorDocument,plan:GizmoPlan){
 const doc=editor.doc;
 if(plan.copyId){
  const copies=doc.voxelCopies??[];
  const cells=new Map<string,Cell>();
  for(const c of doc.baseCells??doc.cells)cells.set(key(c),c);
  for(const group of copies)for(const c of group.copyId===plan.copyId?plan.destination:group.cells)cells.set(key(c),c);
  doc.cells=[...cells.values()];
 }else{
  const source=new Set(plan.source.map(key));
  const cells=new Map<string,Cell>(doc.cells.filter((c:Cell)=>!source.has(key(c))).map((c:Cell)=>[key(c),c]));
  for(const c of plan.destination)cells.set(key(c),c);
  doc.cells=[...cells.values()];
 }
 return doc;
}

export function applyGizmoTransform(editor:EditorDocument,plan:GizmoPlan){

 editor.begin();
 try{
  if(plan.copyId)editor.replaceVoxelCopyCells(plan.copyId,plan.destination);
  else editor.batch(()=>{
   for(const c of plan.source)editor.put(c.x,c.y,c.z,c.color,c.owner??'volume',true);
   for(const c of plan.destination)editor.put(c.x,c.y,c.z,c.color,c.owner??'volume');
  });
  editor.commit();
 }catch(error){editor.cancel();throw error;}
}
