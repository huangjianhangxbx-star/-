import {storedPaintFaces,paintSize,joinPaint} from './paint-layers.ts';
import {filterFaceTone,reconcileFaceTone,remapFaceTone,type FaceTone} from './face-tone.ts';
import {verifiedAppearancePlan,type AppearancePlan} from './appearance-asset.ts';
import {MAX_PAINT_PIXELS,MAX_PAINT_FACES,validateSurfacePaint,filterPaint,remapPaint,type SurfacePaint} from './surface-paint.ts';
import {verifiedRockAssetPlan,type RockAssetPlan} from './rock-shaping-asset.ts';
import type { EditorMetadata } from "./references.ts";
import { cloneAsset } from "./asset-copy.ts";
import { EditorDocument } from "./document.ts";
import {
  validateAsset,
  validatePaintOwners,
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
  paintSource?:SurfacePaint;
  faceTone?:FaceTone;
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
    ...(c.paintSource?{paintSource:c.paintSource}:{}),
    ...(c.faceTone?{faceTone:c.faceTone}:{}),
    protectedColumns: c.protectedColumns,
    ...(c.editor ? { editor: c.editor } : {}),
    ...(c.baseCells ? { baseCells: c.baseCells } : {}),
    ...(c.voxelCopies ? { voxelCopies: c.voxelCopies } : {}),
  };
}
export function upgradeCanvases(old: AssetDocument, id: string): AssetDocument {
  old = validateAsset(old);
  if (old.canvases) throw Error("已是多画布模型");
  const { cells, paintSource, faceTone, baseCells, voxelCopies, protectedColumns, editor, ...base } =
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
        ...(paintSource?{paintSource}:{}),
        ...(faceTone?{faceTone}:{}),
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
        ...(model.paintSource?{paintSource:model.paintSource}:{}),
        ...(model.faceTone?{faceTone:model.faceTone}:{}),
        protectedColumns: model.protectedColumns,
      },
    ]
  );
}
export type CanvasSnapshot={model:AssetDocument;activeId:string;selectedObjectIds:string[];editObjectId:string|null;kind:'model'|'selection'};
/** Selection participates in history but remains session-only and never dirties the asset. */
export class CanvasSession {
  private writer:string|null=null;private writing=false;
  get writeLeased(){return this.writer!==null;}
  acquireWriter(token:string){if(this.writer)throw Error('该资产正在绘画');this.writer=token;}
  releaseWriter(token:string){if(this.writer===token)this.writer=null;}
  withWriter<T>(token:string,fn:()=>T):T{if(token!==this.writer)throw Error('绘画租约已失效');this.writing=true;try{return fn();}finally{this.writing=false;}}
  private assertWriter(){if(this.writer&&!this.writing){this.install();throw Error('该资产正在独立绘画窗口中编辑，请先返回建模');}}

