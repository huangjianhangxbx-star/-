/** Source-space face coordinates are planes, not the owning cell coordinate. */
export const faceOffsets: readonly [number, number, number][] = [
  [-1, 0, 0], [0, 0, 0], [0, -1, 0], [0, 0, 0],
  [0, 0, -1], [0, 0, 0],
];
export const faceNormals: readonly [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];
const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function resolveFace(
  cells: Map<string, any>, x: number, y: number, z: number, face: number,
): { cell: any; x: number; y: number; z: number; face: number } | null {
  if (![x, y, z, face].every(Number.isInteger) || face < 0 || face > 5) return null;
  const offset = faceOffsets[face], normal = faceNormals[face];
  const cx = x + offset[0], cy = y + offset[1], cz = z + offset[2];
  const cell = cells.get(cellKey(cx, cy, cz));
  if (!cell || cells.has(cellKey(cx + normal[0], cy + normal[1], cz + normal[2]))) return null;
  return { cell, x, y, z, face };
}

/** Visible connected top faces, including different palette colors. */
export function connectedTop(cells: any[], x: number, y: number, top: number): any[] {
  const byKey = new Map(cells.map((c) => [cellKey(c.x, c.y, c.z), c]));
  const result: any[] = [], seen = new Set<string>(), queue: [number, number][] = [[x, y]];
  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i], k = `${cx},${cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const face = resolveFace(byKey, cx, cy, top, 4);
    if (!face) continue;
    result.push(face.cell);
    queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return result;
}

export function supportsHorizontalPlacement(cells: Map<string, any>, x: number, y: number, z: number): boolean {
  const gx = x / 0.25, gy = y / 0.25, top = z / 0.25;
  if (![gx, gy, top].every(Number.isFinite) || !Number.isInteger(top)) return false;
  return !!resolveFace(cells, Math.floor(gx), Math.floor(gy), top, 4);
}

/** A decal may not float across a gap or overlap a higher block. */
export function supportsDecalFootprint(cells: Map<string, any>, p: any): boolean {
  if (![p.x, p.y, p.z, p.width, p.height, p.rotation].every(Number.isFinite) ||
      p.width <= 0 || p.height <= 0 || p.width > 256 || p.height > 256 ||
      !Number.isInteger(p.rotation) || p.rotation % 90 !== 0) return false;
  const quarterTurn = ((p.rotation / 90) % 2 + 2) % 2;
  const width = quarterTurn ? p.height : p.width;
  const height = quarterTurn ? p.width : p.height;
  const voxel = 0.25, eps = 1e-8;
  const x0 = Math.floor((p.x - width / 2 + eps) / voxel);
  const x1 = Math.floor((p.x + width / 2 - eps) / voxel);
  const y0 = Math.floor((p.y - height / 2 + eps) / voxel);
  const y1 = Math.floor((p.y + height / 2 - eps) / voxel);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 65536) return false;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
    if (!supportsHorizontalPlacement(cells, (x + 0.5) * voxel, (y + 0.5) * voxel, p.z)) return false;
  return true;
}

/** Voxel DDA against the current document, independent of delayed merged meshes. */
export function pickSurface(
  cells: Map<string, any>, origin: number[], direction: number[], sectionTop: number | null = null,
  bounds?: { min: number[]; max: number[] },
): { cell: any; x: number; y: number; z: number; face: number } | null {
  if (!cells.size) return null;
  const min = bounds?.min ?? [Infinity, Infinity, Infinity], max = bounds?.max ?? [-Infinity, -Infinity, -Infinity];
  if (!bounds) for (const c of cells.values()) for (let a = 0; a < 3; a++) {
    const v = [c.x, c.y, c.z][a];
    min[a] = Math.min(min[a], v); max[a] = Math.max(max[a], v + 1);
  }
  let enter = -Infinity, leave = Infinity, firstAxis = -1;
  for (let a = 0; a < 3; a++) {
    const d = direction[a];
    if (Math.abs(d) < 1e-12) {
      if (origin[a] < min[a] || origin[a] >= max[a]) return null;
      continue;
    }
    const t1 = (min[a] - origin[a]) / d, t2 = (max[a] - origin[a]) / d;
    const near = Math.min(t1, t2), far = Math.max(t1, t2);
    if (near > enter) { enter = near; firstAxis = a; }
    leave = Math.min(leave, far);
  }
  if (leave < Math.max(enter, 0)) return null;
  const t = Math.max(enter, 0), epsilon = 1e-7;
  const pos = origin.map((v, a) => Math.floor(v + (t + epsilon) * direction[a]));
  const step = direction.map((v) => Math.sign(v));
  const next = pos.map((v, a) => step[a] === 0 ? Infinity : ((step[a] > 0 ? v + 1 : v) - origin[a]) / direction[a]);
  const delta = direction.map((v) => v === 0 ? Infinity : Math.abs(1 / v));
  let axis = firstAxis;
  const budget = Math.min(100000, max.reduce((n, v, a) => n + (v - min[a]), 0) + 6);
  for (let i = 0; i < budget; i++) {
    const [x, y, z] = pos;
    if (x < min[0] || x >= max[0] || y < min[1] || y >= max[1] || z < min[2] || z >= max[2]) return null;
    const c = cells.get(cellKey(x, y, z));
    if (c && (sectionTop == null || z + 1 <= sectionTop) && axis >= 0) {
      const face = axis * 2 + (step[axis] > 0 ? 1 : 0);
      const px = x + (face === 0 ? 1 : 0), py = y + (face === 2 ? 1 : 0), pz = z + (face === 4 ? 1 : 0);
      if (resolveFace(cells, px, py, pz, face)) return { cell: c, x: px, y: py, z: pz, face };
    }
    axis = next.indexOf(Math.min(...next));
    if (next[axis] > leave + epsilon) return null;
    pos[axis] += step[axis];
    next[axis] += delta[axis];
  }
  return null;
}

export function visibleTopLabels(cells: any[], sectionTop: number | null = null) {
  const occupied = new Set(cells.filter((c) => sectionTop == null || c.z + 1 <= sectionTop)
    .map((c) => cellKey(c.x, c.y, c.z)));
  const byColumn = new Map<string, { x: number; y: number; top: number; layer: number }>();
  for (const c of cells) {
    const top = c.z + 1;
    if ((sectionTop != null && top > sectionTop) || occupied.has(cellKey(c.x, c.y, top))) continue;
    const k = `${c.x},${c.y}`, old = byColumn.get(k);
    if (!old || top > old.top) byColumn.set(k, { x: c.x, y: c.y, top, layer: c.z });
  }
  return [...byColumn.values()].sort((a, b) => a.x - b.x || a.y - b.y);
}
