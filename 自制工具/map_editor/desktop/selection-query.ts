import { pickSurface } from "../core/surface.ts";
import * as THREE from "three";
import { type SelectionCell, voxelKey } from "../core/voxel-selection.ts";
export type ScreenRect = { x0: number; y0: number; x1: number; y1: number };
/** Frozen camera/document query, reusable when only rectangle or depth changes. */
export class ScreenSelectionQuery {
  private camera: THREE.Camera;
  private cells: Map<string, SelectionCell>;
  private visible: SelectionCell[];
  private projected = new Map<string, THREE.Vector3>();
  private ranks = new Map<string, number>();
  private min = [Infinity, Infinity, Infinity];
  private max = [-Infinity, -Infinity, -Infinity];
  private direction: number[];
  constructor(
    camera: THREE.Camera,
    cells: Map<string, SelectionCell>,
    section: number | null,
  ) {
    camera.updateMatrixWorld();
    this.camera = camera.clone();
    this.camera.updateMatrixWorld();
    this.visible = [...cells.values()].filter(
      (c) => section === null || c.z + 1 <= section,
    );
    this.cells = new Map(this.visible.map((c) => [voxelKey(c), c]));
    for (const c of this.visible)
      [c.x, c.y, c.z].forEach((v, a) => {
        this.min[a] = Math.min(this.min[a], v);
        this.max[a] = Math.max(this.max[a], v + 1);
      });
    const d = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    this.direction = [d.x, -d.z, d.y];
  }
  hit(origin: number[], direction: number[]) {
    return pickSurface(this.cells, origin, direction, null, {
      min: this.min,
      max: this.max,
    });
  }
  private rank(c: SelectionCell) {
    const key = voxelKey(c),
      cached = this.ranks.get(key);
    if (cached !== undefined) return cached;
    const origin = [c.x + 0.5, c.y + 0.5, c.z + 0.5],
      pos = [c.x, c.y, c.z];
    let d = this.direction;
    if ((this.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const p = this.camera.position;
      d = [p.x * 4 - origin[0], -p.z * 4 - origin[1], p.y * 4 - origin[2]];
    }
    const step = d.map((v) => (Math.abs(v) < 1e-12 ? 0 : Math.sign(v)));
    const delta = d.map((v, a) => (step[a] ? Math.abs(1 / v) : Infinity)),
      next = delta.map((v) => v * 0.5);
    let rank = 1;
    while (true) {
      const t = Math.min(...next);
      if (!Number.isFinite(t)) break;
      // Simultaneous boundary crossings exclude zero-length corner/edge contacts.
      for (let a = 0; a < 3; a++)
        if (Math.abs(next[a] - t) < 1e-9) {
          pos[a] += step[a];
          next[a] += delta[a];
        }
      if (pos.some((v, a) => v < this.min[a] || v >= this.max[a])) break;
      if (this.cells.has(pos.join(","))) rank++;
    }
    this.ranks.set(key, rank);
    return rank;
  }
  async select(
    rect: ScreenRect,
    depth: number,
    signal?: AbortSignal,
  ): Promise<SelectionCell[]> {
    if (!(depth === Infinity || (Number.isInteger(depth) && depth >= 1)))
      throw Error("穿透层数无效");
    const result: SelectionCell[] = [],
      x0 = Math.min(rect.x0, rect.x1),
      x1 = Math.max(rect.x0, rect.x1),
      y0 = Math.min(rect.y0, rect.y1),
      y1 = Math.max(rect.y0, rect.y1);
    let slice = performance.now();
    for (let i = 0; i < this.visible.length; i++) {
      if (signal?.aborted) throw Error("selection cancelled");
      const c = this.visible[i],
        key = voxelKey(c);
      let p = this.projected.get(key);
      if (!p) {
        p = new THREE.Vector3(
          (c.x + 0.5) * 0.25,
          (c.z + 0.5) * 0.25,
          -(c.y + 0.5) * 0.25,
        ).project(this.camera);
        this.projected.set(key, p);
      }
      if (
        p.z >= -1 &&
        p.z <= 1 &&
        p.x >= x0 - 1e-9 &&
        p.x <= x1 + 1e-9 &&
        p.y >= y0 - 1e-9 &&
        p.y <= y1 + 1e-9 &&
        (depth === Infinity || this.rank(c) <= depth)
      )
        result.push(c);
      if (i % 128 === 0 && performance.now() - slice > 8) {
        await new Promise((r) => setTimeout(r, 0));
        slice = performance.now();
      }
    }
    if (signal?.aborted) throw Error("selection cancelled");
    return result;
  }
}
