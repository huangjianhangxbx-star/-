/** Pure integer-cell prototype; no Workshop history, ownership or paint mutation. */
export type RockCell = { x: number; y: number; z: number; color: number };
export type RockSeedGroup = 'layout' | 'breaks' | 'chips' | 'terraces' | 'contour';
export type RockOptions = {
  preset: "columnar-wall" | "terraced-rim";
  seed: number;
  /** Per-stream salts; absent/zero preserves the original master-seed result. */
  randomSeeds?: Partial<Record<RockSeedGroup, number>>;
  cellSize?: number;
  sides?: number[];
  maxDepth: number;
  minWidth: number;
  maxWidth: number;
  continuity: number;
  breakStrength: number;
  regularity: number;
  chips: number;
  bandWidth: number;
  layers: number;
  contourScale: number;
  layerVariation: number;
  minThickness: number;
  targetKeys?: ReadonlySet<string>;
  protectedKeys?: ReadonlySet<string>;
  locked?: boolean;
  hidden?: boolean;
};
export const DEFAULT_ROCK_OPTIONS: RockOptions = {
  preset: "columnar-wall",
  seed: 17,
  cellSize: 0.25,
  sides: [0, 1, 2, 3],
  maxDepth: 3,
  minWidth: 2,
  maxWidth: 6,
  continuity: 18,
  breakStrength: 0.25,
  regularity: 0.5,
  chips: 0,
  bandWidth: 9,
  layers: 4,
  contourScale: 12,
  layerVariation: 0.2,
  minThickness: 2,
  locked: false,
  hidden: false,
};
export type RockStructure = {
  layoutSeed: number;
  columnBands?: {
    start: number;
    end: number;
    depth: number;
    breakHeight: number;
    breakDelta: number;
  }[];
  perimeter?: number;
  layers?: { bottom: number; top: number; retreat: number }[];
  distanceMetric?: string;
};
export type RockResult = {
  cells: RockCell[];
  removedCellKeys: string[];
  sourceStamp: string;
  recipe: unknown;
  diagnostics: {
    requested: number;
    applied: number;
    protected: number;
    unsupported: number;
    blockingReasons: string[];
  };
  structure: RockStructure;
};
const key = (c: RockCell) => `${c.x},${c.y},${c.z}`;
const xy = (x: number, y: number) => `${x},${y}`;
const order = (a: RockCell, b: RockCell) => a.x - b.x || a.y - b.y || a.z - b.z;
const neighbors = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const seedGroups:RockSeedGroup[]=['layout','breaks','chips','terraces','contour'];
function streamSeed(o:RockOptions,group:RockSeedGroup) {
  return (o.seed ^ (o.randomSeeds?.[group] ?? 0)) >>> 0;
}
function random(seed: number, stream: number, a: number, b = 0) {
  let n =
    (seed ^
      Math.imul(stream, 0x9e3779b9) ^
      Math.imul(a, 0x85ebca6b) ^
      Math.imul(b, 0xc2b2ae35)) >>>
    0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function stamp(cells: RockCell[]) {
  let h = 2166136261;
  for (const c of cells)
    for (const ch of `${key(c)},${c.color};`)
      h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `rock-source-1-${(h >>> 0).toString(16)}-${cells.length}`;
}
function validOptions(o: RockOptions) {
  return (
    ["columnar-wall", "terraced-rim"].includes(o.preset) &&
    Number.isSafeInteger(o.seed) &&
    (o.randomSeeds === undefined || (!!o.randomSeeds && !Array.isArray(o.randomSeeds) &&
      typeof o.randomSeeds === 'object' && Object.entries(o.randomSeeds).every(([k,v])=>
        seedGroups.includes(k as RockSeedGroup) && Number.isInteger(v) && v>=0 && v<=2147483647))) &&
    [
      o.maxDepth,
      o.minWidth,
      o.maxWidth,
      o.continuity,
      o.bandWidth,
      o.layers,
      o.contourScale,
      o.minThickness,
    ].every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 4096) &&
    o.minWidth >= 2 &&
    o.maxWidth >= o.minWidth &&
    o.continuity >= o.maxWidth * 2 &&
    o.minThickness >= 2 &&
    o.layers >= 1 &&
    o.contourScale >= 2 &&
    [o.breakStrength, o.regularity, o.chips, o.layerVariation].every(
      (v) => Number.isFinite(v) && v >= 0 && v <= 1,
    ) &&
    [0.25, 0.125, 0.0625].includes(o.cellSize!) &&
    o.sides!.every((s) => Number.isInteger(s) && s >= 0 && s <= 3)
  );
}
/** Each original six-neighbor component must keep exactly one nonempty component. */
function connected(source: Map<string, RockCell>, removed: Set<string>) {
  const seen = new Set<string>();
  for (const [start, c] of source) {
    if (seen.has(start)) continue;
    const queue = [c];
    seen.add(start);
    let survivor: RockCell | undefined;
    let count = 0;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (!removed.has(key(p))) {
        count++;
        survivor = p;
      }
      for (const [dx, dy, dz] of neighbors) {
        const k = `${p.x + dx},${p.y + dy},${p.z + dz}`;
        const n = source.get(k);
        if (n && !seen.has(k)) {
          seen.add(k);
          queue.push(n);
        }
      }
    }
    if (!survivor) return false;
    const retained = new Set([key(survivor)]),
      q = [survivor];
    for (let i = 0; i < q.length; i++)
      for (const [dx, dy, dz] of neighbors) {
        const p = q[i],
          k = `${p.x + dx},${p.y + dy},${p.z + dz}`,
          n = source.get(k);
        if (n && !removed.has(k) && !retained.has(k)) {
          retained.add(k);
          q.push(n);
        }
      }
    if (retained.size !== count) return false;
  }
  return true;
}
/** Check actual retained intervals after union of side candidates, never each side alone. */
function thickness(
  cells: RockCell[],
  removed: Set<string>,
  minimum: number,
  axes: number[],
) {
  for (const axis of axes) {
    const rows = new Map<string, RockCell[]>();
    for (const c of cells) {
      const k =
        axis === 0
          ? `${c.y},${c.z}`
          : axis === 1
            ? `${c.x},${c.z}`
            : `${c.x},${c.y}`;
      const r = rows.get(k) ?? [];
      r.push(c);
      rows.set(k, r);
    }
    const at = (c: RockCell) => (axis === 0 ? c.x : axis === 1 ? c.y : c.z);
    for (const row of rows.values()) {
      row.sort((a, b) => at(a) - at(b));
      let run = 0;
      for (let i = 0; i <= row.length; i++) {
        const c = row[i];
        if (
          c &&
          !removed.has(key(c)) &&
          (i === 0 || at(c) === at(row[i - 1]) + 1) &&
          run > 0
        ) {
          run++;
          continue;
        }
        if (run > 0 && run < minimum) return false;
        run = c && !removed.has(key(c)) ? 1 : 0;
      }
    }
  }
  return true;
}
/** Candidate planning only: trim cuts that leave a short axial sliver before committing. */
function limitJointCuts(
  cells: RockCell[],
  removed: Set<string>,
  minimum: number,
) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const axis of [0, 1]) {
      const rows = new Map<string, RockCell[]>();
      const at = (c: RockCell) => (axis === 0 ? c.x : c.y);
      for (const c of cells) {
        const k = axis === 0 ? `${c.y},${c.z}` : `${c.x},${c.z}`,
          row = rows.get(k) ?? [];
        row.push(c);
        rows.set(k, row);
      }
      for (const row of rows.values()) {
        row.sort((a, b) => at(a) - at(b));
        let begin = 0;
        while (begin < row.length) {
          let end = begin + 1;
          while (end < row.length && at(row[end]) === at(row[end - 1]) + 1)
            end++;
          let i = begin;
          while (i < end) {
            if (removed.has(key(row[i]))) {
              i++;
              continue;
            }
            const first = i;
            while (i < end && !removed.has(key(row[i]))) i++;
            let need = minimum - (i - first),
              left = first - 1,
              right = i;
            while (need > 0 && (left >= begin || right < end)) {
              const index = right < end ? right++ : left--;
              if (removed.delete(key(row[index]))) {
                changed = true;
                need--;
              }
            }
          }
          begin = end;
        }
      }
    }
  }
}
function bands(o: RockOptions, length: number, minZ: number, height: number) {
  const count = Math.max(
    Math.ceil(length / o.maxWidth),
    Math.min(
      Math.floor(length / o.minWidth),
      Math.round(length / ((o.minWidth + o.maxWidth) / 2)),
    ),
  );
  const out: NonNullable<RockStructure["columnBands"]> = [];
  let start = 0,
    id = 0;
  while (start < length) {
    const remaining = count - id - 1,
      lo = Math.max(o.minWidth, length - start - remaining * o.maxWidth),
      hi = Math.min(o.maxWidth, length - start - remaining * o.minWidth);
    const width = Math.max(
        lo,
        Math.min(
          hi,
          Math.round(
            (lo + hi) / 2 +
              (random(streamSeed(o,'layout'), 1, id) - 0.5) *
                (hi - lo) *
                2 *
                (1 - o.regularity),
          ),
        ),
      ),
      end = start + width;
    out.push({
      start,
      end,
      depth: 0.12 + 0.82 * random(streamSeed(o,'layout'), 2, id),
      // Events outside the wall stay outside; never clamp all bands to its final row.
      breakHeight:
        minZ + Math.round(o.continuity * (0.8 + 0.4 * random(streamSeed(o,'breaks'), 3, id))),
      breakDelta: (random(streamSeed(o,'breaks'), 4, id) - 0.5) * o.breakStrength,
    });
    start = end;
    id++;
  }
  return out;
}
export function shapeRock(
  input: readonly RockCell[],
  options: RockOptions,
): RockResult {
  const o: RockOptions = {
    ...DEFAULT_ROCK_OPTIONS,
    ...options,
    sides: [...new Set(options.sides ?? DEFAULT_ROCK_OPTIONS.sides)].sort(),
  };
  const cells = input.map((c) => ({ ...c })).sort(order),
    source = new Map(cells.map((c) => [key(c), c]));
  const result: RockResult = {
    cells,
    removedCellKeys: [],
    sourceStamp: stamp(cells),
    recipe: {
      schema: "xinghai-rock-recipe-1",
      options: {
        ...o,
        targetKeys: o.targetKeys ? [...o.targetKeys].sort() : undefined,
        protectedKeys: o.protectedKeys
          ? [...o.protectedKeys].sort()
          : undefined,
      },
    },
    diagnostics: {
      requested: 0,
      applied: 0,
      protected: 0,
      unsupported: 0,
      blockingReasons: [],
    },
    structure: { layoutSeed: streamSeed(o,'layout') },
  };
  const reject = (reason: string) => {
    result.diagnostics.blockingReasons.push(reason);
    result.diagnostics.unsupported = cells.length;
    return result;
  };
  if (!validOptions(o))
    return reject("Invalid parameters or unsupported cell precision.");
  if (cells.length > 300000)
    return reject("Prototype cell budget exceeded (300000).");
  if (
    cells.some((c) => ![c.x, c.y, c.z, c.color].every(Number.isSafeInteger)) ||
    source.size !== cells.length
  )
    return reject("Cells must have unique integer coordinates and color IDs.");
  if (o.hidden || o.locked) return reject("Target is hidden or locked.");
  const target = cells.filter((c) => !o.targetKeys || o.targetKeys.has(key(c))),
    targetMap = new Map(target.map((c) => [key(c), c]));
  if (!target.length) return reject("Empty target.");
  const bounds = target.reduce(
    (b, c) => ({
      minX: Math.min(b.minX, c.x),
      maxX: Math.max(b.maxX, c.x),
      minY: Math.min(b.minY, c.y),
      maxY: Math.max(b.maxY, c.y),
      minZ: Math.min(b.minZ, c.z),
      maxZ: Math.max(b.maxZ, c.z),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    },
  );
  const { minX, maxX, minY, maxY, minZ, maxZ } = bounds,
    w = maxX - minX + 1,
    d = maxY - minY + 1,
    h = maxZ - minZ + 1;
  const candidates = new Set<string>(),
    protectedCandidates = new Set<string>();
  const propose = (c: RockCell) => {
    const k = key(c);
    if (o.protectedKeys?.has(k)) protectedCandidates.add(k);
    else candidates.add(k);
  };
  if (o.preset === "columnar-wall") {
    if (!o.maxDepth || !o.sides!.length) return result;
    if (w + d > 100000) return reject("Prototype perimeter budget exceeded.");
    const perimeter = 2 * (w + d);
    if (Math.ceil(perimeter / o.maxWidth) > Math.floor(perimeter / o.minWidth))
      return reject("Perimeter cannot fit the requested band width bounds.");
    const field = bands(o, perimeter, minZ, h);
    result.structure.columnBands = field;
    result.structure.perimeter = perimeter;
    const findBand = (u: number) => {
      let lo = 0,
        hi = field.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (u >= field[mid].end) lo = mid + 1;
        else hi = mid;
      }
      return field[lo];
    };
    for (const side of o.sides!) {
      const axis = side < 2 ? "x" : "y",
        other = side < 2 ? "y" : "x",
        positive = side === 0 || side === 2;
      const rows = new Map<string, RockCell[]>();
      // Other objects are ray barriers; a ray never jumps across one to the target.
      for (const c of cells) {
        const k = `${c[other]},${c.z}`,
          r = rows.get(k) ?? [];
        r.push(c);
        rows.set(k, r);
      }
      for (const row of rows.values()) {
        row.sort((a, b) => (positive ? b[axis] - a[axis] : a[axis] - b[axis]));
        const first = row[0];
        if (!targetMap.has(key(first))) continue;
        const interval: RockCell[] = [];
        for (const c of row) {
          if (
            !targetMap.has(key(c)) ||
            (interval.length &&
              Math.abs(c[axis] - interval[interval.length - 1][axis]) !== 1)
          )
            break;
          interval.push(c);
        }
        const u =
          side === 0
            ? w + (first.y - minY)
            : side === 1
              ? 2 * w + d + (maxY - first.y)
              : side === 2
                ? w + d + (maxX - first.x)
                : first.x - minX;
        const band = findBand(u),
          base =
            band.depth + (first.z >= band.breakHeight ? band.breakDelta : 0);
        let depth = Math.min(
          o.maxDepth,
          Math.max(0, Math.round(o.maxDepth * Math.max(0, Math.min(1, base)))),
        );
        if (
          o.chips &&
          random(
            streamSeed(o,'chips'),
            5,
            Math.floor(u / 2),
            Math.floor((first.z - minZ) / 2),
          ) <
            o.chips * 0.08
        )
          depth = Math.min(o.maxDepth, depth + 1);
        depth = Math.min(depth, Math.max(0, interval.length - o.minThickness));
        for (let i = 0; i < depth; i++) {
          const c = interval[i];
          if (o.protectedKeys?.has(key(c))) {
            protectedCandidates.add(key(c));
            break;
          }
          propose(c);
        }
      }
    }
  } else {
    if (!o.bandWidth) return result;
    if ((w + 2) * (d + 2) > 1000000)
      return reject("Prototype planar extent budget exceeded (1000000).");
    const columns = new Map<string, RockCell[]>();
    for (const c of target) {
      const k = xy(c.x, c.y),
        r = columns.get(k) ?? [];
      r.push(c);
      columns.set(k, r);
    }
    for (const col of columns.values()) {
      col.sort((a, b) => a.z - b.z);
      if (
        col.length !== h ||
        col[0].z !== minZ ||
        col[col.length - 1].z !== maxZ
      )
        return reject(
          "Terraces require a flat solid platform: stacked intervals, variable bottoms and overhangs are unsupported.",
        );
    }
    if (h < o.minThickness + o.layers)
      return reject("Platform is too thin for the requested layer count.");
    // Flood external empty pixels. Enclosed courtyards cannot originate carving.
    const exterior = new Set<string>([xy(minX - 1, minY - 1)]),
      q: [number, number][] = [[minX - 1, minY - 1]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const a = x + dx,
          b = y + dy,
          k = xy(a, b);
        if (
          a < minX - 1 ||
          a > maxX + 1 ||
          b < minY - 1 ||
          b > maxY + 1 ||
          columns.has(k) ||
          exterior.has(k)
        )
          continue;
        exterior.add(k);
        q.push([a, b]);
      }
    }
    // Bounded chamfer distance, axial 3 / diagonal 4; first occupied center = 1 cell.
    const distance = new Map<string, number>(),
      buckets: Array<Array<[number, number]>> = Array.from(
        { length: o.bandWidth * 3 + 5 },
        () => [],
      );
    for (const k of columns.keys()) {
      const [x, y] = k.split(",").map(Number);
      let v = Infinity;
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if ((dx || dy) && exterior.has(xy(x + dx, y + dy)))
            v = Math.min(v, dx && dy ? 4 : 3);
      if (v < Infinity) {
        distance.set(k, v);
        buckets[v].push([x, y]);
      }
    }
    for (let v = 3; v < buckets.length; v++)
      for (const [x, y] of buckets[v]) {
        if (distance.get(xy(x, y)) !== v) continue;
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++) {
            if (!dx && !dy) continue;
            const k = xy(x + dx, y + dy),
              next = v + (dx && dy ? 4 : 3);
            if (
              next >= buckets.length ||
              !columns.has(k) ||
              next >= (distance.get(k) ?? Infinity)
            )
              continue;
            distance.set(k, next);
            buckets[next].push([x + dx, y + dy]);
          }
      }
    const layers: NonNullable<RockStructure["layers"]> = [],
      weights = Array.from(
        { length: o.layers },
        (_, i) => 0.55 + random(streamSeed(o,'terraces'), 6, i),
      );
    const total = weights.reduce((a, b) => a + b, 0);
    // Independent positive cumulative widths create nested, uneven rock shelves.
    const retreatWeights = Array.from(
      { length: Math.max(0, o.layers - 1) },
      (_, i) => (0.5 + random(streamSeed(o,'terraces'), 9, i)) * (i % 2 === 0 ? 0.65 : 1.55),
    );
    const retreatTotal = retreatWeights.reduce((a, b) => a + b, 0) || 1;
    let retreatAccumulated = 0;
    let bottom = minZ,
      accumulated = 0;
    for (let i = 0; i < o.layers; i++) {
      accumulated += weights[i];
      const top =
        i === o.layers - 1
          ? maxZ
          : Math.min(
              maxZ - (o.layers - i - 1),
              Math.max(
                bottom,
                minZ + Math.round((h * accumulated) / total) - 1,
              ),
            );
      if (i > 0) retreatAccumulated += retreatWeights[i - 1];
      layers.push({ bottom, top, retreat: retreatAccumulated / retreatTotal });
      bottom = top + 1;
    }
    result.structure.layers = layers;
    result.structure.distanceMetric =
      "bounded chamfer 3/4; first occupied center = 1 cell";
    const noise = (x: number, y: number, stream: number) => {
      const fx = (x - minX) / o.contourScale,
        fy = (y - minY) / o.contourScale,
        ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = fx - ix,
        ty = fy - iy;
      const smooth = (v: number) => v * v * (3 - 2 * v),
        sx = smooth(tx),
        sy = smooth(ty);
      return (
        (random(streamSeed(o,'contour'), stream, ix, iy) * (1 - sx) +
          random(streamSeed(o,'contour'), stream, ix + 1, iy) * sx) *
          (1 - sy) +
        (random(streamSeed(o,'contour'), stream, ix, iy + 1) * (1 - sx) +
          random(streamSeed(o,'contour'), stream, ix + 1, iy + 1) * sx) *
          sy
      );
    };
    for (const [k, col] of columns) {
      const [x, y] = k.split(",").map(Number),
        dist = (distance.get(k) ?? Infinity) / 3;
      if (dist > o.bandWidth) continue;
      const contour = 0.58 + 0.42 * noise(x, y, 7);
      let previous = 0;
      const protectedTop = col.reduce(
        (z, c) => (o.protectedKeys?.has(key(c)) ? Math.max(z, c.z) : z),
        -Infinity,
      );
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i],
          jitter = (noise(x, y, 8 + i) - 0.5) * o.layerVariation * 0.2;
        const retreat = Math.max(
          previous,
          Math.min(
            o.bandWidth,
            Math.round(o.bandWidth * (layer.retreat * contour + jitter)),
          ),
        );
        previous = retreat;
        if (dist > retreat) continue;
        for (const c of col)
          if (
            c.z >= layer.bottom &&
            c.z <= layer.top &&
            c.z >= minZ + o.minThickness
          ) {
            if (c.z <= protectedTop) protectedCandidates.add(key(c));
            else propose(c);
          }
      }
    }
  }
  result.diagnostics.requested = candidates.size + protectedCandidates.size;
  result.diagnostics.protected = protectedCandidates.size;
  if (o.preset === "columnar-wall")
    limitJointCuts(target, candidates, o.minThickness);
  if (
    candidates.size &&
    (!thickness(
      target,
      candidates,
      o.minThickness,
      o.preset === "columnar-wall" ? [0, 1] : [2],
    ) ||
      !connected(targetMap, candidates))
  )
    return reject(
      "Joint carving would violate minimum thickness or split an original component; no change applied.",
    );
  result.removedCellKeys = [...candidates].sort();
  result.cells = cells.filter((c) => !candidates.has(key(c)));
  result.diagnostics.applied = candidates.size;
  return result;
}
