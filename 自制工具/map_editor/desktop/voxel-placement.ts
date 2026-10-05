import type {EditorDocument} from '../core/document.ts';
import {copySelection,planPlacement,type PlacementMode,type PlacementPreview,type VoxelClipboard} from '../core/voxel-clipboard.ts';
import type {VoxelSelection} from '../core/voxel-selection.ts';

/** Session-only clipboard and shared paste/move preview state. Geometry changes only on commit. */
export class VoxelPlacementSession {
 clipboard:VoxelClipboard|null=null;
 source:VoxelClipboard|null=null;
 mode:PlacementMode|null=null;
 target:[number,number,number]|null=null;
 preview:PlacementPreview|null=null;
 copy(doc:EditorDocument,selection:VoxelSelection,assetId:string){this.clipboard=copySelection(doc,selection,assetId);return this.clipboard.cells.length;}
 begin(mode:PlacementMode,doc:EditorDocument,selection:VoxelSelection,assetId:string){
  const source=mode==='paste'?this.clipboard:copySelection(doc,selection,assetId);
  if(!source)throw Error('剪贴板为空，请先复制选区');
  if(source.sourceAssetId!==assetId)throw Error('剪贴内容来自其他模块，请重新复制');
  this.mode=mode;this.source=source;this.target=source.origin;this.preview=planPlacement(doc,source,this.target,mode);return this.preview;
 }
 place(doc:EditorDocument,target:[number,number,number]){if(!this.mode||!this.source)throw Error('没有放置预览');this.target=target;return this.preview=planPlacement(doc,this.source,target,this.mode);}
 nudge(doc:EditorDocument,axis:0|1|2,step:-1|1){if(!this.target)throw Error('没有放置预览');const target=[...this.target] as [number,number,number];target[axis]+=step;return this.place(doc,target);}
 cancel(){this.mode=null;this.source=null;this.target=null;this.preview=null;}
}
