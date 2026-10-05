import {
  brushCandidates,
  applyBrush,
  type BrushConfig,
  type Candidate,
} from "./brush.ts";
import type { EditorDocument } from "./document.ts";

type Hit = { x: number; y: number; z: number; face?: number };
type Group = { points: Candidate[] };
export type EditOperationPlan = {
  readonly kind: "brush" | "rectangle";
  readonly config: Readonly<BrushConfig>;
  readonly candidates: Candidate[];
  readonly groups: Group[];
  readonly summary: {
    applied: number;
    noop: number;
    skipped: number;
    estimatedAdds: number;
    estimatedRemoves: number;
  };
  readonly dirtyKeys: string[];
};
const key = (p: Hit) => `${p.x},${p.y},${p.z}`;
const seenKey = (p: Candidate, c: BrushConfig) =>
  `${c.mode}:${key(p)}:${p.face}`;
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function build(
  e: EditorDocument,
  hits: Hit[],
  config: BrushConfig,
  seen: ReadonlySet<string>,
  kind: EditOperationPlan["kind"],
): EditOperationPlan {
  const c = { ...config },
    groups: Group[] = [],
    candidates: Candidate[] = [],
    unique = new Set<string>();
  let count = e.cells.size,
    adds = 0,
    removes = 0;
  for (const hit of hits) {
    const points = brushCandidates(e, hit, c).filter(
      (p) => !seen.has(seenKey(p, c)),
    );
    groups.push({ points });
    const columns = new Set<string>();
    for (const raw of points) {
      const p = { ...raw },
        k = key(p),
        id = `${k}:${p.face}`;
      if (unique.has(id)) continue;
      unique.add(id);
      if (p.status === "applied" && c.mode === "height" && c.action === "add") {
        const col = `${p.x},${p.y}`;
        if (!columns.has(col)) {
          columns.add(col);
          for (const oldKey of e.columns.get(col) ?? []) {
            const old = e.cells.get(oldKey);
            if (old.z < c.level - c.thickness || old.z >= c.level) {
              candidates.push({ ...p, z: old.z, status: "applied" });
              removes++;
              count--;
            }
          }
        }
        const old = e.cells.get(k);
        if (old && old.color === c.color && old.owner === "height")
          p.status = "noop";
      }
      if (p.status === "applied" && c.mode === "property") {
        const old = e.data.surfaces.find(
          (s: any) =>
            s.x === p.x && s.y === p.y && s.z === p.z && s.face === p.face,
        );
        if ((old?.tag ?? "") === (c.action === "erase" ? "" : c.tag))
          p.status = "noop";
      }
      if (p.status === "applied" && c.mode !== "property") {
        const old = e.cells.get(k);
        if (c.action === "erase") {
          if (old) {
            removes++;
            count--;
          } else p.status = "noop";
        } else if (!old) {
          adds++;
          count++;
        }
      }
      candidates.push(p);
      if (count > 250000) throw Error("体素预算超限，计划未执行");
    }
  }
  const summary = {
    applied: 0,
    noop: 0,
    skipped: 0,
    estimatedAdds: adds,
    estimatedRemoves: removes,
  };
  for (const p of candidates) summary[p.status]++;
  return freeze({
    kind,
    config: c,
    candidates,
    groups,
    summary,
    dirtyKeys: [
      ...new Set(candidates.filter((p) => p.status === "applied").map(key)),
    ],
  });
}
export function buildBrushPlan(
  e: EditorDocument,
  hit: Hit,
  c: BrushConfig,
  seen: ReadonlySet<string> = new Set(),
): EditOperationPlan {
  return build(e, [hit], c, seen, "brush");
}
export function buildRectanglePlan(
  e: EditorDocument,
  start: Hit,
  end: Hit,
  c: BrushConfig,
  seen: ReadonlySet<string> = new Set(),
): EditOperationPlan {
  if (!["height", "volume"].includes(c.mode))
    throw Error("矩形工具仅适用于地台和固定工作层三维绘制");
  const n = (Math.abs(end.x - start.x) + 1) * (Math.abs(end.y - start.y) + 1);
  if (!Number.isSafeInteger(n) || n > 4096 || n * c.thickness > 250000)
    throw Error("矩形超过列数或体积预算");
  const hits: Hit[] = [];
  for (let x = Math.min(start.x, end.x); x <= Math.max(start.x, end.x); x++)
    for (let y = Math.min(start.y, end.y); y <= Math.max(start.y, end.y); y++)
      hits.push({ ...end, x, y });
  return build(e, hits, { ...c, size: 1 }, seen, "rectangle");
}

