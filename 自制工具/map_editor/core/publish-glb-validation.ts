import { staticGlb } from "./workshop-documents.ts";
/** Additional publication checks prevent freezing broken render dependencies. */
export function validatePublishGlb(raw: Uint8Array) {
  staticGlb(raw);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    length = view.getUint32(12, true),
    json = JSON.parse(new TextDecoder().decode(raw.subarray(20, 20 + length))),
    bin = raw.subarray(28 + length);
  const fail = (message: string): never => {
      throw Error("GLB " + message);
    },
    integer = (n: any) => Number.isSafeInteger(n) && n >= 0,
    reference = (list: any[], index: any) =>
      integer(index) && index < list.length;
  const allowed = [
    "KHR_materials_emissive_strength",
    "KHR_materials_unlit",
    "KHR_texture_transform",
  ];
  if (
    (json.extensionsRequired ?? []).some(
      (name: string) =>
        !allowed.includes(name) || !(json.extensionsUsed ?? []).includes(name),
    )
  )
    fail("不支持的必需扩展");
  const pending: any[] = [json];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== "object") continue;
    if (
      value.extensions &&
      Object.keys(value.extensions).some((k) => !allowed.includes(k))
    )
      fail("不支持的扩展");
    pending.push(...Object.values(value));
  }
  const lists = [
    "nodes",
    "meshes",
    "accessors",
    "bufferViews",
    "images",
    "textures",
    "samplers",
    "materials",
    "scenes",
  ];
  for (const key of lists)
    if (json[key] !== undefined && !Array.isArray(json[key]))
      fail("列表格式无效");
  const nodes = json.nodes ?? [],
    meshes = json.meshes ?? [],
    accessors = json.accessors ?? [],
    views = json.bufferViews ?? [],
    images = json.images ?? [],
    textures = json.textures ?? [],
    samplers = json.samplers ?? [],
    materials = json.materials ?? [],
    scenes = json.scenes ?? [];
  if (
    !integer(json.buffers[0].byteLength) ||
    !meshes.length ||
    nodes.length > 100000
  )
    fail("空模型或预算无效");
  for (const v of views)
    if (
      v.buffer !== 0 ||
      !integer(v.byteOffset ?? 0) ||
      !integer(v.byteLength) ||
      (v.byteOffset ?? 0) + v.byteLength > json.buffers[0].byteLength ||
      (v.byteStride !== undefined &&
        (!integer(v.byteStride) ||
          v.byteStride < 4 ||
          v.byteStride > 252 ||
          v.byteStride % 4))
    )
      fail("bufferView越界或步长无效");
  const components: any = {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4,
    },
    elements: any = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    };
  function span(index: any, offset: any, size: number) {
    if (
      !reference(views, index) ||
      !integer(offset) ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      offset + size > views[index].byteLength
    )
      fail("accessor buffer越界");
  }
  for (const a of accessors) {
    const size = components[a.componentType] * elements[a.type];
    if (
      !size ||
      !integer(a.count) ||
      a.count < 1 ||
      !integer(a.byteOffset ?? 0)
    )
      fail("accessor格式无效");
    if (a.bufferView !== undefined) {
      if (!reference(views, a.bufferView)) fail("accessor引用无效");
      const stride = views[a.bufferView].byteStride ?? size;
      if (stride < size) fail("accessor步长过小");
      span(a.bufferView, a.byteOffset ?? 0, (a.count - 1) * stride + size);
    } else if (!a.sparse) fail("accessor缺少负载");
    if (a.sparse) {
      const s = a.sparse;
      if (
        !integer(s.count) ||
        s.count > a.count ||
        ![5121, 5123, 5125].includes(s.indices?.componentType)
      )
        fail("sparse格式无效");
      span(
        s.indices.bufferView,
        s.indices.byteOffset ?? 0,
        s.count * components[s.indices.componentType],
      );
      span(s.values.bufferView, s.values.byteOffset ?? 0, s.count * size);
    }
  }
  for (const m of meshes) {
    if (!Array.isArray(m.primitives) || !m.primitives.length)
      fail("mesh没有primitive");
    for (const p of m.primitives) {
      if (!p.attributes || !reference(accessors, p.attributes.POSITION))
        fail("primitive缺少位置");
      if (p.targets?.length) fail("不支持变形目标");
      for (const index of Object.values(p.attributes))
        if (!reference(accessors, index)) fail("primitive引用无效");
      if (p.indices !== undefined && !reference(accessors, p.indices))
        fail("indices引用无效");
      if (p.material !== undefined && !reference(materials, p.material))
        fail("材质引用无效");
      if (p.mode !== undefined && (!integer(p.mode) || p.mode > 6))
        fail("primitive模式无效");
    }
  }
  const parents = new Uint32Array(nodes.length);
  for (const n of nodes) {
    if (
      n.camera !== undefined ||
      n.skin !== undefined ||
      n.weights !== undefined
    )
      fail("不支持动画、相机或变形节点");
    if (n.mesh !== undefined && !reference(meshes, n.mesh))
      fail("节点mesh引用无效");
    for (const [key, count] of [
      ["translation", 3],
      ["rotation", 4],
      ["scale", 3],
      ["matrix", 16],
    ] as const)
      if (
        n[key] !== undefined &&
        (!Array.isArray(n[key]) ||
          n[key].length !== count ||
          n[key].some((v: any) => !Number.isFinite(v)))
      )
        fail("节点变换无效");
    if (n.children !== undefined && !Array.isArray(n.children))
      fail("节点children格式无效");
    for (const child of n.children ?? []) {
      if (!reference(nodes, child) || ++parents[child] > 1)
        fail("节点重复父引用");
    }
  }
  const state = new Uint8Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    if (state[i]) continue;
    const stack: [number, boolean][] = [[i, false]];
    while (stack.length) {
      const [index, exit] = stack.pop()!;
      if (exit) {
        state[index] = 2;
        continue;
      }
      if (state[index] === 1) fail("节点图存在环");
      if (state[index] === 2) continue;
      state[index] = 1;
      stack.push([index, true]);
      for (const child of nodes[index].children ?? [])
        stack.push([child, false]);
    }
  }
  for (const scene of scenes) {
    if (!Array.isArray(scene.nodes)) fail("scene根列表无效");
    const ids = new Set();
    for (const index of scene.nodes) {
      if (!reference(nodes, index) || parents[index] || ids.has(index))
        fail("scene根节点引用无效");
      ids.add(index);
    }
  }
  if (!reference(scenes, json.scene ?? 0)) fail("默认scene无效");
  for (const image of images)
    if (image.bufferView !== undefined) {
      if (
        !reference(views, image.bufferView) ||
        !["image/png", "image/jpeg"].includes(image.mimeType)
      )
        fail("图片引用无效");
    } else if (
      typeof image.uri !== "string" ||
      !/^data:image\/(png|jpeg);base64,/.test(image.uri)
    )
      fail("图片依赖不是内嵌PNG/JPEG");
  for (const t of textures)
    if (
      !reference(images, t.source) ||
      (t.sampler !== undefined && !reference(samplers, t.sampler))
    )
      fail("纹理引用无效");
  for (const m of materials)
    for (const texture of [
      m.pbrMetallicRoughness?.baseColorTexture,
      m.pbrMetallicRoughness?.metallicRoughnessTexture,
      m.normalTexture,
      m.occlusionTexture,
      m.emissiveTexture,
    ])
      if (texture && !reference(textures, texture.index))
        fail("材质纹理引用无效");
  return { json, bin };
}