  model: AssetDocument;
  activeId: string;
  editor: EditorDocument;
  selectedObjectIds:string[];
  editObjectId:string|null=null;
  get activeObjectId(){return this.editObjectId??this.selectedObjectIds?.at(-1)??null;}
  past: CanvasSnapshot[] = [];
  future: CanvasSnapshot[] = [];
  private emptyReplacements = new Map<string,string>();
  constructor(model: AssetDocument) {
    this.model = ensureModelObjects(model);
    this.activeId = this.model.canvases![0].canvasId;
    this.selectedObjectIds=this.objectForCanvas()?[this.objectForCanvas()!.objectId]:[];
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
    return {model:kind==='selection'?this.model:structuredClone(this.model),activeId:this.activeId,selectedObjectIds:[...this.selectedObjectIds],editObjectId:this.editObjectId,kind};
  }
  private trimHistory() {
    const storedCells=()=>[...new Set(this.past.map(s=>s.model))].reduce((n,model)=>n+assetCellCount(model),0);
    while(this.past.length>1&&(this.past.length>120||this.past.filter(s=>s.kind==='model').length>40||storedCells()>1000000))this.past.shift();
  }
  private editingAsset(){const asset=canvasAsset(this.model,this.activeId);const object=this.model.objects!.find(o=>o.objectId===this.editObjectId);if(object){const keys=new Set(object.cellKeys);asset.cells=asset.cells.filter(c=>keys.has([c.x,c.y,c.z].join(',')));if(asset.paintSource)asset.paintSource=filterPaint(asset.paintSource,keys);if(asset.faceTone)asset.faceTone=filterFaceTone(asset.faceTone,keys);delete asset.baseCells;delete asset.voxelCopies;}return asset;}
  setEditObject(id:string|null){this.assertWriter();this.sync();if(id&&!this.model.objects!.some(o=>o.objectId===id))throw Error('物体不存在');this.editObjectId=id;if(id)this.activeId=this.model.objects!.find(o=>o.objectId===id)!.canvasIds[0];this.install();}
  private install() {
    this.editor.cancel();
    this.editor.restore(toEditingMap(this.editingAsset()));
    this.editor.past = [];
    this.editor.future = [];
  }
  private commit(next: AssetDocument) {
    this.assertWriter();
    next = validateAsset(next);
    if(this.model.revision>=2147483647)throw Error('资产修订号溢出');
    this.past.push(this.snapshot());
    this.trimHistory();
    this.future = [];
    next.revision = this.model.revision + 1;
    this.model = next;
  }
  sync() {
    if(this.writeLeased)return this.model;
    if (this.editor.before) return this.model;
    const proxy = this.editingAsset(),
      edited = fromEditingMap(proxy, this.editor.doc);
    // The edit proxy intentionally hides other owners and layered source fields.
    // A read-only sync (including save/undo after installing a rock result) must
    // not merge that reduced proxy back and discard the canvas's source layers.
    if((['cells','baseCells','voxelCopies','protectedColumns','editor','palette','materialProfile','sideColor'] as const)
      .every(k=>JSON.stringify(proxy[k])===JSON.stringify(edited[k])))return this.model;
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
    if(this.editObjectId){const object=next.objects!.find(o=>o.objectId===this.editObjectId)!;const old=new Set(object.cellKeys);const blocked=new Set(this.active.cells.filter(v=>!old.has([v.x,v.y,v.z].join(','))).map(v=>[v.x,v.y,v.z].join(',')));c.cells=c.cells.filter(v=>!blocked.has([v.x,v.y,v.z].join(',')));const fresh=new Set(c.cells.map(v=>[v.x,v.y,v.z].join(',')));object.cellKeys=[...fresh];
      const editedCells=new Map(c.cells.map(v=>[[v.x,v.y,v.z].join(','),v]));
      c.cells=this.active.cells.flatMap(v=>{const key=[v.x,v.y,v.z].join(',');if(!old.has(key))return [v];const replacement=editedCells.get(key);editedCells.delete(key);return replacement?[replacement]:[];});c.cells.push(...editedCells.values());delete c.baseCells;delete c.voxelCopies;
      for(const o of next.objects!)if(o!==object&&o.canvasIds.includes(c.canvasId))o.cellKeys=o.cellKeys!.filter(k=>!fresh.has(k));
    }
    if(c.paintSource)c.paintSource=filterPaint(c.paintSource,new Set(c.cells.map(v=>[v.x,v.y,v.z].join(','))));
    if(c.faceTone)c.faceTone=reconcileFaceTone(c.faceTone,this.active.cells,c.cells);
    const editingOwner=next.objects!.find(o=>o.objectId===this.editObjectId);pruneObjectOwnership(next);if(editingOwner&&!next.objects!.some(o=>o.objectId===editingOwner.objectId))next.objects!.push({...editingOwner,cellKeys:[]});
    next.palette = edited.palette;
    next.materialProfile = edited.materialProfile;
    if (edited.sideColor === undefined) delete next.sideColor;
    else next.sideColor = edited.sideColor;
    if (JSON.stringify(next) !== JSON.stringify(this.model)) {
      this.editable();
      this.commit(next);
    }
    if(this.editObjectId)this.editor.restore(toEditingMap(this.editingAsset()));
    return this.model;
  }
  paint(source:SurfacePaint,canvasLayerOperation=false){
    if(!this.writeLeased)this.sync();this.editable();if(!this.editObjectId)throw Error('请先进入物体编辑模式');
    validateSurfacePaint(source,this.active.voxelStepM);
    validatePaintOwners(source,this.active.cells,this.model.materialProfile,this.model.sideColor);
    const paints=this.model.canvases!.map(c=>c.canvasId===this.activeId?source:c.paintSource);
    if(paints.reduce((n,p)=>n+paintSize(p).faces,0)>MAX_PAINT_FACES)throw Error('绘画面资产预算超限');
    if(paints.reduce((n,p)=>n+paintSize(p).pixels,0)>MAX_PAINT_PIXELS)throw Error('绘画像素资产预算超限');
    const object=this.model.objects!.find(o=>o.objectId===this.editObjectId)!,keys=new Set(object.cellKeys),old=this.active.paintSource?.faces??{};
    let changed=JSON.stringify(this.active.paintSource?.layers?.map(({faces,...meta})=>meta))!==JSON.stringify(source.layers?.map(({faces,...meta})=>meta));
    if(!canvasLayerOperation){const beforeLayers=storedPaintFaces(this.active.paintSource),afterLayers=storedPaintFaces(source);for(let i=0;i<Math.max(beforeLayers.length,afterLayers.length);i++){const a=beforeLayers[i]??{},b=afterLayers[i]??{};for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(a[key]!==b[key]&&JSON.stringify(a[key])!==JSON.stringify(b[key])){changed=true;if(!keys.has(key.split(',').slice(0,3).join(',')))throw Error('只能绘制当前物体');}}}
    for(const key of new Set([...Object.keys(old),...Object.keys(source.faces)]))if(old[key]!==source.faces[key]&&JSON.stringify(old[key])!==JSON.stringify(source.faces[key])){changed=true;if(!canvasLayerOperation&&!keys.has(key.split(',').slice(0,3).join(',')))throw Error('只能绘制当前物体');}
    if(!changed)return;
    // Paint is a closed field update of an already valid asset. Keep the full history safety copy,
    // but do not revalidate or copy unrelated geometry into an intermediate model.
    this.assertWriter();if(this.model.revision>=2147483647)throw Error('资产修订号溢出');
    const paintSource={...source,...(source.layers?{layers:structuredClone(source.layers)}:{}),faces:Object.fromEntries(Object.entries(source.faces).map(([key,pixels])=>[key,pixels===old[key]?pixels:structuredClone(pixels)]))};this.past.push(this.snapshot());this.trimHistory();this.future=[];
    this.model={...this.model,revision:this.model.revision+1,canvases:this.model.canvases!.map(c=>c.canvasId===this.activeId?{...c,paintSource}:c)};
    if(!this.writeLeased)this.install();
  }
  applyAppearance(plan:AppearancePlan){
    this.editable();if(this.editor.before)throw Error('请先结束当前建模操作');
    const safe=verifiedAppearancePlan(plan,this.model);if(safe.canvasId!==this.activeId)throw Error('当前画布已变化');
    if(!safe.changed)return;this.commit(safe.nextModel);this.install();
  }
  applyRock(plan:RockAssetPlan){
    this.editable();
    if(this.editor.before)throw Error('请先结束当前建模操作');
    const safe=verifiedRockAssetPlan(plan,this.model);
    if(this.activeId!==safe.canvasId||
      (this.editObjectId?this.editObjectId!==safe.objectId:
        this.selectedObjectIds.length!==1||this.selectedObjectIds[0]!==safe.objectId))
      throw Error('选中物体已变化，请重新打开岩体塑形');
    // Do not sync a stale draft: sync would create an unrelated history step even
    // when the rock operation is rejected. Compare the editor's authoring fields.
    const proxy=this.editingAsset(),edited=fromEditingMap(proxy,this.editor.doc);
    for(const k of ['cells','baseCells','voxelCopies','protectedColumns','editor','palette','materialProfile','sideColor'] as const)
      if(JSON.stringify(proxy[k])!==JSON.stringify(edited[k]))throw Error('建模内容已变化，请重新预览岩体塑形');
    if(safe.result.diagnostics.blockingReasons.length)throw Error(safe.result.diagnostics.blockingReasons.join('；'));
    if(!safe.result.removedCellKeys.length&&!safe.result.addedCells.length)return;
    this.commit(safe.nextModel);this.install();
  }
  select(id: string) {
    this.assertWriter();
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

    this.commit(next);
    this.activeId = canvasId;this.editObjectId=null;
    this.selectedObjectIds=this.objectForCanvas()?[this.objectForCanvas()!.objectId]:[];
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
    if(change.originTicks){const previous=next.canvases!.find(c=>c.canvasId===id)!.originTicks;for(const o of next.objects!.filter(o=>o.canvasIds.includes(id)))o.originTicks=o.originTicks.map((n,i)=>n+change.originTicks![i]-previous[i]) as Vec3;}
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
    next.objects!.push(...this.model.objects!.filter(o=>o.canvasIds.includes(source.canvasId)).map(o=>({...structuredClone(o),objectId:crypto.randomUUID(),canvasIds:[copy.canvasId]})));pruneObjectOwnership(next);
    this.commit(next);
    this.activeId = copy.canvasId;
    this.selectedObjectIds=this.objectForCanvas()?[this.objectForCanvas()!.objectId]:[];
    this.install();
  }
  remove(id = this.activeId) {this.removeCanvases([id]);}
  removeCanvases(ids:readonly string[]){
    this.assertWriter();this.sync();const wanted=new Set(ids),canvases=this.model.canvases!;
    if(!wanted.size)return;if(canvases.filter(c=>!wanted.has(c.canvasId)).length<1)throw Error('至少保留一张画布');
    for(const id of wanted){const c=canvases.find(c=>c.canvasId===id);if(!c)throw Error('画布不存在');if(c.locked)throw Error(c.name+'：画布已锁定');}
    const next=structuredClone(this.model);next.canvases=next.canvases!.filter(c=>!wanted.has(c.canvasId));pruneObjectOwnership(next);this.commit(next);
    if(wanted.has(this.activeId))this.activeId=next.canvases![0].canvasId;const liveIds=new Set(next.objects!.map(o=>o.objectId));this.selectedObjectIds=this.selectedObjectIds.filter(id=>liveIds.has(id));if(this.editObjectId&&!liveIds.has(this.editObjectId))this.editObjectId=null;this.install();
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
    return this.model.objects!.find(o=>o.objectId===this.activeObjectId&&o.canvasIds.includes(id))??this.model.objects!.find(o=>o.canvasIds.includes(id));
  }
  selectObject(id:string) {
    const object=this.model.objects!.find(o=>o.objectId===id);
    if(!object)throw Error('物体不存在');
    if(!object.canvasIds.includes(this.activeId))this.select(object.canvasIds[0]);
  }
  setObjectSelection(ids:readonly string[],activeObjectId?:string) {
    this.assertWriter();
    this.sync();
    const liveIds=new Set(this.model.objects!.map(o=>o.objectId));
    const selected=[...new Set(ids)].filter(id=>liveIds.has(id)),selectedSet=new Set(selected),previousSet=new Set(this.selectedObjectIds);
    const active=this.model.objects!.find(o=>o.objectId===activeObjectId&&selectedSet.has(o.objectId))??
      this.model.objects!.find(o=>o.canvasIds.includes(this.activeId)&&selectedSet.has(o.objectId))??
      this.model.objects!.find(o=>o.objectId===selected[0]);
    const activeId=active&&!active.canvasIds.includes(this.activeId)?active.canvasIds[0]:this.activeId;
    if((active?.objectId??null)===this.activeObjectId&&activeId===this.activeId&&selected.length===this.selectedObjectIds.length&&selected.every(id=>previousSet.has(id)))return;
    this.past.push(this.snapshot('selection'));this.trimHistory();this.future=[];
    this.selectedObjectIds=active?[...selected.filter(id=>id!==active.objectId),active.objectId]:selected;
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
    const selected=new Set(ids),objects=next.objects!.filter(o=>selected.has(o.objectId)),canvasIds=new Set(objects.flatMap(o=>o.canvasIds));
    const canvases=next.canvases!.filter(c=>canvasIds.has(c.canvasId));
    if(canvases.some(c=>c.locked))throw Error('物体包含锁定的画布');
    return {objects,canvases};
  }
  moveObjects(ids:readonly string[],deltaTicks:Vec3) {
    this.sync();if(deltaTicks.every(n=>n===0))return;
    const next=structuredClone(this.model),{objects,canvases}=this.checkedObjects(next,ids);
    if(!objects.length)return;
    const selectedIds=new Set(ids);
    for(const c of canvases){const selected=objects.filter(o=>o.canvasIds.includes(c.canvasId)),keys=new Set(selected.flatMap(o=>o.cellKeys!)),stride=c.voxelStepM/CANVAS_TICK,delta=deltaTicks.map(n=>n/stride);if(delta.some(n=>!Number.isInteger(n)))throw Error('移动需要网格对齐');const changed=new Map<string,Cell>(),mapping=new Map<string,string>();for(const v of c.cells)if(keys.has([v.x,v.y,v.z].join(','))){const cell={...v,x:v.x+delta[0],y:v.y+delta[1],z:v.z+delta[2]},key=[cell.x,cell.y,cell.z].join(',');mapping.set([v.x,v.y,v.z].join(','),key);changed.set(key,cell);}if(c.faceTone)c.faceTone=remapFaceTone(c.faceTone,mapping);if(c.paintSource)c.paintSource=remapPaint(c.paintSource,mapping,c.voxelStepM);c.cells=[...c.cells.filter(v=>!keys.has([v.x,v.y,v.z].join(','))&&!changed.has([v.x,v.y,v.z].join(','))),...changed.values()];delete c.baseCells;delete c.voxelCopies;
    for(const o of next.objects!.filter(o=>o.canvasIds.includes(c.canvasId)))o.cellKeys=selectedIds.has(o.objectId)?o.cellKeys!.map(k=>mapping.get(k)!):o.cellKeys!.filter(k=>!changed.has(k));}
    for(const o of objects)o.originTicks=o.originTicks.map((n,i)=>n+deltaTicks[i]) as Vec3;pruneObjectOwnership(next);
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
    if(new Set(objects.flatMap(o=>o.canvasIds)).size!==1)throw Error('请先合并画布');
    active.cellKeys=objects.flatMap(o=>o.cellKeys!);
    next.objects=next.objects!.filter(o=>!members.has(o.objectId)||o===active);
    // The active object's collection survives; merging never combines unrelated collections implicitly.
    if(next.objectCollections)next.objectCollections=next.objectCollections.map(c=>({...c,memberIds:c.memberIds.filter(id=>!members.has(id)||id===active.objectId)})).filter(c=>c.memberIds.length);
    this.commit(next);if(!active.canvasIds.includes(this.activeId))this.activeId=active.canvasIds[0];this.selectedObjectIds=[active.objectId];this.install();return active.objectId;
  }
  removeObjects(ids:readonly string[]) {
    this.sync();const next=structuredClone(this.model),{objects}=this.checkedObjects(next,ids);
    if(!objects.length)return;
    for(const c of next.canvases!){const keys=new Set(objects.filter(o=>o.canvasIds.includes(c.canvasId)).flatMap(o=>o.cellKeys!));c.cells=c.cells.filter(v=>!keys.has([v.x,v.y,v.z].join(',')));c.paintSource=filterPaint(c.paintSource,new Set(c.cells.map(v=>[v.x,v.y,v.z].join(','))));c.faceTone=reconcileFaceTone(c.faceTone,this.model.canvases!.find(old=>old.canvasId===c.canvasId)!.cells,c.cells);delete c.baseCells;delete c.voxelCopies;}
    const removed=new Set(ids);next.objects=next.objects!.filter(o=>!removed.has(o.objectId));pruneObjectOwnership(next);this.commit(next);this.selectedObjectIds=[];this.editObjectId=null;this.install();
  }
  separateCells(cells:readonly Pick<Cell,'x'|'y'|'z'>[]):string|null {
    this.sync();this.editable();const next=structuredClone(this.model);const source=next.objects!.find(o=>o.objectId===this.editObjectId);if(!source)return null;
    const wanted=new Set(cells.map(v=>[v.x,v.y,v.z].join(','))),keys=source.cellKeys!.filter(k=>wanted.has(k));if(!keys.length)return null;
    source.cellKeys=source.cellKeys!.filter(k=>!wanted.has(k));const object={...structuredClone(source),objectId:crypto.randomUUID(),name:source.name+' 分离',cellKeys:keys};next.objects!.push(object);pruneObjectOwnership(next);if(!next.objects!.some(o=>o.objectId===source.objectId))next.objects!.push(source);this.commit(next);this.install();return object.objectId;
  }
  mergeCanvases(ids:readonly string[],targetId=this.activeId){
    this.sync();const next=structuredClone(this.model),target=next.canvases!.find(c=>c.canvasId===targetId)!;if(!target||!ids.includes(targetId))throw Error('请选择目标画布');const sources=next.canvases!.filter(c=>ids.includes(c.canvasId));if(sources.length<2)return;
    const stride=target.voxelStepM/CANVAS_TICK;
    for(const c of sources)if(c.locked||c.voxelStepM!==target.voxelStepM||c.originTicks.some((v,i)=>(v-target.originTicks[i])%stride!==0))throw Error('画布需要相同精度且网格对齐');
    const map=new Map(target.cells.map(v=>[[v.x,v.y,v.z].join(','),v]));
    for(const c of sources.filter(c=>c!==target)){
      const delta=c.originTicks.map((v,i)=>(v-target.originTicks[i])/stride),keyMap=new Map<string,string>(),collisionKeys=new Set<string>();
      for(const v of c.cells){const cell={...v,x:v.x+delta[0],y:v.y+delta[1],z:v.z+delta[2]},key=[cell.x,cell.y,cell.z].join(',');keyMap.set([v.x,v.y,v.z].join(','),key);collisionKeys.add(key);map.set(key,cell);}
      const retained=filterPaint(target.paintSource,new Set(target.cells.map(c=>[c.x,c.y,c.z].join(',')).filter(k=>!collisionKeys.has(k))));
      const keptTone=filterFaceTone(target.faceTone,new Set([...map.keys()].filter(k=>!collisionKeys.has(k))));const incomingTone=remapFaceTone(c.faceTone,keyMap);if(keptTone||incomingTone)target.faceTone={schema:'xinghai-face-tone-1',faces:{...keptTone?.faces,...incomingTone?.faces}};
      const incoming=remapPaint(c.paintSource,keyMap,c.voxelStepM);if(retained||incoming)target.paintSource=joinPaint(retained,incoming);
      for(const o of next.objects!){
        if(o.canvasIds.includes(targetId))o.cellKeys=o.cellKeys!.filter(k=>!collisionKeys.has(k));
        else if(o.canvasIds.includes(c.canvasId)){o.canvasIds=[targetId];o.cellKeys=o.cellKeys!.map(k=>keyMap.get(k)!);}
      }
    }
    target.cells=[...map.values()];delete target.baseCells;delete target.voxelCopies;next.canvases=next.canvases!.filter(c=>c===target||!ids.includes(c.canvasId));pruneObjectOwnership(next);this.commit(next);this.activeId=targetId;this.editObjectId=null;this.install();
  }
  createObjectCollection(ids:readonly string[],name='集合'):string|null {
    this.sync();const next=structuredClone(this.model),liveIds=new Set(next.objects!.map(o=>o.objectId)),members=[...new Set(ids)].filter(id=>liveIds.has(id)),memberSet=new Set(members);
    if(!members.length)return null;
    next.objectCollections=(next.objectCollections??[]).map(c=>({...c,memberIds:c.memberIds.filter(id=>!memberSet.has(id))})).filter(c=>c.memberIds.length);
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
    this.assertWriter();
    this.sync();
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.snapshot(previous.kind));
    if(previous.kind==='model'){
      const revision=this.model.revision+1;
      this.model=structuredClone(previous.model);this.model.revision=revision;
    }
    this.activeId = previous.activeId;
    this.selectedObjectIds=[...previous.selectedObjectIds];this.editObjectId=previous.editObjectId;
    if(!this.writeLeased)this.install();
  }
  redo() {
    this.assertWriter();
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot(next.kind));this.trimHistory();
    if(next.kind==='model'){
      const revision=this.model.revision+1;
      this.model=structuredClone(next.model);this.model.revision=revision;
    }
    this.activeId = next.activeId;
    this.selectedObjectIds=[...next.selectedObjectIds];this.editObjectId=next.editObjectId;
    if(!this.writeLeased)this.install();
  }
}
