import type { RockCell } from "./rock-shaping.ts";
export type RockGrowthRoot = {
  cell: RockCell;
  directions: Map<number, number>;
};
const key = (c: RockCell) => `${c.x},${c.y},${c.z}`;
type Direction = { axis: "x" | "y" | "z"; sign: number; length: number };

/** Fill bevelled transitions only where the same selected source cell grew on
 * multiple faces, including a cap. Never grow from newly generated geometry.
 * Each new corner cell requires its inward neighbours, so obstacles/protection
 * cannot create detached corner fragments or be crossed by this joining pass.
 */
export function joinRockCapCorners(
  roots: Iterable<RockGrowthRoot>,
  added: Map<string, RockCell>,
  occupied: ReadonlySet<string>,
  protectedKeys: ReadonlySet<string> | undefined,
  blockedColumns: ReadonlySet<string> | undefined,
  budget: number,
) {
  for (const root of roots) {
    if (!root.directions.has(4) && !root.directions.has(5)) continue;
    const directions: Direction[] = [...root.directions].map(
      ([side, length]) => ({
        axis: side < 2 ? "x" : side < 4 ? "y" : "z",
        sign: side % 2 === 0 ? 1 : -1,
        length,
      }),
    );
    const fill = (axes: Direction[]) => {
      const visit = (indices: number[], axis: number, sum: number): boolean => {
        if (axis < axes.length) {
          const d = axes[axis],
            maximum = Math.min(
              d.length,
              Math.floor((1 - sum) * (d.length + 1) + 1e-9),
            );
          for (let i = 1; i <= maximum; i++)
            if (visit([...indices, i], axis + 1, sum + i / (d.length + 1)))
              return true;
          return false;
        }
        const c = { ...root.cell };
        axes.forEach((d, i) => (c[d.axis] += d.sign * indices[i]));
        const k = key(c);
        if (
          added.has(k) ||
          occupied.has(k) ||
          protectedKeys?.has(k) ||
          blockedColumns?.has(`${c.x},${c.y}`)
        )
          return false;
        if (
          !axes.every((d) =>
            added.has(key({ ...c, [d.axis]: c[d.axis] - d.sign })),
          )
        )
          return false;
        if (added.size >= budget) return true;
        added.set(k, c);
        return false;
      };
      return visit([], 0, 0);
    };
    for (let a = 0; a < directions.length; a++)
      for (let b = a + 1; b < directions.length; b++) {
        const ds = [directions[a], directions[b]];
        if (ds[0].axis !== ds[1].axis && fill(ds)) return true;
      }
    for (const x of directions.filter((d) => d.axis === "x"))
      for (const y of directions.filter((d) => d.axis === "y"))
        for (const z of directions.filter((d) => d.axis === "z"))
          if (fill([x, y, z])) return true;
  }
  return false;
}
