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
  const { canvases, ...base } = model;
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
/** Global model history: every committed stroke and layer command is one entry. Active selection is session-only. */
export class CanvasSession {
  model: AssetDocument;
  activeId: string;
  editor: EditorDocument;
  past: { model: AssetDocument; activeId: string }[] = [];
  future: { model: AssetDocument; activeId: string }[] = [];
  constructor(model: AssetDocument) {
    this.model = validateAsset(model);
    if (!model.canvases) throw Error("需要多画布文档");
    this.activeId = model.canvases[0].canvasId;
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
  private snapshot() {
    return { model: structuredClone(this.model), activeId: this.activeId };
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
    while(this.past.length>1&&(this.past.length>40||this.past.reduce((n,s)=>n+assetCellCount(s.model),0)>1000000))this.past.shift();
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
    this.commit(next);
    this.activeId = canvasId;
    this.install();
  }
  patch(
    change: Partial<
      Pick<ModelCanvas, "name" | "visible" | "locked" | "originTicks">
    >,
  ) {
    this.sync();
    const next = structuredClone(this.model);
    Object.assign(
      next.canvases!.find((c) => c.canvasId === this.activeId)!,
      change,
    );
    this.commit(next);
    this.install();
  }
  duplicate() {
    this.sync();
    const next = structuredClone(this.model),
      copy = structuredClone(this.active);
    copy.canvasId = crypto.randomUUID();
    copy.name += " 副本";
    copy.locked = false;
    next.canvases!.push(copy);
    this.commit(next);
    this.activeId = copy.canvasId;
    this.install();
  }
  remove() {
    this.sync();
    if (this.model.canvases!.length === 1) throw Error("至少保留一张画布");
    const next = structuredClone(this.model);
    next.canvases = next.canvases!.filter((c) => c.canvasId !== this.activeId);
    this.commit(next);
    this.activeId = next.canvases[0].canvasId;
    this.install();
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
  undo() {
    this.sync();
    const previous = this.past.pop();
    if (!previous) return;
    this.future.push(this.snapshot());
    const revision = this.model.revision + 1;
    this.model = previous.model;
    this.model.revision = revision;
    this.activeId = previous.activeId;
    this.install();
  }
  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.snapshot());
    const revision = this.model.revision + 1;
    this.model = next.model;
    this.model.revision = revision;
    this.activeId = next.activeId;
    this.install();
  }
}
