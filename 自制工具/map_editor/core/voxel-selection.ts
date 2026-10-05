export type SelectionCell = {
  x: number;
  y: number;
  z: number;
  color: number;
  owner?: string;
};
export const voxelKey = (c: { x: number; y: number; z: number }) =>
  `${c.x},${c.y},${c.z}`;
export class VoxelSelection {
  readonly snapshot = new Map<string, SelectionCell>();
  get keys() {
    return new Set(this.snapshot.keys());
  }
  get count() {
    return this.snapshot.size;
  }
  get bounds() {
    if (!this.count) return null;
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const c of this.snapshot.values())
      [c.x, c.y, c.z].forEach((v, i) => {
        min[i] = Math.min(min[i], v);
        max[i] = Math.max(max[i], v);
      });
    return { min, max };
  }
  replace(cells: Iterable<SelectionCell>) {
    this.clear();
    this.add(cells);
  }
  add(cells: Iterable<SelectionCell>) {
    for (const c of cells) {
      const k = voxelKey(c);
      if (!this.snapshot.has(k)) this.snapshot.set(k, { ...c });
    }
  }
  subtract(keys: Iterable<string>) {
    for (const k of keys) this.snapshot.delete(k);
  }
  clear() {
    this.snapshot.clear();
  }
}
export function filterExactCells<T extends { x: number; y: number; z: number }>(
  cells: T[],
  keys: ReadonlySet<string>,
): T[] {
  return cells.filter((c) => keys.has(voxelKey(c)));
}
