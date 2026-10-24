import {
  type SurfacePaint,
  MAX_PAINT_PIXELS,
  MAX_PAINT_FACES,
} from "../core/surface-paint.ts";
export type PaintDelta = { key: string; index: string; color: string | null }[];
export const emptyPaint = (): SurfacePaint => ({
  schema: "xinghai-surface-paint-1",
  density: 64,
  faces: {},
});
export function paintDelta(
  before: SurfacePaint,
  next: SurfacePaint,
): PaintDelta {
  const out: PaintDelta = [];
  for (const key of new Set([
    ...Object.keys(before.faces),
    ...Object.keys(next.faces),
  ]))
    for (const index of new Set([
      ...Object.keys(before.faces[key] ?? {}),
      ...Object.keys(next.faces[key] ?? {}),
    ]))
      if (before.faces[key]?.[index] !== next.faces[key]?.[index])
        out.push({ key, index, color: next.faces[key]?.[index] ?? null });
  return out;
}
export function applyPaintDelta(source: SurfacePaint, delta: PaintDelta) {
  const next = structuredClone(source);
  for (const p of delta) {
    if (p.color === null) {
      if (next.faces[p.key]) {
        delete next.faces[p.key][p.index];
        if (!Object.keys(next.faces[p.key]).length) delete next.faces[p.key];
      }
    } else (next.faces[p.key] ??= {})[p.index] = p.color;
  }
  if (
    Object.keys(next.faces).length > MAX_PAINT_FACES ||
    Object.values(next.faces).reduce((n, f) => n + Object.keys(f).length, 0) >
      MAX_PAINT_PIXELS
  )
    throw Error("绘画像素预算超限");
  return next;
}
type Item = {
  kind: string;
  delta?: PaintDelta;
  input?: any;
  resolve: () => void;
  reject: (e: Error) => void;
};
/** One IPC writer, bounded unsent deltas. A failed command is retained verbatim for retry. */
export class PaintCommandQueue {
  private items: Item[] = [];
  private running = false;
  failed = false;
  private snapshot: any;
  private send: (i: any) => Promise<any>;
  private changed: (snapshot: any, source: SurfacePaint) => void;
  constructor(
    snapshot: any,
    send: (i: any) => Promise<any>,
    changed: (snapshot: any, source: SurfacePaint) => void,
  ) {
    this.snapshot = snapshot;
    this.send = send;
    this.changed = changed;
  }
  get pending() {
    return this.items.length;
  }
  source(): SurfacePaint {
    let source =
      this.snapshot.source ??
      this.snapshot.model.canvases.find(
        (c: any) => c.canvasId === this.snapshot.canvasId,
      )?.paintSource ??
      emptyPaint();
    if (!this.failed)
      for (const item of this.items)
        if (item.delta) source = applyPaintDelta(source, item.delta);
    return structuredClone(source);
  }
  paint(before: SurfacePaint, next: SurfacePaint) {
    if (this.failed) return Promise.reject(Error("提交失败，先重试或放弃队列"));
    if (this.items.length >= 4)
      return Promise.reject(Error("绘画队列已满，请等待确认"));
    const delta = paintDelta(before, next);
    if (
      JSON.stringify(delta).length +
        this.items.reduce(
          (n, i) => n + JSON.stringify(i.delta ?? []).length,
          0,
        ) >
      32 * 1024 * 1024
    )
      return Promise.reject(Error("排队笔触超过32MiB预算"));
    if (!delta.length) return Promise.resolve();
    applyPaintDelta(this.source(), delta);
    return this.enqueue({ kind: "paint", delta });
  }
  command(kind: string) {
    if (this.failed) return Promise.reject(Error("提交失败，先重试或放弃队列"));
    return this.enqueue({ kind });
  }
  private enqueue(value: Pick<Item, "kind" | "delta">) {
    const promise = new Promise<void>((resolve, reject) =>
      this.items.push({ ...value, resolve, reject }),
    );
    this.changed(this.snapshot, this.source());
    void this.pump();
    return promise;
  }
  private async pump() {
    if (this.running || this.failed) return;
    this.running = true;
    while (this.items.length && !this.failed) {
      const item = this.items[0];
      try {
        item.input ??= {
          leaseId: this.snapshot.leaseId,
          commandId: crypto.randomUUID(),
          baseRevision: this.snapshot.model.revision,
          kind: item.kind,
          ...(item.delta
            ? { source: applyPaintDelta(this.confirmedSource(), item.delta) }
            : {}),
        };
        this.snapshot = await this.send(item.input);
        this.items.shift();
        this.changed(this.snapshot, this.source());
        item.resolve();
      } catch (e) {
        this.failed = true;
        this.changed(this.snapshot, this.confirmedSource());
        item.reject(e as Error);
        for (const later of this.items.slice(1))
          later.reject(Error("前一笔失败，后续笔触尚未提交"));
      }
    }
    this.running = false;
  }
  private confirmedSource(): SurfacePaint {
    return (
      this.snapshot.source ??
      this.snapshot.model.canvases.find(
        (c: any) => c.canvasId === this.snapshot.canvasId,
      )?.paintSource ??
      emptyPaint()
    );
  }
  async retry() {
    if (!this.failed) return;
    this.failed = false;
    const first = this.items[0];
    const p = new Promise<void>((resolve, reject) => {
      first.resolve = resolve;
      first.reject = reject;
    });
    void this.pump();
    await p;
    await this.drain();
  }
  discard() {
    if (this.running) throw Error("正在确认的笔触不能放弃");
    this.items = [];
    this.failed = false;
    this.changed(this.snapshot, this.confirmedSource());
  }
  async drain() {
    while (this.running || this.items.length) {
      if (this.failed) throw Error("提交失败，队列已冻结");
      await new Promise((r) => setTimeout(r, 5));
    }
  }
}
