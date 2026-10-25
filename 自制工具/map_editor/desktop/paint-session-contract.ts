import {paintSample} from "./paint-performance.ts";
import {applyPaintDelta,emptyPaint} from "./paint-command-queue.ts";
import {parsePaintFaceKey,paintResolution} from "../core/surface-paint.ts";
import type { CanvasSession } from "../core/workshop-canvases.ts";
import {
  validateSurfacePaint,
  type SurfacePaint,
} from "../core/surface-paint.ts";
/** Main renderer is the only asset authority. Clients receive snapshots, never write files. */
export class PaintLeaseAuthority {
  readonly leaseId = crypto.randomUUID();
  private live = true;
  private busy = false;
  private receipts = new Map<string, string>();
  private sequence = 0;
  private ownHistory = new WeakSet<object>();
  private undone = 0;
  private scope: Set<string>;
  readonly session: CanvasSession;
  readonly sessionId: string;
  readonly objectId: string;
  private save: () => unknown | Promise<unknown>;
  constructor(
    session: CanvasSession,
    sessionId: string,
    objectId: string,
    save: () => unknown | Promise<unknown>,
  ) {
    this.session = session;
    this.sessionId = sessionId;
    this.objectId = objectId;
    this.save = save;
    const o = session.model.objects?.find((o) => o.objectId === objectId);
    if (
      !o ||
      o.canvasIds[0] !== session.activeId ||
      session.editObjectId !== objectId
    )
      throw Error("请选择可绘画物体");
    session.editable();
    this.scope = new Set(o.cellKeys);

    session.acquireWriter(this.leaseId);
  }
  snapshot() {
    const start=performance.now(),model=structuredClone(this.session.model);paintSample("authoritySnapshot",performance.now()-start);
    return {
      paintProtocol:1,
      leaseId: this.leaseId,
      sessionId: this.sessionId,
      objectId: this.objectId,
      canvasId: this.session.activeId,
      model,
      sequence: this.sequence,
    };
  }
  async dispatch(input: any) {
    if (!this.live) throw Error("绘画会话已失效");
    if (
      !input ||
      input.leaseId !== this.leaseId ||
      typeof input.commandId !== "string" ||
      !/^[\w-]{1,100}$/.test(input.commandId) ||
      !["paint", "undo", "redo", "save"].includes(input.kind) ||
      !Number.isSafeInteger(input.baseRevision) ||
      Object.keys(input).some(
        (k) =>
          !["leaseId", "commandId", "baseRevision", "kind", "source", "paintProtocol", "delta"].includes(
            k,
          ),
      )
    )
      throw Error("绘画命令无效");
    const serialized = JSON.stringify(input);
    if (serialized.length > 32 * 1024 * 1024) throw Error("绘画消息超过32MiB");
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(serialized),
      ),
      signature = Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
    if (!this.live) throw Error("绘画会话已失效");
    const seen = this.receipts.get(input.commandId);
    if (seen) {
      if (seen !== signature) throw Error("重复命令内容冲突");
      return {...this.snapshot(),change:"paint"};
    }
    if (
      input.kind === "undo" &&
      (!this.session.past.length ||
        !this.ownHistory.has(this.session.past.at(-1)!))
    )
      throw Error("请返回建模撤销进入绘画前的操作");
    if (input.kind === "redo" && this.undone === 0)
      throw Error("没有本次绘画可重做的笔触");
    if (this.busy) throw Error("上一绘画命令尚未完成");
    if (this.receipts.size >= 4096) throw Error("请保存并重新打开绘画窗口");
    if (input.baseRevision !== this.session.model.revision)
      throw Error("绘画来源修订已过期");
    this.busy = true;
    try {
      if (input.kind === "paint") {
        const started=performance.now();
        let source=input.source;
        if(input.paintProtocol!==undefined){
          if(input.paintProtocol!==1||input.source!==undefined||!Array.isArray(input.delta)||input.delta.length>262144)throw Error('绘画差量无效');
          const n=paintResolution(this.session.active.voxelStepM),cells=new Set(this.session.active.cells.map(c=>[c.x,c.y,c.z].join(',')));
          for(const p of input.delta){
            if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['key','index','color'].includes(k))||typeof p.key!=='string'||typeof p.index!=='string'||!/^(0|[1-9]\d*)$/.test(p.index)||!Number.isSafeInteger(Number(p.index))||Number(p.index)>=n*n||(p.color!==null&&(typeof p.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(p.color))))throw Error('绘画像素差量无效');
            const [x,y,z,face]=parsePaintFaceKey(p.key),key=[x,y,z].join(',');if(!this.scope.has(key)||!cells.has(key))throw Error('绘画超出目标物体范围');const neighbor=[x,y,z];neighbor[face>>1]+=face%2?-1:1;if(cells.has(neighbor.join(',')))throw Error('绘画面不可见');
          }
          source=applyPaintDelta(this.session.active.paintSource??emptyPaint(),input.delta);
        }
        validateSurfacePaint(source, this.session.active.voxelStepM);
        const old = this.session.active.paintSource?.faces ?? {},
          next = source.faces as SurfacePaint["faces"];
        for (const key of new Set([...Object.keys(old), ...Object.keys(next)]))
          if (
            old[key] !== next[key] && JSON.stringify(old[key]) !== JSON.stringify(next[key]) &&
            !this.scope.has(key.split(",").slice(0, 3).join(","))
          )
            throw Error("绘画超出目标物体范围");
        const before = this.session.model.revision;
        this.session.withWriter(this.leaseId, () =>
          this.session.paint(source),
        );
        paintSample("authorityCommit",performance.now()-started);
        if (this.session.model.revision !== before) {
          this.undone = 0;
          this.ownHistory.add(this.session.past.at(-1)!);
        }
      } else if (input.kind === "save") await this.save();
      else {
        this.session.withWriter(this.leaseId, () =>
          this.session[input.kind as "undo" | "redo"](),
        );
        this.undone += input.kind === "undo" ? 1 : -1;
        if (input.kind === "redo")
          this.ownHistory.add(this.session.past.at(-1)!);
      }
      this.receipts.set(input.commandId, signature);
      this.sequence++;
      return {...this.snapshot(),change:"paint"};
    } finally {
      this.busy = false;
    }
  }
  release() {
    if (!this.live) return;
    this.live = false;
    this.session.releaseWriter(this.leaseId);
  }
}
