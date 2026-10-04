import { meshMap } from "./mesher.ts";
import { validateMap } from "./document.ts";
import { paletteFromMap, srgbToLinear } from "./palette.ts";
import { assetToMap, validateNativeAsset } from "./native-asset.ts";
function build(doc: any, anchor: number[], identity: string): Uint8Array {
  validateMap(doc);
  const profile = paletteFromMap(doc),
    quads = meshMap(doc);
  if (!quads.length) throw Error("Empty geometry cannot be exported");
  const groups = new Map<string, any>();
  const convert = (p: number[]) => [p[0], p[2], -p[1]];
  for (const q of quads) {
    const k = q.chunk + "|" + q.color;
    let g = groups.get(k);
    if (!g) {
      g = { chunk: q.chunk, color: q.color, positions: [], normals: [] };
      groups.set(k, g);
    }
    const axes = [0, 1, 2].filter((a) => a !== q.axis);
    let corners = [
      [q.a, q.b],
      [q.a + q.w, q.b],
      [q.a + q.w, q.b + q.h],
      [q.a, q.b + q.h],
    ].map((ab) => {
      const p = [0, 0, 0];
      p[q.axis] = q.plane;
      p[axes[0]] = ab[0];
      p[axes[1]] = ab[1];
      return convert(p.map((v, i) => v * doc.voxelSize - anchor[i]));
    });
    const n = [0, 0, 0];
    n[q.axis] = q.sign;
    const normal = convert(n);
    const order =
      q.sign === (q.axis === 1 ? -1 : 1)
        ? [0, 1, 2, 0, 2, 3]
        : [0, 2, 1, 0, 3, 2];
    for (const i of order) {
      g.positions.push(...corners[i]);
      g.normals.push(...normal);
    }
  }
  const binary: number[] = [],
    bufferViews: any[] = [],
    accessors: any[] = [];
  function accessor(values: number[], position: boolean) {
    const raw = new Uint8Array(new Float32Array(values).buffer),
      offset = binary.length;
    for (const b of raw) binary.push(b);
    const bv =
      bufferViews.push({
        buffer: 0,
        byteOffset: offset,
        byteLength: raw.length,
        target: 34962,
      }) - 1;
    const a: any = {
      bufferView: bv,
      componentType: 5126,
      count: values.length / 3,
      type: "VEC3",
    };
    if (position) {
      a.min = [Infinity, Infinity, Infinity];
      a.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < values.length; i++) {
        a.min[i % 3] = Math.min(a.min[i % 3], values[i]);
        a.max[i % 3] = Math.max(a.max[i % 3], values[i]);
      }
    }
    return accessors.push(a) - 1;
  }
  const chunks = new Map<string, any[]>();
  for (const g of groups.values()) {
    if (!chunks.has(g.chunk)) chunks.set(g.chunk, []);
    chunks
      .get(g.chunk)!
      .push({
        attributes: {
          POSITION: accessor(g.positions, true),
          NORMAL: accessor(g.normals, false),
        },
        material: g.color,
        mode: 4,
      });
  }
  const materials = profile.colors.map((c: any) => ({
    name: c.colorId,
    pbrMetallicRoughness: {
      baseColorFactor: [...c.baseColor_sRGB.map(srgbToLinear), c.alpha],
      roughnessFactor: c.roughness,
      metallicFactor: c.metallic,
    },
    emissiveFactor: c.emissive.map(
      (v: number) => v * Math.min(1, c.emissiveStrength),
    ),
    ...(c.emissiveStrength > 1
      ? {
          extensions: {
            KHR_materials_emissive_strength: {
              emissiveStrength: c.emissiveStrength,
            },
          },
        }
      : {}),
    alphaMode: c.alphaMode,
    doubleSided: c.doubleSided,
    extras: { colorId: c.colorId, paletteId: profile.paletteId },
  }));
  const meshes = [...chunks].map(([chunk, primitives]) => ({
    name: `${identity}:chunk:${chunk}`,
    primitives,
  }));
  const j: any = {
    asset: { version: "2.0", generator: "Xinghai Map Workshop" },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((m, i) => ({ name: m.name, mesh: i })),
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binary.length }],
    extras: { sourceAxes: "RH_Z_UP", unit: "meters", profile, identity },
  };
  if (profile.colors.some((c: any) => c.emissiveStrength > 1))
    j.extensionsUsed = ["KHR_materials_emissive_strength"];
  const text = new TextEncoder().encode(JSON.stringify(j));
  const jsonLength = Math.ceil(text.length / 4) * 4,
    binLength = Math.ceil(binary.length / 4) * 4,
    raw = new Uint8Array(28 + jsonLength + binLength);
  const v = new DataView(raw.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, raw.length, true);
  v.setUint32(12, jsonLength, true);
  v.setUint32(16, 0x4e4f534a, true);
  raw.fill(32, 20, 20 + jsonLength);
  raw.set(text, 20);
  v.setUint32(20 + jsonLength, binLength, true);
  v.setUint32(24 + jsonLength, 0x004e4942, true);
  raw.set(binary, 28 + jsonLength);
  return raw;
}
export function exportMapGlb(doc: any): Uint8Array {
  return build(doc, [0, 0, 0], doc.mapId);
}
export function exportNativeAssetGlb(asset: any): Uint8Array {
  const a = validateNativeAsset(asset);
  return build(assetToMap(a), a.anchor, a.assetId);
}
