import type {EditorDocument} from './document.ts';
import {voxelKey, type VoxelSelection, type SelectionCell} from './voxel-selection.ts';

export type ClipboardCell=SelectionCell&{offset:[number,number,number]};
export type VoxelClipboard={sourceAssetId:string;origin:[number,number,number];cells:ClipboardCell[]};
export type PlacementMode='paste'|'move';
export type PlacementPreview={mode:PlacementMode;source:VoxelClipboard;target:[number,number,number];destination:SelectionCell[];conflicts:string[];noop:string[];adds:number;removes:number};
const same=(a:SelectionCell,b:SelectionCell)=>a.color===b.color&&(a.owner??'height')===(b.owner??'height');
export function copySelection(doc:EditorDocument,selection:VoxelSelection,sourceAssetId:string):VoxelClipboard{
 if(!selection.count)throw Error('请先选择体素');
 const bounds=selection.bounds!;
 const center=[(bounds.min[0]+bounds.max[0])/2,(bounds.min[1]+bounds.max[1])/2];
 const anchor=[...selection.snapshot.values()].sort((a,b)=>a.z-b.z||((a.x-center[0])**2+(a.y-center[1])**2)-((b.x-center[0])**2+(b.y-center[1])**2)||a.x-b.x||a.y-b.y)[0];
 const origin:[number,number,number]=[anchor.x,anchor.y,anchor.z];
 const cells=[...selection.snapshot.values()].map(c=>{const current=doc.cells.get(voxelKey(c));if(!current)throw Error('选区包含已不存在体素，请重新选择或填充');return {...current,offset:[c.x-origin[0],c.y-origin[1],c.z-origin[2]] as [number,number,number]};});
 return {sourceAssetId,origin,cells};
}
export function planPlacement(doc:EditorDocument,source:VoxelClipboard,target:[number,number,number],mode:PlacementMode):PlacementPreview{
 if(!source.cells.length||target.some(v=>!Number.isSafeInteger(v)))throw Error('放置位置无效');
 const sourceKeys=new Set(source.cells.map(c=>voxelKey(c)));
 if(mode==='move')for(const c of source.cells){const old=doc.cells.get(voxelKey(c));if(!old||!same(old,c))throw Error('选区源体素已不存在或发生变化，请重新选择');}
 const destination=source.cells.map(c=>({x:target[0]+c.offset[0],y:target[1]+c.offset[1],z:target[2]+c.offset[2],color:c.color,owner:c.owner}));
 const conflicts:string[]=[],noop:string[]=[];let adds=0;
 for(const c of destination){const k=voxelKey(c),old=doc.cells.get(k);if([c.x,c.y,c.z].some(v=>Math.abs(v)>8192)){conflicts.push(k);continue;}
  if(mode==='move'&&sourceKeys.has(k))continue;
  if(old){if(mode==='paste'&&same(old,c))noop.push(k);else conflicts.push(k);}else adds++;
 }
 const removes=mode==='move'?source.cells.filter(c=>!destination.some(d=>voxelKey(d)===voxelKey(c)&&same(c,d))).length:0;
 if(doc.cells.size+adds-removes>250000)conflicts.push('体素预算超限');
 return {mode,source,target,destination,conflicts,noop,adds,removes};
}
