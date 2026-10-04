import { validateMap } from "./document.ts";
import { exportMapGlb } from "./glb.ts";
function decode(raw: Uint8Array) {
  const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (
    raw.length < 28 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== raw.length ||
    v.getUint32(16, true) !== 0x4e4f534a
  )
    throw Error("Invalid GLB");
  const n = v.getUint32(12, true);
  if (n % 4 || n + 28 > raw.length || v.getUint32(n + 24, true) !== 0x004e4942)
    throw Error("GLB requires embedded binary");
  const json = JSON.parse(new TextDecoder().decode(raw.slice(20, 20 + n)));
  const bin = raw.slice(28 + n, 28 + n + v.getUint32(20 + n, true));
  if (
    json.buffers?.length !== 1 ||
    json.buffers[0].uri ||
    json.buffers[0].byteLength > bin.length ||
    json.skins?.length ||
    json.animations?.length
  )
    throw Error("Only static self-contained GLB supported");
  const allowed = [
    "KHR_materials_emissive_strength",
    "KHR_materials_unlit",
    "KHR_texture_transform",
  ];
  if ((json.extensionsUsed ?? []).some((x: string) => !allowed.includes(x)))
    throw Error("Unsupported GLB extension");
  if ((json.images ?? []).some((x: any) => x.uri && !x.uri.startsWith("data:")))
    throw Error("External GLB image dependencies must be embedded");
  return { json, bin };
}
function encode(j: any, parts: Uint8Array[]) {
  const binaryLength = parts.reduce((n, b) => n + b.length, 0);
  j.buffers = [{ byteLength: binaryLength }];
  const txt = new TextEncoder().encode(JSON.stringify(j)),
    n = Math.ceil(txt.length / 4) * 4;
  const raw = new Uint8Array(28 + n + binaryLength),
    v = new DataView(raw.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, raw.length, true);
  v.setUint32(12, n, true);
  v.setUint32(16, 0x4e4f534a, true);
  raw.fill(32, 20, 20 + n);
  raw.set(txt, 20);
  v.setUint32(20 + n, binaryLength, true);
  v.setUint32(24 + n, 0x004e4942, true);
  let off = 28 + n;
  for (const p of parts) {
    raw.set(p, off);
    off += p.length;
  }
  return raw;
}
/** Static terrain, model/event previews and horizontal decals. No runtime behavior or editor references. */
export function exportSceneGlb(
  doc: any,
  assets: Map<string, Uint8Array>,
): Uint8Array {
  validateMap(doc);
  return assembleStaticSceneGlb(doc,assets);
}
/** Shared static compositor; callers validate their own document contract first. */
export function assembleStaticSceneGlb(doc:any,assets:Map<string,Uint8Array>):Uint8Array {
  const j: any = {
    asset: { version: "2.0", generator: "Xinghai Map Workshop" },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    images: [],
    textures: [],
    samplers: [],
    extras: {
      mapId: doc.mapId,
      revision: doc.revision,
      excluded: ["runtimeBehavior", "editorReferences"],
      ...(doc.sceneId ? {sceneId:doc.sceneId} : {}),
    },
  };
  const parts: Uint8Array[] = [],
    cache = new Map<string, any>();
  let byteOffset = 0;
  function load(raw: Uint8Array) {
    const { json: s, bin } = decode(raw);
    const offsets: any = {};
    for (const k of [
      "meshes",
      "materials",
      "accessors",
      "bufferViews",
      "images",
      "textures",
      "samplers",
    ])
      offsets[k] = j[k].length;
    for (const b of s.bufferViews ?? []) {
      if (b.buffer !== 0) throw Error("Invalid GLB buffer reference");
      j.bufferViews.push({
        ...b,
        buffer: 0,
        byteOffset: (b.byteOffset ?? 0) + byteOffset,
      });
    }
    for (const a of s.accessors ?? []) {
      const copy = structuredClone(a);
      if (copy.bufferView !== undefined) copy.bufferView += offsets.bufferViews;
      if (copy.sparse) {
        copy.sparse.indices.bufferView += offsets.bufferViews;
        copy.sparse.values.bufferView += offsets.bufferViews;
      }
      j.accessors.push(copy);
    }
    for (const im of s.images ?? [])
      j.images.push({
        ...im,
        ...(im.bufferView !== undefined
          ? { bufferView: im.bufferView + offsets.bufferViews }
          : {}),
      });
    j.samplers.push(...(s.samplers ?? []));
    for (const t of s.textures ?? [])
      j.textures.push({
        ...t,
        ...(t.source !== undefined
          ? { source: t.source + offsets.images }
          : {}),
        ...(t.sampler !== undefined
          ? { sampler: t.sampler + offsets.samplers }
          : {}),
      });
    for (const m of s.materials ?? []) {
      const c = structuredClone(m);
      for (const tex of [
        c.pbrMetallicRoughness?.baseColorTexture,
        c.pbrMetallicRoughness?.metallicRoughnessTexture,
        c.normalTexture,
        c.occlusionTexture,
        c.emissiveTexture,
      ])
        if (tex) tex.index += offsets.textures;
      j.materials.push(c);
    }
    for (const m of s.meshes ?? []) {
      const c = structuredClone(m);
      for (const p of c.primitives) {
        for (const k of Object.keys(p.attributes))
          p.attributes[k] += offsets.accessors;
        if (p.indices !== undefined) p.indices += offsets.accessors;
        if (p.material !== undefined) p.material += offsets.materials;
        if (p.targets)
          for (const target of p.targets)
            for (const k of Object.keys(target)) target[k] += offsets.accessors;
      }
      j.meshes.push(c);
    }
    const nodes = (s.nodes ?? []).map((n: any) => {
      if (n.camera !== undefined || n.skin !== undefined)
        throw Error("Only static mesh nodes supported");
      return {
        ...n,
        ...(n.mesh !== undefined ? { mesh: n.mesh + offsets.meshes } : {}),
      };
    });
    const extensions = new Set([
      ...(j.extensionsUsed ?? []),
      ...(s.extensionsUsed ?? []),
    ]);
    if (extensions.size) j.extensionsUsed = [...extensions];
    const required = new Set([
      ...(j.extensionsRequired ?? []),
      ...(s.extensionsRequired ?? []),
    ]);
    if (required.size) j.extensionsRequired = [...required];
    parts.push(bin);
    byteOffset += bin.length;
    return { nodes, roots: s.scenes?.[s.scene ?? 0]?.nodes ?? [] };
  }
  function nodesFor(template: any) {
    const start = j.nodes.length;
    for (const n of template.nodes) {
      const c = structuredClone(n);
      if (c.children) c.children = c.children.map((i: number) => i + start);
      j.nodes.push(c);
    }
    return template.roots.map((i: number) => i + start);
  }
  if (doc.cells.length)
    j.scenes[0].nodes.push(...nodesFor(load(exportMapGlb(doc))));
  for (const p of [
    ...(doc.instances ?? []),
    ...(doc.decals ?? []).map((d: any) => ({ ...d, visualDecal: true })),
  ]) {
    const cacheKey = p.visualDecal
      ? `decal:${p.assetId}:${p.width}:${p.height}`
      : `model:${p.assetId}`;
    let template = cache.get(cacheKey);
    if (!template) {
      const raw = assets.get(p.assetId);
      if (!raw) throw Error(`Missing model asset: ${p.assetId}`);
      template = load(p.visualDecal ? decalGlb(raw, p.width, p.height) : raw);
      cache.set(cacheKey, template);
    }
    const children = nodesFor(template),
      a = p.anchor ?? [0, 0, 0];
    const offset =
      j.nodes.push({
        name: `${p.id}:anchor`,
        translation: [-a[0] || 0, -a[2] || 0, a[1] || 0],
        children,
      }) - 1;
    const angle = (p.rotation * Math.PI) / 360;
    const node =
      j.nodes.push({
        name: p.id,
        translation: [p.x, p.z + (p.visualDecal ? 0.002 : 0), -p.y],
        rotation: [0, Math.sin(angle), 0, Math.cos(angle)],
        children: [offset],
        extras: {
          instanceId: p.id,
          assetId: p.assetId,
          mapId: doc.mapId,
          ...(doc.sceneId ? {sceneId:doc.sceneId,groupId:p.groupId} : {}),
          ...(p.kind === "event"
            ? { registryKey: p.registryKey, visualOnly: true }
            : {}),
          ...(p.visualDecal ? { kind: "decal" } : {}),
        },
      }) - 1;
    j.scenes[0].nodes.push(node);
  }
  if (!j.meshes.length) throw Error("Empty geometry cannot be exported");
  return encode(j, parts);
}

