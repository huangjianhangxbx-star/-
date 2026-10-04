import {
  validateAsset,
  validateScene,
  type AssetDocument,
  type SceneAssets,
  type SceneDocument,
  type SceneInstance,
  type Vec3,
} from "./workshop-documents.ts";
import { isVoxelAligned, transformPoint } from "./coordinates.ts";
import { snapInstancePosition } from "./scene-drag.ts";
export type SceneCommand = {
  id: string;
  before: SceneDocument;
  after: SceneDocument;
  joint: boolean;
};
export type RootChange = {
  assetId: string;
  beforeAsset: AssetDocument;
  afterAsset: AssetDocument;
  beforeScene: SceneDocument;
  afterScene: SceneDocument;
};
/** Scene commands own document snapshots, never voxel geometry or library sources. */
export class SceneSession {
  private document: SceneDocument;
  readonly past: SceneCommand[] = [];
  readonly future: SceneCommand[] = [];
  savedRevision: number;
  private assets: SceneAssets;
  constructor(scene: SceneDocument, assets: SceneAssets, saved = true) {
    this.assets = assets;
    this.document = validateScene(scene);
    this.savedRevision = saved ? scene.revision : -1;
  }
  setAssets(assets: SceneAssets) {
    this.assets = assets;
  }
  snapshot(): SceneDocument {
    return structuredClone(this.document);
  }
  private instance(scene: SceneDocument, id: string) {
    const found = scene.instances.find((p) => p.instanceId === id);
    if (!found) throw Error("实例不存在");
    return found;
  }
  private check(p: SceneInstance) {
    const row = this.document.assets.find((a) => a.assetId === p.assetId);
    if (!row || row.kind === "texture") throw Error("模型资产未登记");
    const asset = this.assets.get(p.assetId);
    if (row.kind === "voxel") {
      if (asset?.kind !== "voxel") throw Error("缺少模块源，不能变换");
      if (!isVoxelAligned(asset.document.anchorM, p.positionM, p.rotationDeg))
        throw Error("体素几何必须对齐0.25米网格");
    }
  }
  private edit(fn: (scene: SceneDocument) => void) {
    const after = this.snapshot();
    fn(after);
    if (JSON.stringify(after) === JSON.stringify(this.document)) return;
    this.install(after, crypto.randomUUID(), false);
  }
  install(after: SceneDocument, id: string, joint: boolean) {
    after = validateScene(after);
    if (after.sceneId !== this.document.sceneId) throw Error("场景身份不匹配");
    const before = this.snapshot();
    after.revision = before.revision + 1;
    this.past.push({ id, before, after: structuredClone(after), joint });
    this.future.length = 0;
    this.document = after;
  }
  add(p: SceneInstance) {
    this.check(p);
    this.edit((s) => s.instances.push(structuredClone(p)));
  }
  addDecal(d: SceneDocument["decals"][number]) {
    if (
      !this.document.assets.some(
        (a) => a.assetId === d.assetId && a.kind === "texture",
      )
    )
      throw Error("贴花图片未登记");
    this.edit((s) => s.decals.push(structuredClone(d)));
  }
  resizeDecal(id: string, widthM: number, heightM: number) {
    this.edit((s) => {
      const d = s.decals.find((d) => d.decalId === id);
      if (!d) throw Error("贴花不存在");
      Object.assign(d, { widthM, heightM });
    });
  }
  transform(id: string, positionM: Vec3, rotationDeg: number) {
    if (this.document.decals.some((d) => d.decalId === id)) {
      this.edit((s) =>
        Object.assign(s.decals.find((d) => d.decalId === id)!, {
          positionM: structuredClone(positionM),
          rotationDeg,
        }),
      );
      return;
    }
    const p = { ...this.instance(this.document, id), positionM, rotationDeg };
    this.check(p);
    this.edit((s) => Object.assign(this.instance(s, id), structuredClone(p)));
  }
  duplicate(id: string, newInstanceId: string) {
    const decal = this.document.decals.find((d) => d.decalId === id);
    if (decal) {
      this.addDecal({ ...decal, decalId: newInstanceId });
      return;
    }
    this.add({
      ...this.instance(this.document, id),
      instanceId: newInstanceId,
    });
  }
  remove(id: string) {
    if (this.document.decals.some((d) => d.decalId === id)) {
      this.edit((s) => {
        s.decals = s.decals.filter((d) => d.decalId !== id);
      });
      return;
    }
    this.instance(this.document, id);
    this.edit((s) => {
      s.instances = s.instances.filter((p) => p.instanceId !== id);
    });
  }
  private selected(ids: readonly string[]) {
    if (!ids.length || new Set(ids).size !== ids.length)
      throw Error("请选择互不重复的元素");
    return ids.map((id) => {
      const element =
        this.document.instances.find((p) => p.instanceId === id) ??
        this.document.decals.find((d) => d.decalId === id);
      if (!element) throw Error("选择包含不存在的元素");
      return element;
    });
  }
  duplicateMany(ids: readonly string[], newIds: readonly string[]) {
    const elements = this.selected(ids);
    if (elements.length !== newIds.length) throw Error("副本身份数量不符");
    this.edit((s) =>
      elements.forEach((p, i) => {
        if ("instanceId" in p)
          s.instances.push({ ...structuredClone(p), instanceId: newIds[i] });
        else s.decals.push({ ...structuredClone(p), decalId: newIds[i] });
      }),
    );
  }
  removeMany(ids: readonly string[]) {
    this.selected(ids);
    const selected = new Set(ids);
    this.edit((s) => {
      s.instances = s.instances.filter((p) => !selected.has(p.instanceId));
      s.decals = s.decals.filter((d) => !selected.has(d.decalId));
    });
  }
  translateMany(ids: readonly string[], delta: Vec3) {
    const elements = this.selected(ids).map((p) => ({
      ...structuredClone(p),
      positionM: p.positionM.map((v, i) => v + delta[i]) as Vec3,
    }));
    for (const p of elements) if ("instanceId" in p) this.check(p);
    this.edit((s) => {
      for (const p of elements)
        if ("instanceId" in p) Object.assign(this.instance(s, p.instanceId), p);
        else Object.assign(s.decals.find((d) => d.decalId === p.decalId)!, p);
    });
  }
  rotateMany(ids: readonly string[]) {
    const elements = this.selected(ids).map((p) => ({
      ...structuredClone(p),
      rotationDeg: (p.rotationDeg + 90) % 360,
    }));
    for (const p of elements)
      if ("instanceId" in p) {
        const a = this.assets.get(p.assetId);
        if (a?.kind === "voxel")
          p.positionM = snapInstancePosition(
            p.positionM,
            a.document.anchorM,
            p.rotationDeg,
          );
        this.check(p);
      }
    this.edit((s) => {
      for (const p of elements)
        if ("instanceId" in p) Object.assign(this.instance(s, p.instanceId), p);
        else Object.assign(s.decals.find((d) => d.decalId === p.decalId)!, p);
    });
  }
  setGroup(ids: readonly string[], groupId: string) {
    const elements = this.selected(ids);
    if (elements.some((p) => !("instanceId" in p)))
      throw Error("贴花不属于模型分组");
    this.edit((s) => {
      for (const p of elements)
        if ("instanceId" in p) this.instance(s, p.instanceId).groupId = groupId;
    });
  }
  setGroupVisible(id: string, visible: boolean) {
    this.edit((s) => {
      const group = s.groups.find((g) => g.groupId === id);
      if (!group) throw Error("分组不存在");
      group.visible = visible;
    });
  }
  prepareReanchor(assetId: string, anchorM: Vec3): RootChange {
    const resolved = this.assets.get(assetId);
    if (resolved?.kind !== "voxel") throw Error("只有体素模块可以修改Root");
    const beforeAsset = validateAsset(resolved.document),
      afterAsset = validateAsset({ ...beforeAsset, anchorM, rootMode: "grid" });
    const beforeScene = this.snapshot(),
      afterScene = this.snapshot();
    const delta = anchorM.map((n, i) => n - beforeAsset.anchorM[i]) as Vec3;
    for (const p of afterScene.instances)
      if (p.assetId === assetId) {
        p.positionM = transformPoint(
          delta,
          [0, 0, 0],
          p.positionM,
          p.rotationDeg,
        );
        if (!isVoxelAligned(anchorM, p.positionM, p.rotationDeg))
          throw Error("原实例几何未对齐，不能联合修改Root");
      }
    validateScene(afterScene);
    return { assetId, beforeAsset, afterAsset, beforeScene, afterScene };
  }
  undo(jointId?: string) {
    const cmd = this.past.at(-1);
    if (!cmd) return;
    if (cmd.joint && jointId !== cmd.id)
      throw Error("联合命令必须通过会话管理器撤销");
    this.past.pop();
    this.future.push(cmd);
    this.document = {
      ...structuredClone(cmd.before),
      revision: this.document.revision + 1,
    };
  }
  redo(jointId?: string) {
    const cmd = this.future.at(-1);
    if (!cmd) return;
    if (cmd.joint && jointId !== cmd.id)
      throw Error("联合命令必须通过会话管理器重做");
    this.future.pop();
    this.past.push(cmd);
    this.document = {
      ...structuredClone(cmd.after),
      revision: this.document.revision + 1,
    };
  }
}
