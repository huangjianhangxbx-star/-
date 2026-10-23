import type { EditorMetadata } from "./references.ts";
import { cloneAsset } from "./asset-copy.ts";
import { EditorDocument } from "./document.ts";
import {
  validateAsset,
  type AssetDocument,
  type Cell,
  type Vec3,
} from "./workshop-documents.ts";
import { toEditingMap, fromEditingMap } from "./workshop-adapter.ts";
import {ensureModelObjects, newObject, pruneObjectOwnership, expandedObjectIds, objectClipboard, pasteObjectClipboard, rotateObjectData, separateCanvasCells, type ModelObjectClipboard} from './model-objects.ts';
export {ensureModelObjects} from './model-objects.ts';
export type {ModelObjectClipboard} from './model-objects.ts';
export const CANVAS_TICK = 0.03125;
export const CANVAS_STEPS = [0.25, 0.125, 0.0625] as const;
export type ModelCanvas = {
  canvasId: string;
  name: string;
  visible: boolean;
  locked: boolean;
  voxelStepM: number;
  originTicks: Vec3;
  cells: Cell[];
  baseCells?: Cell[];
  voxelCopies?: { copyId: string; cells: Cell[] }[];
  protectedColumns: string[];
  editor?: EditorMetadata;
};
export function canvasAsset(model: AssetDocument, id: string): AssetDocument {
  const c = model.canvases?.find((c) => c.canvasId === id);
  if (!c) throw Error("画布不存在");
  const { canvases, objects, objectCollections, ...base } = model;
  return {
    ...base,
    schema: "xinghai-workshop-asset-1",
    anchorM: [0, 0, 0],
    rootMode: "grid",
    cells: c.cells,
    protectedColumns: c.protectedColumns,
    ...(c.editor ? { editor: c.editor } : {}),
    ...(c.baseCells ? { baseCells: c.baseCells } : {}),
    ...(c.voxelCopies ? { voxelCopies: c.voxelCopies } : {}),
  };
}
export function upgradeCanvases(old: AssetDocument, id: string): AssetDocument {
  old = validateAsset(old);
  if (old.canvases) throw Error("已是多画布模型");
  const { cells, baseCells, voxelCopies, protectedColumns, editor, ...base } =
    cloneAsset(old, id);
  return validateAsset({
    ...base,
    schema: "xinghai-workshop-asset-2",
    assetId: id,
    name: old.name + " · 多画布",
    revision: 0,
    cells: [],
    protectedColumns: [],
    provenance: { assetId: old.assetId, revision: old.revision },
    canvases: [
      {
        canvasId: crypto.randomUUID(),
        name: "主体",
        visible: true,
        locked: false,
        voxelStepM: 0.25,
        originTicks: [0, 0, 0],
        cells,
        protectedColumns,
        ...(editor ? { editor } : {}),
        ...(baseCells ? { baseCells } : {}),
        ...(voxelCopies ? { voxelCopies } : {}),
      },
    ],
  });
}
export function alignCanvas(
  model: AssetDocument,
  id: string,
  source: Vec3,
  target: Vec3,
): Vec3 {
  const c = model.canvases?.find((c) => c.canvasId === id);
  if (!c) throw Error("画布不存在");
  const ticks = c.originTicks.map(
    (n, i) => n + Math.round((target[i] - source[i]) / CANVAS_TICK),
  ) as Vec3;
  if (ticks.some((n) => !Number.isSafeInteger(n) || Math.abs(n) > 65536))
    throw Error("画布对齐超出范围");
  return ticks;
}
export function assetCellCount(model: AssetDocument) {
  return (
    model.canvases?.reduce((n, c) => n + c.cells.length, 0) ??
    model.cells.length
  );
}
export function canvasParts(model: AssetDocument) {
  return (
    model.canvases ?? [
      {
        canvasId: model.assetId,
        name: model.name,
        visible: true,
        locked: false,
        voxelStepM: 0.25,
        originTicks: [0, 0, 0] as Vec3,
        cells: model.cells,
        protectedColumns: model.protectedColumns,
      },
    ]
  );
}
export type CanvasSnapshot={model:AssetDocument;activeId:string;selectedObjectIds:string[];kind:'model'|'selection'};
/** Selection participates in history but remains session-only and never dirties the asset. */
export class CanvasSession {
  model: AssetDocument;
  activeId: string;
  editor: EditorDocument;
  selectedObjectIds:string[];
  past: CanvasSnapshot[] = [];
  future: CanvasSnapshot[] = [];
  private emptyReplacements = new Map<string,string>();
  constructor(model: AssetDocument) {
    this.model = ensureModelObjects(model);
    this.activeId = this.model.canvases![0].canvasId;
    this.selectedObjectIds=[this.objectForCanvas()!.objectId];
    this.editor = new EditorDocument(
      toEditingMap(canvasAsset(this.model, this.activeId)),
    );
  }
  get active() {
    return this.model.canvases!.find((c) => c.canvasId === this.activeId)!;
  }
  editable() {
    if (this.active.locked || !this.active.visible)
      throw Error("当前画布已锁定或隐藏");
  }
  private snapshot(kind:CanvasSnapshot['kind']='model'):CanvasSnapshot {
    return {model:kind==='selection'?this.model:structuredClone(this.model),activeId:this.activeId,selectedObjectIds:[...this.selectedObjectIds],kind};
  }
  private trimHistory() {
    const storedCells=()=>[...new Set(this.past.map(s=>s.model))].reduce((n,model)=>n+assetCellCount(model),0);
    while(this.past.length>1&&(this.past.length>120||this.past.filter(s=>s.kind==='model').length>40||storedCells()>1000000))this.past.shift();
  }
  private install() {
    this.editor.cancel();
    this.editor.restore(toEditingMap(canvasAsset(this.model, this.activeId)));
    this.editor.past = [];
    this.editor.future = [];
  }
  private commit(next: AssetDocument) {
    next = validateAsset(next);
    if(this.model.revision>=2147483647)throw Error('资产修订号溢出');
    this.past.push(this.snapshot());
    this.trimHistory();
    this.future = [];
    next.revision = this.model.revision + 1;
    this.model = next;
  }
  sync() {
    if (this.editor.before) return this.model;
    const proxy = canvasAsset(this.model, this.activeId),
      edited = fromEditingMap(proxy, this.editor.doc);
    const next = structuredClone(this.model),
      c = next.canvases!.find((c) => c.canvasId === this.activeId)!;
    for (const k of [
      "cells",
      "baseCells",
      "voxelCopies",
      "protectedColumns",
      "editor",
    ] as const) {
      if (edited[k] === undefined) delete c[k];
      else (c as any)[k] = edited[k];
    }
    next.palette = edited.palette;
    next.materialProfile = edited.materialProfile;
    if (edited.sideColor === undefined) delete next.sideColor;
    else next.sideColor = edited.sideColor;
    if (JSON.stringify(next) !== JSON.stringify(this.model)) {
      this.editable();
      this.commit(next);
    }
    return this.model;
  }
  select(id: string) {
    this.sync();
    if (!this.model.canvases!.some((c) => c.canvasId === id))
      throw Error("画布不存在");
    this.activeId = id;
    this.install();
  }
  add(name: string, step: number) {
    this.sync();
    const next = structuredClone(this.model);
    const canvasId = crypto.randomUUID();
    next.canvases!.push({
      canvasId,
      name,
      visible: true,
      locked: false,
      voxelStepM: step,
      originTicks: [0, 0, 0],
      cells: [],
      protectedColumns: [],
    });
    next.objects!.push(newObject(next.canvases!.at(-1)!));
    this.commit(next);
    this.activeId = canvasId;
    this.selectedObjectIds=[this.objectForCanvas()!.objectId];
    this.install();
  }
  patch(
    change: Partial<
      Pick<ModelCanvas, "name" | "visible" | "locked" | "originTicks">
    >,
    id = this.activeId,
  ) {
    this.sync();
    const next = structuredClone(this.model);
    Object.assign(
      next.canvases!.find((c) => c.canvasId === id)!,
      change,
    );
    this.commit(next);
    this.install();
  }
  duplicate(source: ModelCanvas = this.active) {
    this.sync();
    const next = structuredClone(this.model),
      copy = structuredClone(source);
    copy.canvasId = crypto.randomUUID();
    copy.name += " 副本";
    copy.locked = false;
    next.canvases!.push(copy);
    next.objects!.push(newObject(copy));
    this.commit(next);
    this.activeId = copy.canvasId;
    this.selectedObjectIds=[this.objectForCanvas()!.objectId];
    this.install();
  }
  remove(id = this.activeId) {
    this.sync();
    if (this.model.canvases!.length === 1) throw Error("至少保留一张画布");
    const next = structuredClone(this.model);
    next.canvases = next.canvases!.filter((c) => c.canvasId !== id);
    pruneObjectOwnership(next);
    this.commit(next);
    if(this.activeId===id)this.activeId = next.canvases[0].canvasId;
    this.selectedObjectIds=this.selectedObjectIds.filter(id=>next.objects!.some(o=>o.objectId===id));
    this.install();
  }
  moveBefore(id:string,targetId:string) {
    if(id===targetId)return;
    this.sync();const next=structuredClone(this.model),list=next.canvases!;
    const from=list.findIndex(c=>c.canvasId===id),target=list.findIndex(c=>c.canvasId===targetId);
    if(from<0||target<0)return;
    const [moved]=list.splice(from,1);list.splice(target,0,moved);
    this.commit(next);this.install();
  }
  reorder(delta: number) {
    this.sync();
    const next = structuredClone(this.model),
      list = next.canvases!,
      i = list.findIndex((c) => c.canvasId === this.activeId),
      j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.commit(next);
    this.install();
  }
  metadata(change: Partial<AssetDocument>) {
    this.sync();
    this.commit({ ...this.model, ...change });
    this.install();
  }
  objectForCanvas(id=this.activeId) {
    return this.model.objects!.find(o=>o.canvasIds.includes(id));
  }
  selectObject(id:string) {
    const object=this.model.objects!.find(o=>o.objectId===id);
    if(!object)throw Error('物体不存在');
    if(!object.canvasIds.includes(this.activeId))this.select(object.canvasIds[0]);
  }
  setObjectSelection(ids:readonly string[],activeObjectId?:string) {
    this.sync();
    const selected=[...new Set(ids)].filter(id=>this.model.objects!.some(o=>o.objectId===id));
    const active=this.model.objects!.find(o=>o.objectId===activeObjectId&&selected.includes(o.objectId))??
      this.model.objects!.find(o=>o.canvasIds.includes(this.activeId)&&selected.includes(o.objectId))??
      this.model.objects!.find(o=>o.objectId===selected[0]);
    const activeId=active&&!active.canvasIds.includes(this.activeId)?active.canvasIds[0]:this.activeId;
    if(activeId===this.activeId&&selected.length===this.selectedObjectIds.length&&selected.every(id=>this.selectedObjectIds.includes(id)))return;
    this.past.push(this.snapshot('selection'));this.trimHistory();this.future=[];
    this.selectedObjectIds=selected;
    if(activeId!==this.activeId){this.activeId=activeId;this.install();}
  }
  expandedObjectIds(ids:readonly string[]) { return expandedObjectIds(this.model,ids); }
  copyObjects(ids:readonly string[]):ModelObjectClipboard { this.sync();return objectClipboard(this.model,ids); }
  pasteObjects(clipboard:ModelObjectClipboard):string[] {
    this.sync();if(!clipboard.objects.length)return [];
    const next=structuredClone(this.model);
    // Removing every object requires a temporary canvas for the editor. It must not consume a paste slot.
    next.canvases=next.canvases!.filter(c=>{
      const object=next.objects!.find(o=>o.canvasIds.includes(c.canvasId));
      return !this.emptyReplacements.has(c.canvasId)||
        this.emptyReplacements.get(c.canvasId)!==JSON.stringify({canvas:c,object})||
        next.objectCollections?.some(group=>group.memberIds.includes(object!.objectId));
    });
    pruneObjectOwnership(next);
    const ids=pasteObjectClipboard(next,clipboard);
    this.commit(next);this.activeId=next.objects!.find(o=>o.objectId===ids[0])!.canvasIds[0];this.selectedObjectIds=[...ids];this.install();return ids;
  }
  duplicateObjects(ids:readonly string[]):string[] { return this.pasteObjects(this.copyObjects(ids)); }
  private checkedObjects(next:AssetDocument,ids:readonly string[]) {
    const objects=next.objects!.filter(o=>ids.includes(o.objectId));
    const canvases=next.canvases!.filter(c=>objects.some(o=>o.canvasIds.includes(c.canvasId)));
    if(canvases.some(c=>c.locked))throw Error('物体包含锁定的画布');
    return {objects,canvases};
  }
  moveObjects(ids:readonly string[],deltaTicks:Vec3) {
    this.sync();if(deltaTicks.every(n=>n===0))return;
    const next=structuredClone(this.model),{objects,canvases}=this.checkedObjects(next,ids);
    if(!objects.length)return;
    for(const value of [...objects,...canvases])value.originTicks=value.originTicks.map((n,i)=>n+deltaTicks[i]) as Vec3;
    this.commit(next);this.install();
  }
  rotateObjects(ids:readonly string[],axis=2,turns=1) {
    this.sync();if(turns%4===0)return;
    const next=structuredClone(this.model),{objects}=this.checkedObjects(next,ids);
    if(!objects.length)return;
    const active=objects.find(o=>o.canvasIds.includes(this.activeId))??objects[0];
    rotateObjectData(next,ids,axis,turns,[...active.originTicks]);this.commit(next);this.install();
  }
  joinObjects(ids:readonly string[],activeObjectId=this.objectForCanvas()!.objectId):string|null {
    this.sync();const next=structuredClone(this.model),{objects}=this.checkedObjects(next,ids);
    if(objects.length<2)return objects[0]?.objectId??null;
    const active=objects.find(o=>o.objectId===activeObjectId)??objects[0],members=new Set(objects.map(o=>o.objectId));
    active.canvasIds=objects.flatMap(o=>o.canvasIds);
    next.objects=next.objects!.filter(o=>!members.has(o.objectId)||o===active);
    // The active object's collection survives; merging never combines unrelated collections implicitly.
    if(next.objectCollections)next.objectCollections=next.objectCollections.map(c=>({...c,memberIds:c.memberIds.filter(id=>!members.has(id)||id===active.objectId)})).filter(c=>c.memberIds.length);
    this.commit(next);if(!active.canvasIds.includes(this.activeId))this.activeId=active.canvasIds[0];this.selectedObjectIds=[active.objectId];this.install();return active.objectId;
  }
  removeObjects(ids:readonly string[]) {
    this.sync();const next=structuredClone(this.model),{objects}=this.checkedObjects(next,ids);
    if(!objects.length)return;
    const removed=new Set(objects.flatMap(o=>o.canvasIds));next.canvases=next.canvases!.filter(c=>!removed.has(c.canvasId));
    const needsReplacement=!next.canvases.length;
    if(needsReplacement)next.canvases.push({canvasId:crypto.randomUUID(),name:'主体',visible:true,locked:false,voxelStepM:.25,originTicks:[0,0,0],cells:[],protectedColumns:[]});
    pruneObjectOwnership(next);this.commit(next);
    if(needsReplacement){const canvas=next.canvases[0],object=next.objects![0];this.emptyReplacements.set(canvas.canvasId,JSON.stringify({canvas,object}));while(this.emptyReplacements.size>80)this.emptyReplacements.delete(this.emptyReplacements.keys().next().value!);}
    if(removed.has(this.activeId))this.activeId=next.canvases[0].canvasId;this.selectedObjectIds=[];this.install();
  }
  separateCells(cells:readonly Pick<Cell,'x'|'y'|'z'>[]):string|null {
    this.sync();this.editable();const next=structuredClone(this.model),source=next.canvases!.find(c=>c.canvasId===this.activeId)!;
    const separated=separateCanvasCells(source,cells);if(!separated)return null;
    const object=newObject(separated);next.canvases!.push(separated);next.objects!.push(object);
    this.commit(next);this.activeId=separated.canvasId;this.selectedObjectIds=[object.objectId];this.install();return object.objectId;
  }
  createObjectCollection(ids:readonly string[],name='集合'):string|null {
    this.sync();const next=structuredClone(this.model),members=[...new Set(ids)].filter(id=>next.objects!.some(o=>o.objectId===id));
    if(!members.length)return null;
    next.objectCollections=(next.objectCollections??[]).map(c=>({...c,memberIds:c.memberIds.filter(id=>!members.includes(id))})).filter(c=>c.memberIds.length);
    const collectionId=crypto.randomUUID();next.objectCollections.push({collectionId,name,memberIds:members});this.commit(next);this.install();return collectionId;
  }
  renameObjectCollection(id:string,name:string) {
    this.sync();const next=structuredClone(this.model),collection=next.objectCollections?.find(c=>c.collectionId===id);
    if(!collection||collection.name===name)return;collection.name=name;this.commit(next);this.install();
  }
  dissolveObjectCollection(id:string) {
    this.sync();if(!this.model.objectCollections?.some(c=>c.collectionId===id))return;
    const next=structuredClone(this.model);next.objectCollections=next.objectCollections!.filter(c=>c.collectionId!==id);this.commit(next);this.install();
  }
  undo() {
    this.sync();
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.snapshot(previous.kind));
    if(previous.kind==='model'){
      const revision=this.model.revision+1;
      this.model=structuredClone(previous.model);this.model.revision=revision;
    }
    this.activeId = previous.activeId;
    this.selectedObjectIds=[...previous.selectedObjectIds];
    this.install();
  }
  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot(next.kind));this.trimHistory();
    if(next.kind==='model'){
      const revision=this.model.revision+1;
      this.model=structuredClone(next.model);this.model.revision=revision;
    }
    this.activeId = next.activeId;
    this.selectedObjectIds=[...next.selectedObjectIds];
    this.install();
  }
}
