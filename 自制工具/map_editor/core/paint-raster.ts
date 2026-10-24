export type UV = [number, number];
const limit = (n: number) => {
  if (!Number.isSafeInteger(n) || n > 262144) throw Error("图形超过像素预算");
};
export function rasterLine(a: UV, b: UV): UV[] {
  if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]))
    return rasterLine(b, a).reverse();
  const out: UV[] = [];
  let [x, y] = a;
  const dx = Math.abs(b[0] - x),
    dy = -Math.abs(b[1] - y),
    sx = x < b[0] ? 1 : -1,
    sy = y < b[1] ? 1 : -1;
  limit(Math.max(dx, -dy) + 1);
  let err = dx + dy;
  while (true) {
    out.push([x, y]);
    if (x === b[0] && y === b[1]) break;
    const e = 2 * err;
    if (e >= dy) {
      err += dy;
      x += sx;
    }
    if (e <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
export function rasterBrush(p: UV, size: number, shape: string): UV[] {
  if (!Number.isInteger(size) || size < 1 || size > 32)
    throw Error("笔刷大小1至32px");
  const out: UV[] = [],
    lo = -Math.floor((size - 1) / 2),
    centre = size % 2 ? 0 : 0.5;
  for (let y = lo; y < lo + size; y++)
    for (let x = lo; x < lo + size; x++)
      if (
        shape !== "circle" ||
        (x - centre) ** 2 + (y - centre) ** 2 <= (size / 2) ** 2
      )
        out.push([p[0] + x, p[1] + y]);
  return out;
}
export function rasterShape(
  kind: string,
  a: UV,
  b: UV,
  width: number,
  fill: boolean,
): UV[] {
  const left = Math.min(a[0], b[0]),
    right = Math.max(a[0], b[0]),
    bottom = Math.min(a[1], b[1]),
    top = Math.max(a[1], b[1]),
    out: UV[] = [];
  limit((right - left + 1) * (top - bottom + 1));
  const rx = (right - left + 1) / 2,
    ry = (top - bottom + 1) / 2,
    cx = (left + right) / 2,
    cy = (bottom + top) / 2;
  for (let y = bottom; y <= top; y++)
    for (let x = left; x <= right; x++) {
      if (kind === "rectangle") {
        if (
          fill ||
          x - left < width ||
          right - x < width ||
          y - bottom < width ||
          top - y < width
        )
          out.push([x, y]);
      } else {
        const e = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2,
          inner =
            rx > width && ry > width
              ? ((x - cx) / (rx - width)) ** 2 + ((y - cy) / (ry - width)) ** 2
              : Infinity;
        if (e <= 1 && (fill || inner >= 1)) out.push([x, y]);
      }
    }
  return out;
}
export function perfectPath(points: UV[]): UV[] {
  points = points.filter(
    (p, i) => !i || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1],
  );
  const counts = new Map<string, number>();
  for (const p of points)
    counts.set(p.join(","), (counts.get(p.join(",")) ?? 0) + 1);
  const out: UV[] = [];
  for (const p of points) {
    if (out.length && out.at(-1)![0] === p[0] && out.at(-1)![1] === p[1])
      continue;
    out.push(p);
    const n = out.length;
    if (n < 3) continue;
    const [a, b, c] = out.slice(-3);
    const ax = b[0] - a[0],
      ay = b[1] - a[1],
      bx = c[0] - b[0],
      by = c[1] - b[1];
    const before = out[n - 4];
    if (
      (counts.get(b.join(",")) ?? 0) === 1 &&
      Math.abs(ax) + Math.abs(ay) === 1 &&
      Math.abs(bx) + Math.abs(by) === 1 &&
      ax * bx + ay * by === 0 &&
      (!before || b[0] - before[0] !== 2 * ax || b[1] - before[1] !== 2 * ay) &&
      !out.slice(0, -3).some((v) => v[0] === b[0] && v[1] === b[1])
    )
      out.splice(-2, 1);
  }
  return out;
}
export function constrain(a: UV, b: UV, square = false): UV {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  if (square) {
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    return [a[0] + Math.sign(dx || 1) * m, a[1] + Math.sign(dy || 1) * m];
  }
  const angle = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4,
    r = Math.hypot(dx, dy);
  return [
    a[0] + Math.round(Math.cos(angle) * r),
    a[1] + Math.round(Math.sin(angle) * r),
  ];
}

export function rasterStroke(path: UV[], size: number, shape: string): UV[] {
  if (path.length * (2 * size + 1) + size * size > 262144)
    throw Error("笔画超过像素预算");
  const out = new Map<string, UV>();
  for (const p of path)
    for (const uv of rasterBrush(p, size, shape)) {
      out.set(uv.join(","), uv);
      if (out.size > 262144) throw Error("笔画超过像素预算");
    }
  return [...out.values()];
}
