import { adjustColor } from "./color-adjust.ts";
type Cell = { x: number; y: number; z: number; color: number; owner?: string };
const key = (c: Cell) => [c.x, c.y, c.z].join(",");
export function randomizeVoxels(
  cells: Cell[],
  palette: string[],
  selected: Set<string>,
  options: {
    kind: "tone" | "edge";
    amount: number;
    depth: number;
    mode: string;
    seed: number;
  },
) {
  const colors = [...palette],
    map = new Map(cells.map((c) => [key(c), { ...c }]));
  let seed = options.seed | 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const amount = Math.max(0, Math.min(100, options.amount)),
    depth = Math.max(1, Math.min(32, Math.floor(options.depth)));
  const dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  if (!amount || !selected.size)
    return { cells: [...map.values()], palette: colors };
  if (options.kind === "tone") {
    for (const c of cells) {
      if (!selected.has(key(c))) continue;
      const delta = Math.round((Math.round(random() * 16) / 8 - 1) * amount);
      const hex = adjustColor(colors[c.color], delta, 0, 0);
      let index = colors.indexOf(hex);
      if (index < 0 && colors.length < 4096) index = colors.push(hex) - 1;
      if (index >= 0) map.get(key(c))!.color = index;
    }
    return { cells: [...map.values()], palette: colors };
  }
  const original = new Map(cells.map((c) => [key(c), c]));
  for (const c of cells) {
    if (!selected.has(key(c))) continue;
    for (const d of dirs) {
      const neighbor = { ...c, x: c.x + d[0], y: c.y + d[1], z: c.z + d[2] };
      if (original.has(key(neighbor)) || random() * 100 >= amount) continue;
      const add =
        options.mode === "add" || (options.mode === "mixed" && random() > 0.5);
      const count = 1 + Math.floor(random() * depth);
      for (let n = add ? 1 : 0; n < (add ? count + 1 : count); n++) {
        const sign = add ? 1 : -1;
        const p = {
          ...c,
          x: c.x + d[0] * n * sign,
          y: c.y + d[1] * n * sign,
          z: c.z + d[2] * n * sign,
        };
        const k = key(p);
        if ([p.x, p.y, p.z].some((v) => Math.abs(v) > 8192)) break;
        if (add) {
          if (original.has(k) || map.size >= 250000) break;
          map.set(k, p);
        } else {
          if (!selected.has(k) || !original.has(k)) break;
          map.delete(k);
        }
      }
    }
  }
  return { cells: [...map.values()], palette: colors };
}
