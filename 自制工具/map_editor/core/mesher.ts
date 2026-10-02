export type Quad = {
  axis: number;
  sign: number;
  plane: number;
  a: number;
  b: number;
  w: number;
  h: number;
  color: number;
  chunk: string;
};
export const chunkKey = (x: number, y: number, z: number) =>
  [x, y, z].map((v) => Math.floor(v / 16)).join(",");
export function meshMap(doc: any, only?: Set<string>): Quad[] {
  const occupied = new Set(doc.cells.map((c: any) => `${c.x},${c.y},${c.z}`));
  const groups = new Map<
    string,
    {
      axis: number;
      sign: number;
      plane: number;
      color: number;
      chunk: string;
      mask: Set<string>;
    }
  >();
  for (const c of doc.cells) {
    const pos = [c.x, c.y, c.z],
      chunk = chunkKey(...(pos as [number, number, number]));
    if (only && !only.has(chunk)) continue;
    for (let axis = 0; axis < 3; axis++)
      for (const sign of [-1, 1]) {
        const n = [...pos];
        n[axis] += sign;
        if (occupied.has(n.join(","))) continue;
        const plane = pos[axis] + (sign === 1 ? 1 : 0);
        const axes = [0, 1, 2].filter((a) => a !== axis);
        const color =
          axis === 2 && sign === 1 ? c.color : (doc.sideColor ?? c.color);
        const k = [chunk, axis, sign, plane, color].join("|");
        let g = groups.get(k);
        if (!g) {
          g = { axis, sign, plane, color, chunk, mask: new Set() };
          groups.set(k, g);
        }
        g.mask.add(`${pos[axes[0]]},${pos[axes[1]]}`);
      }
  }
  const out: Quad[] = [];
  for (const g of groups.values()) {
    const positions = [...g.mask]
      .map((k) => k.split(",").map(Number))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [a, b] of positions) {
      if (!g.mask.has(`${a},${b}`)) continue;
      let w = 1,
        h = 1;
      while (g.mask.has(`${a + w},${b}`)) w++;
      outer: while (true) {
        for (let x = 0; x < w; x++)
          if (!g.mask.has(`${a + x},${b + h}`)) break outer;
        h++;
      }
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) g.mask.delete(`${a + x},${b + y}`);
      out.push({
        axis: g.axis,
        sign: g.sign,
        plane: g.plane,
        color: g.color,
        chunk: g.chunk,
        a,
        b,
        w,
        h,
      });
    }
  }
  return out;
}
export function affectedChunks(x: number, y: number, z: number): string[] {
  const out = new Set([chunkKey(x, y, z)]),
    p = [x, y, z];
  for (let axis = 0; axis < 3; axis++) {
    const local = ((p[axis] % 16) + 16) % 16;
    if (local === 0 || local === 15) {
      const q = [...p];
      q[axis] += local === 0 ? -1 : 1;
      out.add(chunkKey(...(q as [number, number, number])));
    }
  }
  return [...out];
}
