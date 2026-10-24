import type {
  RockCell,
  RockOptions,
  RockSeedGroup,
  RockStructure,
} from "./rock-shaping.ts";

const key = (c: RockCell) => `${c.x},${c.y},${c.z}`;
const neighbors = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
function random(
  o: RockOptions,
  group: RockSeedGroup,
  stream: number,
  a: number,
  b = 0,
) {
  let n =
    (o.seed ^
      (o.randomSeeds?.[group] ?? 0) ^
      Math.imul(stream, 0x9e3779b9) ^
      Math.imul(a, 0x85ebca6b) ^
      Math.imul(b, 0xc2b2ae35)) >>>
    0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Restore only paths needed to keep each original owner component connected.
 * A zero/one shortest-path search prefers existing retained cells over restoring cuts.
 * Unlike a global rejection, this preserves unrelated valid sculpting candidates.
 */
function retainConnections(owner: Map<string, RockCell>, removed: Set<string>) {
  const seen = new Set<string>();
  for (const start of owner.keys()) {
    if (seen.has(start)) continue;
    const component = [start];
    seen.add(start);
    for (let i = 0; i < component.length; i++) {
      const c = owner.get(component[i])!;
      for (const [dx, dy, dz] of neighbors) {
        const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
        if (owner.has(k) && !seen.has(k)) {
          seen.add(k);
          component.push(k);
        }
      }
    }
    const root = component.find((k) => !removed.has(k));
    if (!root) {
      removed.delete(start);
      continue;
    }
    const connected = new Set([root]),
      queue = [root];
    for (let i = 0; i < queue.length; i++) {
      const c = owner.get(queue[i])!;
      for (const [dx, dy, dz] of neighbors) {
        const k = `${c.x + dx},${c.y + dy},${c.z + dz}`;
        if (owner.has(k) && !removed.has(k) && !connected.has(k)) {
          connected.add(k);
          queue.push(k);
        }
      }
    }
    if (connected.size === component.filter((k) => !removed.has(k)).length)
      continue;
    const distance = new Map<string, number>(),
      parent = new Map<string, string>();
    const buckets: string[][] = [Array.from(connected)];
    for (const k of connected) distance.set(k, 0);
    for (let cost = 0; cost < buckets.length; cost++) {
      const bucket = buckets[cost] ?? [];
      for (let i = 0; i < bucket.length; i++) {
        const k = bucket[i];
        if (distance.get(k) !== cost) continue;
        const c = owner.get(k)!;
        for (const [dx, dy, dz] of neighbors) {
          const next = `${c.x + dx},${c.y + dy},${c.z + dz}`;
          if (!owner.has(next)) continue;
          const value = cost + (removed.has(next) ? 1 : 0);
          if (value >= (distance.get(next) ?? Infinity)) continue;
          distance.set(next, value);
          parent.set(next, k);
          (buckets[value] ??= []).push(next);
        }
      }
    }
    const restored = new Set(connected);
    for (const k of component) {
      if (removed.has(k)) continue;
      let current: string | undefined = k;
      while (current && !restored.has(current)) {
        restored.add(current);
        removed.delete(current);
        current = parent.get(current);
      }
    }
  }
}

/** Local directional erosion: a selection is a write mask, never a synthetic solid.
 * Real owner occupancy supplies backing thickness; other owners remain ray barriers.
 * Each exposed solid interval can be shaped independently, including arch interiors.
 */
export function planLocalRock(
  cells: RockCell[],
  ownerCells: RockCell[],
  o: RockOptions,
) {
  const owner = new Map(ownerCells.map((c) => [key(c), c]));
  const region = ownerCells.filter(
    (c) => !o.scopeKeys || o.scopeKeys.has(key(c)),
  );
  const removed = new Set<string>(),
    protectedHits = new Set<string>();
  const structure: RockStructure = {
    layoutSeed: (o.seed ^ (o.randomSeeds?.layout ?? 0)) >>> 0,
  };
  if (!region.length)
    return { removed, protectedHits, structure, limited: 0, requested: 0 };
  const bounds = region.reduce(
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
  const height = bounds.maxZ - bounds.minZ + 1;
  const layers: NonNullable<RockStructure["layers"]> = [];
  if (o.preset === "terraced-rim") {
    const count = Math.min(o.layers, height),
      weights = Array.from(
        { length: count },
        (_, i) => 0.55 + random(o, "terraces", 6, i),
      );
    const total = weights.reduce((a, b) => a + b, 0);
    let bottom = bounds.minZ,
      sum = 0;
    const retreats = weights.map((_, i) =>
      i ? (0.5 + random(o, "terraces", 9, i)) * (i % 2 ? 0.65 : 1.55) : 0,
    );
    const retreatTotal = retreats.reduce((a, b) => a + b, 0) || 1;
    let retreat = 0;
    for (let i = 0; i < count; i++) {
      sum += weights[i];
      retreat += retreats[i];
      const top =
        i === count - 1
          ? bounds.maxZ
          : Math.min(
              bounds.maxZ - (count - i - 1),
              Math.max(
                bottom,
                bounds.minZ + Math.round((height * sum) / total) - 1,
              ),
            );
      layers.push({ bottom, top, retreat: retreat / retreatTotal });
      bottom = top + 1;
    }
    structure.layers = layers;
    structure.distanceMetric =
      "local exposed-side depth; strict selection mask";
  }
  const rays: RockCell[][] = [];
  for (const side of o.sides ?? []) {
    const axis = side < 2 ? "x" : "y",
      other = side < 2 ? "y" : "x",
      positive = side === 0 || side === 2;
    const low = other === "x" ? bounds.minX : bounds.minY,
      high = other === "x" ? bounds.maxX : bounds.maxY;
    const field: NonNullable<RockStructure["columnBands"]> = [];
    for (let start = 0, i = 0; start <= high - low; i++) {
      const width = Math.round(
        o.minWidth +
          (o.maxWidth - o.minWidth) *
            (0.5 +
              (random(o, "layout", 1, i, side) - 0.5) * (1 - o.regularity)),
      );
      const end = start + Math.max(1, width);
      field.push({
        start,
        end,
        depth: 0.15 + 0.8 * random(o, "layout", 2, i, side),
        breakHeight:
          bounds.minZ +
          Math.round(
            o.continuity * (0.8 + 0.4 * random(o, "breaks", 3, i, side)),
          ),
        breakDelta: (random(o, "breaks", 4, i, side) - 0.5) * o.breakStrength,
      });
      start = end;
    }
    const bandAt = (u: number) => {
      let lo = 0,
        hi = field.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (u >= field[mid].end) lo = mid + 1;
        else hi = mid;
      }
      return field[lo];
    };
    if (o.preset === "columnar-wall" && !structure.columnBands)
      structure.columnBands = field;
    const rows = new Map<string, RockCell[]>();
    for (const c of cells) {
      if (
        c[other] < low ||
        c[other] > high ||
        c.z < bounds.minZ ||
        c.z > bounds.maxZ
      )
        continue;
      const k = `${c[other]},${c.z}`,
        row = rows.get(k) ?? [];
      row.push(c);
      rows.set(k, row);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => (positive ? b[axis] - a[axis] : a[axis] - b[axis]));
      for (let begin = 0; begin < row.length; ) {
        let end = begin + 1;
        while (
          end < row.length &&
          Math.abs(row[end][axis] - row[end - 1][axis]) === 1
        )
          end++;
        const first = row[begin];
        if (!owner.has(key(first))) break; // Another owner blocks everything behind it on this ray.
        if (o.scopeKeys && !o.scopeKeys.has(key(first))) {
          begin = end;
          continue;
        }
        const interval: RockCell[] = [];
        for (let i = begin; i < end && owner.has(key(row[i])); i++)
          interval.push(row[i]);
        const u = first[other] - low;
        let depth = 0;
        if (o.preset === "columnar-wall") {
          const band = bandAt(u);
          const base =
            band.depth + (first.z >= band.breakHeight ? band.breakDelta : 0);
          depth = Math.round(o.maxDepth * Math.max(0, Math.min(1, base)));
          if (
            random(
              o,
              "chips",
              5,
              Math.floor(u / 2),
              Math.floor((first.z - bounds.minZ) / 2),
            ) <
            o.chips * 0.08
          )
            depth++;
          depth = Math.min(o.maxDepth, depth);
        } else {
          const i = layers.findIndex((l) => first.z <= l.top),
            layer = layers[i];
          const fx = u / o.contourScale,
            ix = Math.floor(fx),
            t = fx - ix,
            s = t * t * (3 - 2 * t);
          const noise = (stream: number) =>
            random(o, "contour", stream, ix, side) * (1 - s) +
            random(o, "contour", stream, ix + 1, side) * s;
          const retreat = Math.max(
            0,
            Math.min(
              1,
              layer.retreat * (0.65 + 0.35 * noise(7)) +
                (noise(8 + i) - 0.5) * o.layerVariation * 0.2,
            ),
          );
          depth = Math.round(o.bandWidth * retreat);
        }
        depth = Math.min(depth, Math.max(0, interval.length - o.minThickness));
        let proposed = false;
        for (let i = 0; i < depth; i++) {
          const c = interval[i],
            k = key(c);
          if (o.scopeKeys && !o.scopeKeys.has(k)) break;
          if (o.protectedKeys?.has(k)) {
            protectedHits.add(k);
            break;
          }
          removed.add(k);
          proposed = true;
        }
        if (proposed) rays.push(interval);
        begin = end;
      }
    }
  }
  const requested = removed.size + protectedHits.size,
    before = removed.size;
  // Opposing and perpendicular cuts share the same candidates. Restore backing
  // only on rays that actually proposed cuts, without applying cross-axis thin-feature bans.
  for (const ray of rays) {
    let need = o.minThickness - ray.filter((c) => !removed.has(key(c))).length;
    for (let i = ray.length - 1; i >= 0 && need > 0; i--)
      if (removed.delete(key(ray[i]))) need--;
  }
  retainConnections(owner, removed);
  return {
    removed,
    protectedHits,
    structure,
    requested,
    limited: before - removed.size,
  };
}
