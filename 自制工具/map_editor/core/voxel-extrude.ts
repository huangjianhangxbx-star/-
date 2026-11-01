import type {EditorDocument} from './document.ts';
import {VoxelSelection,voxelKey,type SelectionCell} from './voxel-selection.ts';
import type {Vec3} from './workshop-documents.ts';

export type VoxelExtrudePlan={
 face:number;steps:number;source:SelectionCell[];destination:SelectionCell[];
 additions:SelectionCell[];removals:SelectionCell[];conflicts:string[];before:Vec3;after:Vec3;
};
const constraints=new WeakMap<VoxelExtrudePlan,ReadonlySet<string>>();
const coordinates=(c:SelectionCell)=>[c.x,c.y,c.z];
const same=(a:SelectionCell,b:SelectionCell)=>a.color===b.color&&(a.owner??'height')===(b.owner??'height');
function dimensions(cells:SelectionCell[]):Vec3{
 if(!cells.length)return[0,0,0];const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const c of cells)coordinates(c).forEach((n,i)=>{min[i]=Math.min(min[i],n);max[i]=Math.max(max[i],n);});
 return min.map((n,i)=>max[i]-n+1) as Vec3;
}
function freeze<T>(value:T):T{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}

/** Grow only the selected column ends; contraction stops at the first gap or unselected cell.
 * Canvas locks belong to the caller's editing context. protectedColumns keeps
 * its existing height/volume authoring meaning; it is not an object read lock.
 */
export function planVoxelExtrude(editor:EditorDocument,selection:VoxelSelection,face:number,steps:number,blockedKeys:ReadonlySet<string>=new Set()):VoxelExtrudePlan{
 if(!Number.isInteger(face)||face<0||face>5)throw Error('请选择有效的六向拉伸面');
 if(!Number.isSafeInteger(steps))throw Error('拉伸步数必须为整数格');
 if(!selection.count)throw Error('请先选择当前物体内的体素');
 const blocked=new Set(blockedKeys),source:SelectionCell[]=[],selected=new Map<string,SelectionCell>(),axis=Math.floor(face/2),sign=face%2?-1:1,tangents=[0,1,2].filter(a=>a!==axis),columns=new Map<string,SelectionCell>();
 for(const snapshot of selection.snapshot.values()){
  const key=voxelKey(snapshot),live=editor.cells.get(key);
  if(blocked.has(key))throw Error('选区包含其他物体的体素，请重新选择');
  if(!live||!same(live,snapshot))throw Error('选区源体素已变化，请重新选择');
  const cell={...live} as SelectionCell,p=coordinates(cell),column=tangents.map(a=>p[a]).join(','),boundary=columns.get(column);
  source.push(cell);selected.set(key,cell);
  if(!boundary||p[axis]*sign>coordinates(boundary)[axis]*sign)columns.set(column,cell);
 }
 let foreignCount=0;for(const key of blocked)if(!editor.cells.has(key))foreignCount++;
 if(steps>0&&(columns.size*steps>250000||editor.cells.size+foreignCount+columns.size*steps>250000))throw Error('拉伸超过 25 万格体素预算，计划未执行');
 const additions:SelectionCell[]=[],removals:SelectionCell[]=[],conflicts=new Set<string>();
 for(const boundary of columns.values()){
  const start=coordinates(boundary);
  if(steps>0)for(let distance=1;distance<=steps;distance++){
   const p=[...start];p[axis]+=sign*distance;
   if(p.some(n=>!Number.isSafeInteger(n)||Math.abs(n)>8192))throw Error('拉伸目标坐标越界，计划未执行');
   const cell={...boundary,x:p[0],y:p[1],z:p[2]},key=voxelKey(cell);
   if(blocked.has(key)||editor.cells.has(key)&&!selected.has(key))conflicts.add(key);
   additions.push(cell);
  }
  else if(steps<0)for(let distance=0;distance<Math.min(-steps,source.length);distance++){
   const p=[...start];p[axis]-=sign*distance;const key=p.join(','),cell=selected.get(key);
   if(!cell||blocked.has(key))break;
   removals.push({...cell});
  }
 }
 const removed=new Set(removals.map(voxelKey)),destination=[...source.filter(c=>!removed.has(voxelKey(c))),...additions];
 const plan:VoxelExtrudePlan={face,steps,source,destination,additions,removals,conflicts:[...conflicts],before:dimensions(source),after:dimensions(destination)};
 constraints.set(plan,blocked);return freeze(plan);
}

/** Revalidate against the current document before a single owned undo transaction.
 * The same immutable plan may also be applied to a detached preview editor.
 */
export function applyVoxelExtrude(editor:EditorDocument,plan:VoxelExtrudePlan,blockedKeys?:ReadonlySet<string>):VoxelExtrudePlan{
 const originalConstraints=constraints.get(plan);if(!originalConstraints)throw Error('拉伸预览计划已失效，请重新预览');
 if(editor.before)throw Error('请先结束当前建模笔画');
 const selection=new VoxelSelection();selection.replace(plan.source);
 const fresh=planVoxelExtrude(editor,selection,plan.face,plan.steps,blockedKeys??originalConstraints);
 if(fresh.conflicts.length)throw Error(`拉伸与其他物体或未选体素冲突（${fresh.conflicts.length} 格），模型未改变`);
 if(!fresh.additions.length&&!fresh.removals.length)return fresh;
 editor.begin();
 try{
  editor.batch(()=>{
   for(const c of fresh.removals)editor.put(c.x,c.y,c.z,c.color,c.owner??'height',true);
   for(const c of fresh.additions)editor.put(c.x,c.y,c.z,c.color,c.owner??'height');
  });editor.commit();return fresh;
 }catch(error){editor.cancel();throw error;}
}
