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
    return {
      leaseId: this.leaseId,
      sessionId: this.sessionId,
      objectId: this.objectId,
      canvasId: this.session.activeId,
      model: structuredClone(this.session.model),
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
          !["leaseId", "commandId", "baseRevision", "kind", "source"].includes(
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
      return this.snapshot();
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
        validateSurfacePaint(input.source, this.session.active.voxelStepM);
        const old = this.session.active.paintSource?.faces ?? {},
          next = input.source.faces as SurfacePaint["faces"];
        for (const key of new Set([...Object.keys(old), ...Object.keys(next)]))
          if (
            JSON.stringify(old[key]) !== JSON.stringify(next[key]) &&
            !this.scope.has(key.split(",").slice(0, 3).join(","))
          )
            throw Error("绘画超出目标物体范围");
        const before = this.session.model.revision;
        this.session.withWriter(this.leaseId, () =>
          this.session.paint(structuredClone(input.source)),
        );
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
      return this.snapshot();
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
