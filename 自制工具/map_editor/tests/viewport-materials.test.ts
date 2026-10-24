import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ViewportMaterials } from "../desktop/viewport-materials.ts";
test("display variants preserve sources and alpha, share within one view, isolate views", () => {
  const source = new T.MeshStandardMaterial({
    color: "#404040",
    vertexColors: true,
    roughness: 0.2,
    opacity: 0.4,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    alphaTest: 0.3,
  });
  source.map = new T.Texture();
  source.clippingPlanes = [new T.Plane()];
  const before = JSON.stringify(source.toJSON());
  const a = new ViewportMaterials(),
    b = new ViewportMaterials();
  const gray = a.get(source, "studio-gray");
  assert.equal(gray, a.get(source, "studio-gray"));
  assert.notEqual(gray, b.get(source, "studio-gray"));
  assert.equal(gray.opacity, 0.4);
  assert.equal(gray.depthWrite, false);
  assert.equal(gray.alphaTest, 0.3);
  assert.equal(gray.side, T.DoubleSide);
  assert.equal(JSON.stringify(source.toJSON()), before);
  assert.equal(
    (a.get(source, "albedo") as T.MeshBasicMaterial).isMeshBasicMaterial,
    true,
  );
  const lit = a.get(
    new T.MeshBasicMaterial({ map: source.map }),
    "studio-color",
  ) as T.MeshStandardMaterial;
  assert.equal(lit.isMeshStandardMaterial, true);
  assert.equal(lit.color.getHexString(), "ffffff");
  assert.equal(lit.roughness, 1);
  assert.equal(lit.map, source.map);
  let disposed = 0;
  gray.addEventListener("dispose", () => disposed++);
  source.dispose();
  assert.equal(disposed, 1);
  a.dispose();
  b.dispose();
});
