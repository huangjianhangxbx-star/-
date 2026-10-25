import test from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { createMap } from "../core/document.ts";
import { exportCanvasGeometry } from "../core/glb.ts";
import { paintedGeometry } from "../core/painted-glb.ts";
import { meshMap } from "../core/mesher.ts";
import { paletteFromMap } from "../core/palette.ts";

function decode(raw: Uint8Array) {
  const d = new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    n = d.getUint32(12, true);
  return {
    j: JSON.parse(new TextDecoder().decode(raw.slice(20, 20 + n))),
    bin: raw.slice(28 + n),
  };
}
function png(raw: Uint8Array) {
  const d = new DataView(raw.buffer, raw.byteOffset, raw.byteLength),
    parts = [];
  let w = 0,
    h = 0;
  for (let p = 8; p < raw.length; ) {
    const n = d.getUint32(p),
      t = new TextDecoder().decode(raw.slice(p + 4, p + 8));
    if (t === "IHDR") {
      w = d.getUint32(p + 8);
      h = d.getUint32(p + 12);
    }
    if (t === "IDAT") parts.push(raw.slice(p + 8, p + 8 + n));
    p += n + 12;
  }
  return { w, h, bytes: inflateSync(Buffer.concat(parts)) };
}
for (const step of [0.25, 0.125, 0.0625])
  test(`painted GLB six faces, atlas pixels and UV winding at ${step}`, () => {
    const doc = createMap();
    doc.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
    doc.sideColor = 1;
    const n = step * 64,
      faces: any = {};
    for (let f = 0; f < 6; f++)
      faces[`0,0,0,${f}`] = { "0": "#ff0000", [n * n - 1]: "#00ff00" };
    const paint: any = {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces,
    };
    const { j, bin } = decode(
      exportCanvasGeometry(
        doc,
        [0.1, 0.2, 0.3],
        "paint",
        step,
        [1, 2, 3],
        paint,
      ),
    );
    assert.equal(j.images.length, 1);
    assert.equal(j.samplers[0].magFilter, 9728);
    assert.equal(j.samplers[0].minFilter, 9728);
    const image = j.bufferViews[j.images[0].bufferView],
      im = png(
        bin.slice(image.byteOffset, image.byteOffset + image.byteLength),
      );
    let count = 0;
    for (const mesh of j.meshes)
      for (const p of mesh.primitives) {
        if (p.attributes.TEXCOORD_0 === undefined) continue;
        const a = j.accessors[p.attributes.TEXCOORD_0];
        assert.equal(a.type, "VEC2");
        assert.equal(a.count, j.accessors[p.attributes.POSITION].count);
        assert.deepEqual(
          j.materials[p.material].pbrMetallicRoughness.baseColorFactor,
          [1, 1, 1, 1],
        );
        assert.equal(p.attributes.COLOR_0, undefined);
        count += a.count;
      }
    assert.equal(count, 36);
    let red = 0,
      green = 0,
      base = 0;
    for (let y = 0; y < im.h; y++) {
      assert.equal(im.bytes[y * (im.w * 4 + 1)], 0);
      for (let x = 0; x < im.w; x++) {
        const k = y * (im.w * 4 + 1) + 1 + x * 4,
          r = im.bytes[k],
          g = im.bytes[k + 1],
          b = im.bytes[k + 2];
        if (r === 255 && g === 0 && b === 0) red++;
        if (r === 0 && g === 255 && b === 0) green++;
        if (r === 204 && g === 143 && b === 56) base++;
      }
    }
    assert.ok(red >= 6 && green >= 6 && base > 0);
  });
