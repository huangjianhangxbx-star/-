import {CanvasSession, ensureModelObjects} from "../core/workshop-canvases.ts";
import {paletteFromMap} from '../core/palette.ts';
import { EditorDocument } from "../core/document.ts";
import {
  validateAsset,
  type AssetDocument,
} from "../core/workshop-documents.ts";
import { toEditingMap, fromEditingMap } from "../core/workshop-adapter.ts";
import { SceneSession, type RootChange } from "../core/scene-session.ts";
import type { SceneDocument, SceneAssets } from "../core/workshop-documents.ts";
export type Workspace = "project" | "module" | "assembly" | "publish";
export type AssetSession = {
  sessionId: string;
  asset: AssetDocument;
  canvases?: CanvasSession;
  editor: EditorDocument;
  savedRevision: number;
  savedHash: string | null;
};
export class WorkshopSession {
  private assets = new Map<string, AssetSession>();
  private synced = new WeakMap<AssetSession, unknown[]>();
  private scenes = new Map<string, SceneSession>();
  private joint = new WeakMap<
    object,
    { id: string; sceneId: string; sessionId: string }
  >();
  private jointOwners = new Map<
    string,
    { sceneId: string; sessionId: string }
  >();
  resolvedAssets(): SceneAssets {
    return new Map(
      [...this.assets.values()].map((s) => [
        s.asset.assetId,
        { kind: "voxel" as const, document: this.sync(s.sessionId) },
      ]),
    );
  }
  openScene(scene: SceneDocument, hash: string | null): SceneSession {
    if (this.scenes.has(scene.sceneId)) throw Error("场景已打开");
    const s = new SceneSession(scene, this.resolvedAssets(), hash !== null);
    this.scenes.set(scene.sceneId, s);
    return s;
  }
  sceneSession(id: string): SceneSession {
    const s = this.scenes.get(id);
    if (!s) throw Error("场景会话不存在");
    s.setAssets(this.resolvedAssets());
    return s;
  }
  dirtyScenes(): string[] {
    return [...this.scenes]
      .filter(([, s]) => s.snapshot().revision !== s.savedRevision)
      .map(([id]) => id);
  }
  markSceneSaved(id: string, revision: number) {
    const s = this.sceneSession(id);
    if (
      !Number.isInteger(revision) ||
      revision < 0 ||
      revision > s.snapshot().revision ||
      revision < s.savedRevision
    )
      throw Error("场景保存回执无效");
    s.savedRevision = revision;
  }
  prepareReanchor(id: string, anchorM: [number, number, number]): RootChange {
    const a = this.bySession(id);
    this.sync(id);
    if (a.editor.before) throw Error("先完成或取消笔刷操作");
    const scenes = [...this.scenes.values()].filter((s) =>
      s.snapshot().assets.some((row) => row.assetId === a.asset.assetId),
    );
    if (scenes.length !== 1) throw Error("联合Root要求唯一场景私有模块");
    scenes[0].setAssets(this.resolvedAssets());
    return scenes[0].prepareReanchor(a.asset.assetId, anchorM);
  }
  commitRootChange(change: RootChange) {
    const a = this.assetSession(change.assetId),
      s = this.sceneSession(change.beforeScene.sceneId);
    const expected = this.prepareReanchor(
      a.sessionId,
      change.afterAsset.anchorM,
    );
    if (JSON.stringify(change) !== JSON.stringify(expected))
      throw Error("Root提案已过期");
    const id = crypto.randomUUID(),
      owner = {
        id,
        sceneId: change.beforeScene.sceneId,
        sessionId: a.sessionId,
      };
    this.changeMetadata(a.sessionId, {
      anchorM: change.afterAsset.anchorM,
      rootMode: "grid",
    });
    s.install(change.afterScene, id, true);
    this.joint.set((a.canvases??a.editor).past.at(-1), owner);
    this.jointOwners.set(id, owner);
  }
  private moveJoint(id: string, redo: boolean) {
    const owner = this.jointOwners.get(id);
    if (!owner) throw Error("联合命令参与者已关闭");
    const a = this.bySession(owner.sessionId),
      s = this.sceneSession(owner.sceneId);
    const head = (redo ? (a.canvases??a.editor).future : (a.canvases??a.editor).past).at(-1);
    if (
      a.editor.before ||
      this.joint.get(head)?.id !== id ||
      (redo ? s.future : s.past).at(-1)?.id !== id
    )
      throw Error("请先撤销参与文档的后续编辑");
    if (redo) {
      this.redo(a.sessionId, true);
      s.redo(id);
    } else {
      this.undo(a.sessionId, true);
      s.undo(id);
    }
    this.joint.set((redo ? (a.canvases??a.editor).past : (a.canvases??a.editor).future).at(-1), {
      id,
      ...owner,
    });
  }
  undoScene(id: string) {
    const s = this.sceneSession(id),
      head = s.past.at(-1);
    if (head?.joint) this.moveJoint(head.id, false);
    else s.undo();
  }
  redoScene(id: string) {
    const s = this.sceneSession(id),
      head = s.future.at(-1);
    if (head?.joint) this.moveJoint(head.id, true);
    else s.redo();
  }
  private metadata = new WeakMap<
    object,
    {
      name: string;
      anchorM: [number, number, number];
      rootMode: "grid" | "legacy";
    }
  >();
  private meta(s: AssetSession) {
    return structuredClone({
      name: s.asset.name,
      anchorM: s.asset.anchorM,
      rootMode: s.asset.rootMode,
    });
  }
  active: { workspace: Workspace; documentId: string } = {
    workspace: "project",
    documentId: "",
  };
  openAsset(asset: AssetDocument, hash: string | null): AssetSession {
    asset = validateAsset(asset);
    if (this.assets.has(asset.assetId))
      throw Error("模块已打开，先关闭或使用原会话");
    const canvases=asset.canvases?new CanvasSession(asset):undefined;
    const session = {
      canvases,
      sessionId: crypto.randomUUID(),
      asset,
      editor: canvases?.editor ?? new EditorDocument(toEditingMap(asset)),
      savedRevision: hash === null ? -1 : asset.revision,
      savedHash: hash,
    };
    this.assets.set(asset.assetId, session);
    return session;
  }
  assetSession(id: string): AssetSession {
    const a = this.assets.get(id);
    if (!a) throw Error("模块会话不存在");
    return a;
  }
  /** Editing adds object structure without copying the asset or discarding its history. */
  ensureObjects(assetId:string):AssetSession {
    const session=this.assetSession(assetId);
    if(session.canvases){
      session.editor=session.canvases.editor;
      this.sync(session.sessionId);
      return session;
    }
    if(session.editor.before)throw Error('先完成或取消笔刷操作');
    this.sync(session.sessionId);
    const editor=session.editor,canvases=new CanvasSession(ensureModelObjects(session.asset));
    const canvasId=canvases.activeId,objectId=canvases.objectForCanvas()!.objectId;
    const {cells,baseCells,voxelCopies,protectedColumns,palette,materialProfile,sideColor,editor:reference,...base}=session.asset;
    const convert=(stack:object[])=>{
      let metadata=this.meta(session);
      const converted:CanvasSession['past']=[];
      for(let i=stack.length-1;i>=0;i--){
        const previous=stack[i] as any;
        metadata=this.metadata.get(previous)??metadata;
        const model=ensureModelObjects({
          ...base,...metadata,revision:previous.revision,cells:previous.cells,
          protectedColumns:previous.protectedColumns??[],palette:previous.palette,
          materialProfile:paletteFromMap(previous),
          ...(previous.baseCells!==undefined?{baseCells:previous.baseCells}:{}),
          ...(previous.voxelCopies!==undefined?{voxelCopies:previous.voxelCopies}:{}),
          ...(previous.editor!==undefined?{editor:previous.editor}:{}),
          ...(previous.sideColor!==undefined?{sideColor:previous.sideColor}:{}),
        });
        if(previous.sideColor===undefined)delete model.sideColor;
        model.canvases![0].canvasId=canvasId;
        model.objects![0].objectId=objectId;model.objects![0].canvasIds=[canvasId];
        const snapshot:CanvasSession['past'][number]={model,activeId:canvasId,selectedObjectIds:[objectId],kind:'model'},joint=this.joint.get(previous);
        if(joint)this.joint.set(snapshot,joint);
        converted.unshift(snapshot);
      }
      return converted;
    };
    canvases.past=convert(editor.past);canvases.future=convert(editor.future);
    session.canvases=canvases;session.asset=canvases.model;session.editor=canvases.editor;
    this.synced.delete(session);
    return session;
  }
  private bySession(id: string): AssetSession {
    const a = [...this.assets.values()].find((a) => a.sessionId === id);
    if (!a) throw Error("模块会话已关闭");
    return a;
  }
  /** Geometry is edited transactionally. A restore can reuse a revision, so
   * identities and history heads join the revision in the synchronization key.
   * Small metadata is compared by value because palette/Root fields are mutable. */
  private syncState(s: AssetSession): unknown[] {
    const editor = s.canvases?.editor ?? s.editor;
    const metadata = ({ cells, baseCells, voxelCopies, canvases, ...value }: any) => value;
    const model = s.canvases?.model;
    return [s.asset, editor, editor.data, editor.cells, editor.cells.size,
      editor.data.revision, editor.past.at(-1), editor.future.at(-1),
      model, s.canvases?.activeId,
      JSON.stringify([metadata(s.asset), metadata(editor.data), model && metadata(model),
        model?.canvases?.map(metadata)]),
      ...(model?.canvases?.flatMap(c => [c, c.cells, c.cells.length, c.baseCells, c.voxelCopies]) ?? [])];
  }
  sync(id: string): AssetDocument {
    const s = this.bySession(id);
    if (s.editor.before) return s.canvases ? (s.asset = s.canvases.model) : s.asset;
    const state = this.syncState(s), previous = this.synced.get(s);
    if (previous && state.length === previous.length && state.every((value, i) => value === previous[i])) return s.asset;
    if(s.canvases)s.asset=s.canvases.sync();
    else if (!s.editor.before) s.asset = fromEditingMap(s.asset, s.editor.doc);
    this.synced.set(s, this.syncState(s));
    return s.asset;
  }
  activate(workspace: Workspace, documentId: string) {
    if (!["project", "module", "assembly", "publish"].includes(workspace))
      throw Error("工作区无效");
    if (workspace === "module") this.assetSession(documentId);
    this.active = { workspace, documentId };
  }
  markSaved(id: string, revision: number, hash: string) {
    const s = this.bySession(id);
    this.sync(id);
    if (
      !Number.isInteger(revision) ||
      revision < 0 ||
      revision > s.asset.revision ||
      !/^[a-f0-9]{64}$/.test(hash)
    )
      throw Error("保存回执无效");
    if (revision < s.savedRevision) throw Error("过期保存回执");
    s.savedRevision = revision;
    s.savedHash = hash;
  }
  dirtyDocuments(): string[] {
    return [...this.assets.values()]
      .filter((s) => this.sync(s.sessionId).revision !== s.savedRevision)
      .map((s) => s.asset.assetId);
  }
  private checkLocalRootHistory(s: AssetSession, next: object) {
    const meta = s.canvases ? (next as any).model : this.metadata.get(next);
    if (
      meta &&
      meta.anchorM.some((n:number, i:number) => n !== s.asset.anchorM[i]) &&
      [...this.scenes.values()].some((scene) =>
        scene.snapshot().instances.some((p) => p.assetId === s.asset.assetId),
      )
    )
      throw Error("请先撤销场景后续实例编辑，再恢复较早的模块Root");
  }
  undo(id: string, joint = false) {
    const multi=this.bySession(id);if(multi.canvases){
      const head=multi.canvases.past.at(-1);if(!head)return;
      if(!joint&&this.joint.has(head)){this.moveJoint(this.joint.get(head)!.id,false);return;}
      if(!joint)this.checkLocalRootHistory(multi,head);
      multi.canvases.undo();multi.asset=multi.canvases.model;return;
    }
    const s = this.bySession(id),
      next = s.editor.past.at(-1),
      old = this.meta(s);
    if (!next) return;
    if (!joint && this.joint.has(next)) {
      this.moveJoint(this.joint.get(next)!.id, false);
      return;
    }
    if (!joint) this.checkLocalRootHistory(s, next);
    s.editor.undo();
    this.metadata.set(s.editor.future.at(-1), old);
    const meta = this.metadata.get(next);
    if (meta) Object.assign(s.asset, meta);
    this.sync(id);
  }
  redo(id: string, joint = false) {
    const multi=this.bySession(id);if(multi.canvases){
      const head=multi.canvases.future.at(-1);if(!head)return;
      if(!joint&&this.joint.has(head)){this.moveJoint(this.joint.get(head)!.id,true);return;}
      if(!joint)this.checkLocalRootHistory(multi,head);
      multi.canvases.redo();multi.asset=multi.canvases.model;return;
    }
    const s = this.bySession(id),
      next = s.editor.future.at(-1),
      old = this.meta(s);
    if (!next) return;
    if (!joint && this.joint.has(next)) {
      this.moveJoint(this.joint.get(next)!.id, true);
      return;
    }
    if (!joint) this.checkLocalRootHistory(s, next);
    s.editor.redo();
    this.metadata.set(s.editor.past.at(-1), old);
    const meta = this.metadata.get(next);
    if (meta) Object.assign(s.asset, meta);
    this.sync(id);
  }
  private changeMetadata(id: string, change: Partial<AssetDocument>) {
    const s = this.bySession(id);
    this.sync(id);
    if(s.canvases){s.canvases.metadata(change);s.asset=s.canvases.model;return;}
    const candidate = validateAsset({ ...s.asset, ...change });
    const before = this.meta(s);
    s.editor.begin();
    s.editor.data.revision++;
    s.editor.commit();
    this.metadata.set(s.editor.past.at(-1), before);
    s.asset = candidate;
    this.sync(id);
  }
  rename(id: string, name: string) {
    this.changeMetadata(id, { name });
  }
  reanchor(id: string, anchorM: [number, number, number]) {
    const a = this.bySession(id);
    if (
      [...this.scenes.values()].some((s) =>
        s.snapshot().instances.some((row) => row.assetId === a.asset.assetId),
      )
    ) {
      this.commitRootChange(this.prepareReanchor(id, anchorM));
      return;
    }
    this.changeMetadata(id, { anchorM, rootMode: "grid" });
  }
  closeAsset(id: string, discard = false) {
    const s = this.assetSession(id);
    if (
      [...(s.canvases??s.editor).past, ...(s.canvases??s.editor).future].some((head) =>
        this.joint.has(head),
      )
    )
      throw Error("模块参与场景联合历史，请保留会话");
    if (!discard && this.dirtyDocuments().includes(id))
      throw Error("模块尚未保存");
    this.assets.delete(id);
    if (this.active.documentId === id)
      this.active = { workspace: "project", documentId: "" };
  }
  closeScene(id: string) {
    if (!this.scenes.has(id)) throw Error('场景会话不存在');
    if ([...this.jointOwners.values()].some((owner) => owner.sceneId === id))
      throw Error('场景包含联合编辑历史，请先保存再移入回收区');
    this.scenes.delete(id);
  }
}