function decalGlb(png: Uint8Array, width: number, height: number): Uint8Array {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (png.length < 24 || signature.some((v, i) => png[i] !== v))
    throw Error("Invalid PNG decal");
  const w = width / 2,
    h = height / 2;
  const positions = new Float32Array([
    -w,
    0,
    h,
    w,
    0,
    h,
    w,
    0,
    -h,
    -w,
    0,
    h,
    w,
    0,
    -h,
    -w,
    0,
    -h,
  ]);
  const normals = new Float32Array([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ]);
  const uv = new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]);
  const image = new Uint8Array(Math.ceil(png.length / 4) * 4);
  image.set(png);
  const parts = [
    new Uint8Array(positions.buffer),
    new Uint8Array(normals.buffer),
    new Uint8Array(uv.buffer),
    image,
  ];
  let off = 0;
  const bufferViews = parts.map((p) => {
    const v = { buffer: 0, byteOffset: off, byteLength: p.byteLength };
    off += p.byteLength;
    return v;
  });
  bufferViews[3].byteLength = png.length;
  return encode(
    {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [
        {
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
              material: 0,
            },
          ],
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 6,
          type: "VEC3",
          min: [-w, 0, -h],
          max: [w, 0, h],
        },
        { bufferView: 1, componentType: 5126, count: 6, type: "VEC3" },
        { bufferView: 2, componentType: 5126, count: 6, type: "VEC2" },
      ],
      bufferViews,
      images: [{ bufferView: 3, mimeType: "image/png" }],
      samplers: [{ wrapS: 33071, wrapT: 33071 }],
      textures: [{ source: 0, sampler: 0 }],
      materials: [
        {
          name: "Decal",
          pbrMetallicRoughness: {
            baseColorFactor: [1, 1, 1, 1],
            baseColorTexture: { index: 0 },
            metallicFactor: 0,
            roughnessFactor: 1,
          },
          alphaMode: "BLEND",
          doubleSided: true,
        },
      ],
    },
    parts,
  );
}