test("unpainted export stays byte identical and invisible painted faces stay occluded", () => {
  const doc = createMap();
  doc.cells = [
    { x: 0, y: 0, z: 0, color: 0 },
    { x: 1, y: 0, z: 0, color: 0 },
  ];
  const plain = exportCanvasGeometry(doc, [0, 0, 0], "same", 0.25, [0, 0, 0]);
  assert.deepEqual(
    exportCanvasGeometry(doc, [0, 0, 0], "same", 0.25, [0, 0, 0], {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: {},
    } as any),
    plain,
  );
  const hidden: any = {
    schema: "xinghai-surface-paint-1",
    density: 64,
    faces: { "0,0,0,0": { "0": "#ff0000" } },
  };
  assert.deepEqual(
    exportCanvasGeometry(doc, [0, 0, 0], "same", 0.25, [0, 0, 0], hidden),
    plain,
  );
});
test("paint cutout preserves total exposed surface area, greedy remainder and material properties", () => {
  const doc = createMap();
  doc.cells = [];
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 8; y++) doc.cells.push({ x, y, z: 0, color: 0 });
  const paint: any = {
    schema: "xinghai-surface-paint-1",
    density: 64,
    faces: { "3,4,0,4": { "0": "#ff0000" }, "4,4,0,4": { "0": "#00ff00" } },
  };
  const old = meshMap(doc),
    geom = paintedGeometry(old, paint, 0.25, paletteFromMap(doc).colors);
  assert.equal(
    geom.quads.reduce((a, q) => a + q.w * q.h, 0),
    old.reduce((a, q) => a + q.w * q.h, 0),
  );
  assert.equal(geom.quads.filter((q) => q.uv).length, 2);
  assert.ok(geom.quads.some((q) => !q.uv && q.w * q.h > 1));
  const { j } = decode(
    exportCanvasGeometry(doc, [0, 0, 0], "material", 0.25, [0, 0, 0], paint),
  );
  const mat = j.materials.find(
    (m: any) => m.pbrMetallicRoughness.baseColorTexture,
  );
  assert.equal(
    mat.pbrMetallicRoughness.roughnessFactor,
    j.materials[0].pbrMetallicRoughness.roughnessFactor,
  );
  assert.equal(
    mat.pbrMetallicRoughness.metallicFactor,
    j.materials[0].pbrMetallicRoughness.metallicFactor,
  );
  assert.equal(mat.alphaMode, "OPAQUE");
});
test("atlas pagination remains bounded and preserves every painted face", () => {
  const quads: any[] = [],
    faces: any = {};
  for (let x = 0; x < 3200; x++) {
    quads.push({
      chunk: [Math.floor(x / 16), 0, 0].join(","),
      axis: 2,
      sign: 1,
      plane: 1,
      a: x,
      b: 0,
      w: 1,
      h: 1,
      color: 0,
    });
    faces[`${x},0,0,4`] = { "0": "#ff0000" };
  }
  const geom = paintedGeometry(
    quads,
    { schema: "xinghai-surface-paint-1", density: 64, faces },
    0.25,
    [{ baseColor_sRGB: [0.3, 0.4, 0.5] }],
  );
  assert.equal(geom.images.length, 2);
  assert.equal(geom.quads.length, 3200);
  for (const raw of geom.images) {
    const d = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    assert.ok(d.getUint32(16) <= 1024);
    assert.ok(d.getUint32(20) <= 1024);
  }
  assert.ok(geom.quads.some((q) => q.paintPage === 1));
});

import {composeLayers} from '../core/paint-layers.ts';
test('GLB exports visible layer composite, hidden originals stay in the native source',()=>{
 const doc=createMap();doc.cells=[{x:0,y:0,z:0,color:0}];
 const source=composeLayers([{id:'base',name:'基础',visible:true,locked:false,faces:{'0,0,0,4':{'0':'#ff0000'}}},{id:'detail',name:'细节',visible:false,locked:false,faces:{'0,0,0,4':{'0':'#0000ff'}}}]);
 const flat={schema:source.schema,density:source.density,faces:source.faces};
 assert.deepEqual(exportCanvasGeometry(doc,[0,0,0],'layers',.25,[0,0,0],source),exportCanvasGeometry(doc,[0,0,0],'layers',.25,[0,0,0],flat));
 assert.equal(source.layers![1].faces['0,0,0,4']['0'],'#0000ff');
});