/** Coordinates a gesture; EditorDocument remains the sole transaction/history owner. */
export class EditOperationSession {
  private editor: EditorDocument;
  private seen = new Set<string>();
  private generation = 0;
  private serial = 0;
  private plans = new WeakMap<
    EditOperationPlan,
    { generation: number; serial: number; revision: number }
  >();
  config: Readonly<BrushConfig> | null = null;
  active = false;
  busy = false;
  constructor(editor: EditorDocument) {
    this.editor = editor;
  }
  begin(config: BrushConfig) {
    if (this.active) throw Error("已有编辑操作");
    this.editor.begin();
    this.config = freeze({ ...config });
    this.active = true;
    this.generation++;
    this.serial = 0;
    this.seen.clear();
  }
  private remember(p: EditOperationPlan) {
    this.plans.set(p, {
      generation: this.generation,
      serial: this.serial,
      revision: this.editor.data.revision,
    });
    return p;
  }
  brush(hit: Hit) {
    if (!this.config) throw Error("请先开始操作");
    return this.remember(
      buildBrushPlan(this.editor, hit, this.config, this.seen),
    );
  }
  rectangle(start: Hit, end: Hit) {
    if (!this.config) throw Error("请先开始操作");
    return this.remember(
      buildRectanglePlan(this.editor, start, end, this.config, this.seen),
    );
  }
  private check(p: EditOperationPlan) {
    const stamp = this.plans.get(p);
    if (
      !this.active ||
      !stamp ||
      stamp.generation !== this.generation ||
      stamp.serial !== this.serial ||
      stamp.revision !== this.editor.data.revision
    )
      throw Error("操作计划过期或属于其他会话");
  }
  private applyGroups(p: EditOperationPlan, groups: Group[]) {
    this.editor.batch(() => {
      for (const group of groups)
        applyBrush(this.editor, group.points, p.config, this.seen);
    });
  }
  apply(p: EditOperationPlan) {
    try {
      this.check(p);
      if (this.busy) throw Error("正在执行操作");
      this.applyGroups(p, p.groups);
      this.serial++;
    } catch (e) {
      this.cancel();
      throw e;
    }
  }
  async executeChunked(
    p: EditOperationPlan,
    chunkSize = 64,
    yieldFrame: () => Promise<unknown> = () =>
      new Promise((resolve) => setTimeout(resolve, 0)),
    onProgress?: (done: number, total: number) => void,
  ) {
    const generation = this.generation;
    try {
      this.check(p);
      if (this.busy || !Number.isSafeInteger(chunkSize) || chunkSize < 1)
        throw Error("分片参数或状态无效");
      this.busy = true;
      for (let i = 0; i < p.groups.length; i += chunkSize) {
        if (generation !== this.generation || !this.active) return false;
        this.applyGroups(p, p.groups.slice(i, i + chunkSize));
        onProgress?.(Math.min(i + chunkSize, p.groups.length), p.groups.length);
        await yieldFrame();
      }
      if (generation !== this.generation || !this.active) return false;
      this.serial++;
      return true;
    } catch (e) {
      if (generation !== this.generation) return false;
      this.cancel();
      throw e;
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  commit() {
    if (!this.active) return;
    if (this.busy) throw Error("操作尚未完成");
    try {
      this.editor.commit();
    } catch (e) {
      this.cancel();
      throw e;
    }
    this.finish();
  }
  cancel() {
    if (this.active) this.editor.cancel();
    this.finish();
  }
  private finish() {
    this.generation++;
    this.active = false;
    this.busy = false;
    this.config = null;
    this.seen.clear();
  }
}
