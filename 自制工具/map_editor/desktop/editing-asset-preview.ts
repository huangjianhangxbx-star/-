import {CanvasSession,CANVAS_TICK} from '../core/workshop-canvases.ts';
import type {EditorDocument} from '../core/document.ts';
import type {EditingMap} from '../core/workshop-adapter.ts';
import type {AssetDocument} from '../core/workshop-documents.ts';
import type {GizmoTransform} from '../core/voxel-gizmo.ts';

function detachedEditingSession(session:CanvasSession){
 const draft=new CanvasSession(session.model);
 draft.select(session.activeId);
 if(session.editObjectId)draft.setEditObject(session.editObjectId);
 return draft;
}
/** Merge the current native editing proxy on a detached session, never the live history. */
export function editingAssetPreview(session:CanvasSession,document:EditingMap):AssetDocument{
 const draft=detachedEditingSession(session);
 draft.editor.restore(document);
 // A visible-cell preview may still carry the previous overlap layers. Restore
 // composes those layers, so replay the visible difference through normal writes
 // instead of silently ignoring cells or flattening unrelated author layers.
 const key=(cell:{x:number;y:number;z:number})=>`${cell.x},${cell.y},${cell.z}`,wanted=new Map(document.cells.map(cell=>[key(cell),cell]));
 const changed=wanted.size!==draft.editor.cells.size||document.cells.some(cell=>{const old=draft.editor.cells.get(key(cell));return !old||old.color!==cell.color||old.owner!==cell.owner;});
 if(changed){
  draft.editor.begin();
  try{
   draft.editor.batch(()=>{
    for(const cell of [...draft.editor.cells.values()])if(!wanted.has(key(cell)))draft.editor.put(cell.x,cell.y,cell.z,cell.color,cell.owner??'volume',true);
    for(const cell of wanted.values()){const old=draft.editor.cells.get(key(cell));if(!old||old.color!==cell.color||old.owner!==cell.owner)draft.editor.put(cell.x,cell.y,cell.z,cell.color,cell.owner??'volume');}
   });
   draft.editor.commit();
  }catch(error){draft.editor.cancel();throw error;}
 }
 return draft.sync();
}

/** Run a copy-aware edit operation on the detached current proxy. The callback
 * keeps its normal transaction semantics (for example applyGizmoTransform).
 */
export function editingOperationAssetPreview(session:CanvasSession,edit:(editor:EditorDocument)=>void):{model:AssetDocument;document:EditingMap}{
 const draft=detachedEditingSession(session);
 draft.editor.restore(session.editor.doc);
 edit(draft.editor);
 const model=draft.sync();return{model,document:draft.editor.doc};
}

/** Use the exact object commit path; view-space transforms must not reach scene assets. */
export function objectTransformAssetPreview(session:CanvasSession,ids:readonly string[],transform:GizmoTransform):AssetDocument{
 const draft=new CanvasSession(session.model);
 // Install this canvas's editor too: assigning activeId alone leaves the first
 // canvas's proxy in place, and the transform's initial sync would overwrite it.
 draft.select(session.activeId);
 if(transform.kind==='move')draft.moveObjects(ids,transform.delta.map(n=>Math.round(n*session.active.voxelStepM/CANVAS_TICK)) as [number,number,number]);
 else draft.rotateObjects(ids,{x:0,y:1,z:2}[transform.axis],transform.turns);
 return draft.model;
}
