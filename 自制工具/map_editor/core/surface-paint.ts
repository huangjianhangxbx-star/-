import { composeLayers, mapPaintLayers, paintSize, editLayer, layerSource, type PaintLayer } from './paint-layers.ts';
/** Native opaque texels at 64 pixels/metre. Face axes are ascending nonnormal axes. */
export type SurfacePaint = {
  schema: "xinghai-surface-paint-1";
  density: 64;
  faces: Record<string, Record<string, string>>;
  layers?: PaintLayer[];
};
export const MAX_PAINT_PIXELS = 262144,
  MAX_PAINT_FACES = 16384;
export function paintResolution(step: number) {
  if (![0.25, 0.125, 0.0625].includes(step)) throw Error("绘画精度无效");
  return step * 64;
}
export function paintFaceKey(x: number, y: number, z: number, face: number) {
  const key = [x, y, z, face].join(",");
  parsePaintFaceKey(key);
  return key;
}
export function parsePaintFaceKey(
  key: string,
): [number, number, number, number] {
  if (!/^-?(?:0|[1-9]\d*),-?(?:0|[1-9]\d*),-?(?:0|[1-9]\d*),[0-5]$/.test(key))
    throw Error("绘画面键无效");
  const p = key.split(",").map(Number);
  if (
    p.some(
      (n, i) => !Number.isSafeInteger(n) || (i < 3 && Math.abs(n) > 32768),
    ) ||
    p.join(",") !== key
  )
    throw Error("绘画面坐标无效");
  return p as [number, number, number, number];
}
function record(v: unknown): asserts v is Record<string, unknown> {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(v))
  )
    throw Error("绘画源必须是普通对象");
}
export function validateSurfacePaint(
  value: unknown,
  step: number,
): SurfacePaint {
  record(value);
  if (
    Object.keys(value).some(
      (k) => !["schema", "density", "faces", "layers"].includes(k),
    ) ||
    value.schema !== "xinghai-surface-paint-1" ||
    value.density !== 64
  )
    throw Error("绘画源版本无效");
  record(value.faces);
  const n = paintResolution(step);
  let count = 0;
  const keys = Object.keys(value.faces);
  if (keys.length > MAX_PAINT_FACES) throw Error("绘画面预算超限");
  for (const key of keys) {
    parsePaintFaceKey(key);
    const pixels = value.faces[key];
    record(pixels);
    for (const [index, color] of Object.entries(pixels)) {
      if (
        !/^(0|[1-9]\d*)$/.test(index) ||
        !Number.isSafeInteger(Number(index)) ||
        Number(index) >= n * n ||
        typeof color !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(color)
      )
        throw Error("绘画像素无效");
      if (++count > MAX_PAINT_PIXELS) throw Error("绘画像素预算超限");
    }
  }
  if(value.layers!==undefined){
    if(!Array.isArray(value.layers)||value.layers.length<1||value.layers.length>32)throw Error('图层数量无效');
    const ids=new Set<string>();
    for(const layer of value.layers){
      record(layer);
      if(Object.keys(layer).some(k=>!['id','name','visible','locked','faces'].includes(k))||typeof layer.id!=='string'||!/^[\w-]{1,100}$/.test(layer.id)||ids.has(layer.id)||typeof layer.name!=='string'||!layer.name.trim()||layer.name.length>80||typeof layer.visible!=='boolean'||typeof layer.locked!=='boolean')throw Error('绘图图层无效');
      ids.add(layer.id);validateSurfacePaint({schema:value.schema,density:64,faces:layer.faces},step);
    }
    const composed=composeLayers(value.layers as PaintLayer[]).faces,faces=value.faces as SurfacePaint['faces'];
    if(Object.keys(composed).length!==Object.keys(faces).length||Object.keys(composed).some(k=>Object.keys(composed[k]).length!==Object.keys(faces[k]??{}).length||Object.keys(composed[k]).some(i=>composed[k][i]!==faces[k]?.[i])))throw Error('图层合成结果不一致');
    const size=paintSize(value as SurfacePaint);if(size.faces>MAX_PAINT_FACES||size.pixels>MAX_PAINT_PIXELS)throw Error('图层原稿预算超限');
  }
  return value as SurfacePaint;
}
export function paintPixels(
  paint: SurfacePaint | undefined,
  hits: { key: string; index: number }[],
  color: string | null,
  step: number,
): SurfacePaint {
  if (paint) validateSurfacePaint(paint, step);
  if(paint?.layers){const layer=[...paint.layers].reverse().find(l=>l.visible&&!l.locked);if(!layer)throw Error("没有可绘制图层");return editLayer(paint,layer.id,paintPixels(layerSource(paint,layer.id),hits,color,step));}
  if (color !== null && !/^#[0-9a-fA-F]{6}$/.test(color))
    throw Error("绘画颜色无效");
  const next: SurfacePaint = paint
    ? structuredClone(paint)
    : { schema: "xinghai-surface-paint-1", density: 64, faces: {} };
  const n = paintResolution(step);
  for (const { key, index } of hits) {
    parsePaintFaceKey(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= n * n)
      throw Error("绘画像素位置无效");
    if (color !== null) (next.faces[key] ??= {})[index] = color.toLowerCase();
    else if (next.faces[key]) {
      delete next.faces[key][index];
      if (!Object.keys(next.faces[key]).length) delete next.faces[key];
    }
  }
  return validateSurfacePaint(next, step);
}
export function sampleFace(
  paint: SurfacePaint | undefined,
  key: string,
  index: number,
  baseColor: string,
) {
  return paint?.faces[key]?.[index] ?? baseColor;
}
export function filterPaint(
  paint: SurfacePaint | undefined,
  keys: Set<string>,
): SurfacePaint | undefined {
  if (!paint) return;
  if(paint.layers)return mapPaintLayers(paint,p=>filterPaint(p,keys)!);
  return {
    ...paint,
    faces: Object.fromEntries(
      Object.entries(paint.faces).filter(([k]) =>
        keys.has(k.split(",").slice(0, 3).join(",")),
      ),
    ),
  };
}
/** Transform selected owner faces and exact texel centers. Clear destination faces on overwrite. */
export function remapPaint(
  paint: SurfacePaint | undefined,
  mapping: Map<string, string>,
  step: number,
  axis?: number,
  turns = 0,
): SurfacePaint | undefined {
  if (!paint) return;
  if(paint.layers)return mapPaintLayers(paint,p=>remapPaint(p,mapping,step,axis,turns)!);
  const faces: SurfacePaint["faces"] = {},
    dest = new Set(mapping.values()),
    n = paintResolution(step);
  const rotate = (v: number[]) => {
    v = [...v];
    if (axis !== undefined)
      for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
        const a = (axis + 1) % 3,
          b = (axis + 2) % 3,
          old = v[a];
        v[a] = -v[b];
        v[b] = old;
      }
    return v;
  };
  for (const [key, pixels] of Object.entries(paint.faces)) {
    const p = parsePaintFaceKey(key),
      owner = p.slice(0, 3).join(","),
      target = mapping.get(owner);
    if (!target) {
      if (!dest.has(owner)) faces[key] = structuredClone(pixels);
      continue;
    }
    const normal = [0, 0, 0],
      oldAxis = Math.floor(p[3] / 2);
    normal[oldAxis] = p[3] % 2 === 0 ? 1 : -1;
    const r = rotate(normal),
      newAxis = r.findIndex((v) => v !== 0),
      face = newAxis * 2 + (r[newAxis] < 0 ? 1 : 0),
      oldUV = [0, 1, 2].filter((a) => a !== oldAxis),
      newUV = [0, 1, 2].filter((a) => a !== newAxis),
      out: Record<string, string> = {};
    for (const [index, color] of Object.entries(pixels)) {
      const uv = [Number(index) % n, Math.floor(Number(index) / n)],
        v = [0, 0, 0];
      v[oldUV[0]] = (uv[0] + 0.5) / n - 0.5;
      v[oldUV[1]] = (uv[1] + 0.5) / n - 0.5;
      const q = rotate(v),
        u = Math.round((q[newUV[0]] + 0.5) * n - 0.5),
        w = Math.round((q[newUV[1]] + 0.5) * n - 0.5);
      out[w * n + u] = color;
    }
    faces[target + "," + face] = out;
  }
  return { ...paint, faces };
}
export function hasSurfacePaint(value: {
  paintSource?: SurfacePaint;
  canvases?: { paintSource?: SurfacePaint }[];
}) {
  return (
    paintSize(value.paintSource).pixels > 0 ||
    value.canvases?.some(
      (c) => paintSize(c.paintSource).pixels > 0,
    ) === true
  );
}
