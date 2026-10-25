import { paintResolution, MAX_PAINT_PIXELS } from "./surface-paint.ts";
export type SurfacePixel = {
  key: string;
  index: number;
  x: number;
  y: number;
  z: number;
  face: number;
  u: number;
  v: number;
};
export type Chart = { face: number; plane: number };
export const cellKey = (p: { x: number; y: number; z: number }) =>
  `${p.x},${p.y},${p.z}`;
export class PaintSurfaceDomain {
  readonly allowed: ReadonlySet<string>;
  readonly n: number;
  readonly cells: Map<
    string,
    { x: number; y: number; z: number; color?: number }
  >;
  private charts = new Map<string, SurfacePixel[]>();
  constructor(
    cells: readonly { x: number; y: number; z: number }[],
    allowed: ReadonlySet<string>,
    step: number,
  ) {
    this.allowed = allowed;
    this.n = paintResolution(step);
    this.cells = new Map(cells.map((c) => [cellKey(c), c]));
  }
  chart(p: SurfacePixel): Chart {
    const a = Math.floor(p.face / 2);
    return { face: p.face, plane: [p.x, p.y, p.z][a] + (p.face % 2 ? 0 : 1) };
  }
  uv(p: SurfacePixel): [number, number] {
    const t = [0, 1, 2].filter((i) => i !== Math.floor(p.face / 2)),
      c = [p.x, p.y, p.z];
    return [c[t[0]] * this.n + p.u, c[t[1]] * this.n + p.v];
  }
  pixel(chart: Chart, U: number, V: number): SurfacePixel | null {
    if (!Number.isSafeInteger(U) || !Number.isSafeInteger(V)) return null;
    const a = Math.floor(chart.face / 2),
      t = [0, 1, 2].filter((i) => i !== a),
      c = [0, 0, 0];
    c[a] = chart.plane - (chart.face % 2 ? 0 : 1);
    c[t[0]] = Math.floor(U / this.n);
    c[t[1]] = Math.floor(V / this.n);
    const k = c.join(",");
    if (!this.allowed.has(k) || !this.cells.has(k)) return null;
    const adjacent = [...c];
    adjacent[a] += chart.face % 2 ? -1 : 1;
    if (this.cells.has(adjacent.join(","))) return null;
    const u = U - c[t[0]] * this.n,
      v = V - c[t[1]] * this.n;
    return {
      key: k + "," + chart.face,
      index: v * this.n + u,
      x: c[0],
      y: c[1],
      z: c[2],
      face: chart.face,
      u,
      v,
    };
  }
  chartPixels(chart: Chart): SurfacePixel[] {
    const k = chart.face + ":" + chart.plane,
      cached = this.charts.get(k);
    if (cached) return cached;
    const result: SurfacePixel[] = [],
      a = Math.floor(chart.face / 2),
      t = [0, 1, 2].filter((i) => i !== a);
    for (const c of this.cells.values()) {
      const v = [c.x, c.y, c.z];
      if (
        v[a] !== chart.plane - (chart.face % 2 ? 0 : 1) ||
        !this.allowed.has(cellKey(c))
      )
        continue;
      for (let y = 0; y < this.n; y++)
        for (let x = 0; x < this.n; x++) {
          const p = this.pixel(
            chart,
            v[t[0]] * this.n + x,
            v[t[1]] * this.n + y,
          );
          if (p) result.push(p);
          if (result.length > MAX_PAINT_PIXELS)
            throw Error("绘画范围超过像素预算");
        }
    }
    let retained=[...this.charts.values()].reduce((n,p)=>n+p.length,0);
    while(this.charts.size&&retained+result.length>MAX_PAINT_PIXELS){const first=this.charts.keys().next().value!;retained-=this.charts.get(first)!.length;this.charts.delete(first);}
    this.charts.set(k, result);
    return result;
  }
  connected(
    start: SurfacePixel,
    accept: (p: SurfacePixel) => boolean = () => true,
  ): SurfacePixel[] {
    const chart = this.chart(start),
      pending = [this.uv(start)],
      seen = new Set<string>(),
      out: SurfacePixel[] = [];
    while (pending.length) {
      const uv = pending.pop()!,
        k = uv.join(",");
      if (seen.has(k)) continue;
      seen.add(k);
      const p = this.pixel(chart, ...uv);
      if (!p || !accept(p)) continue;
      out.push(p);
      if (out.length > MAX_PAINT_PIXELS) throw Error("填充超过像素预算");
      for (const [u, v] of [
        [uv[0] - 1, uv[1]],
        [uv[0] + 1, uv[1]],
        [uv[0], uv[1] - 1],
        [uv[0], uv[1] + 1],
      ])
        pending.push([u, v]);
    }
    return out;
  }
}
export const pixelKey = (p: { key: string; index: number }) =>
  p.key + ":" + p.index;
