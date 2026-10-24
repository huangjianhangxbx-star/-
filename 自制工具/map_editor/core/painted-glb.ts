import {appearanceColor} from './appearance-color.ts';
import type { Quad } from "./mesher.ts";

/** Paint uses owner-cell keys and positive ascending source axes, including negative faces. */
export type ExportPaint = {
  schema: "xinghai-surface-paint-1";
  density: 64;
  faces: Record<string, Record<string, string>>;
};
export type PaintedQuad = Quad & { paintPage?: number; uv?: number[][] };
type Tile = { q: Quad; pixels: Record<string, string> };
function subtract(q: Quad, a: number, b: number): Quad[] {
  const out: Quad[] = [];
  const put = (x: number, y: number, w: number, h: number) => {
    if (w && h) out.push({ ...q, a: x, b: y, w, h });
  };
  put(q.a, q.b, q.w, b - q.b);
  put(q.a, b + 1, q.w, q.b + q.h - b - 1);
  put(q.a, b, a - q.a, 1);
  put(a + 1, b, q.a + q.w - a - 1, 1);
  return out;
}
/** Preserve greedy rectangles except the exact painted visible unit faces. Occluded source is retained natively. */
export function paintedGeometry(
  quads: Quad[],
  paint: ExportPaint | undefined,
  step: number,
  colors: { baseColor_sRGB: number[] }[],
): { quads: PaintedQuad[]; images: Uint8Array[] } {
  if (!paint || !Object.keys(paint.faces).length) return { quads, images: [] };
  const cuts = new Map<
    string,
    { a: number; b: number; pixels: Record<string, string> }[]
  >();
  for (const [key, pixels] of Object.entries(paint.faces)) {
    if (!Object.keys(pixels).length) continue;
    const p = key.split(",").map(Number),
      face = p.pop()!,
      axis = Math.floor(face / 2),
      sign = face % 2 ? -1 : 1,
      axes = [0, 1, 2].filter((a) => a !== axis);
    const chunk = p.map((v) => Math.floor(v / 16)).join(","),
      k = [chunk, axis, sign, p[axis] + (sign === 1 ? 1 : 0)].join("|");
    if (!cuts.has(k)) cuts.set(k, []);
    cuts.get(k)!.push({ a: p[axes[0]], b: p[axes[1]], pixels });
  }
  const out: PaintedQuad[] = [],
    tiles: Tile[] = [];
  for (const q of quads) {
    const entries = cuts.get([q.chunk, q.axis, q.sign, q.plane].join("|"));
    if (!entries) {
      out.push(q);
      continue;
    }
    let rest = [q];
    for (const c of entries) {
      if (c.a < q.a || c.a >= q.a + q.w || c.b < q.b || c.b >= q.b + q.h)
        continue;
      tiles.push({ q: { ...q, a: c.a, b: c.b, w: 1, h: 1 }, pixels: c.pixels });
      rest = rest.flatMap((r) =>
        c.a >= r.a && c.a < r.a + r.w && c.b >= r.b && c.b < r.b + r.h
          ? subtract(r, c.a, c.b)
          : [r],
      );
    }
    out.push(...rest);
  }
  if (!tiles.length) return { quads, images: [] };
  const n = step * 64,
    tile = n + 2,
    columns = Math.floor(1024 / tile),
    capacity = columns * columns,
    images: Uint8Array[] = [];
  if (tiles.length > 16384 || Math.ceil(tiles.length / capacity) > 8)
    throw Error("绘制贴图导出超出图集预算");
  for (let first = 0; first < tiles.length; first += capacity) {
    const batch = tiles.slice(first, first + capacity),
      cols = Math.min(columns, batch.length),
      rows = Math.ceil(batch.length / cols),
      w = cols * tile,
      h = rows * tile,
      rgba = new Uint8Array(w * h * 4),
      page = images.length;
    for (let i = 0; i < batch.length; i++) {
      const { q, pixels } = batch[i],
        x = (i % cols) * tile,
        y = Math.floor(i / cols) * tile,
        base = '#'+colors[q.color].baseColor_sRGB.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
      for (let v = -1; v <= n; v++)
        for (let u = -1; u <= n; u++) {
          const cu = Math.max(0, Math.min(n - 1, u)),
            cv = Math.max(0, Math.min(n - 1, v)),
            hex = pixels[String(cv * n + cu)];
          const composed=appearanceColor(base,hex,{gain:q.gain??1,affectPaint:q.affectPaint??false}),rgb=[1,3,5].map(i=>parseInt(composed.slice(i,i+2),16));
          rgba.set([...rgb, 255], ((y + v + 1) * w + x + u + 1) * 4);
        }
      out.push({
        ...q,
        paintPage: page,
        uv: [
          [x + 1, y + 1],
          [x + n + 1, y + 1],
          [x + n + 1, y + n + 1],
          [x + 1, y + n + 1],
        ].map(([u, v]) => [u / w, v / h]),
      });
    }
    images.push(encodeOpaquePng(w, h, rgba));
  }
  return { quads: out, images };
}
const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length + 12),
    v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  let crc = 0xffffffff;
  for (let i = 4; i < out.length - 4; i++)
    crc = crcTable[(crc ^ out[i]) & 255] ^ (crc >>> 8);
  v.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
  return out;
}
/** Portable PNG encoder: bounded RGBA rows, zlib stored blocks, CRC32 and Adler32; no Node/browser API dependency. */
export function encodeOpaquePng(
  width: number,
  height: number,
  rgba: Uint8Array,
): Uint8Array {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    rgba.length !== width * height * 4
  )
    throw Error("Invalid bounded paint image");
  const row = width * 4,
    scan = new Uint8Array((row + 1) * height);
  for (let y = 0; y < height; y++)
    scan.set(rgba.subarray(y * row, (y + 1) * row), y * (row + 1) + 1);
  const z = new Uint8Array(
    2 + scan.length + Math.ceil(scan.length / 65535) * 5 + 4,
  );
  z.set([0x78, 0x01]);
  let off = 2,
    a = 1,
    b = 0;
  for (let p = 0; p < scan.length; p += 65535) {
    const n = Math.min(65535, scan.length - p);
    z[off++] = p + n === scan.length ? 1 : 0;
    z[off++] = n & 255;
    z[off++] = n >>> 8;
    z[off++] = ~n & 255;
    z[off++] = (~n >>> 8) & 255;
    z.set(scan.subarray(p, p + n), off);
    off += n;
  }
  for (const c of scan) {
    a = (a + c) % 65521;
    b = (b + a) % 65521;
  }
  new DataView(z.buffer).setUint32(off, ((b << 16) | a) >>> 0);
  const ihdr = new Uint8Array(13),
    iv = new DataView(ihdr.buffer);
  iv.setUint32(0, width);
  iv.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", z),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
