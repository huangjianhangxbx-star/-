import fs from "node:fs";
import { createMap } from "../core/document.ts";
import { createNativeAsset } from "../core/native-asset.ts";
import { exportNativeAssetGlb } from "../core/glb.ts";
const d = createMap();
d.mapId = "exchange-proof";
d.palette = ["#808080", "#ff0000", "#00ff00", "#0000ff"];
d.cells = [
  { x: 0, y: 0, z: 0, color: 0 },
  { x: 1, y: 0, z: 0, color: 1 },
  { x: 2, y: 0, z: 0, color: 1 },
  { x: 0, y: 1, z: 0, color: 2 },
  { x: 0, y: 0, z: 1, color: 3 },
  { x: 0, y: 0, z: 2, color: 3 },
  { x: 0, y: 0, z: 3, color: 3 },
];
const a = createNativeAsset(
  d,
  { min: [0, 0, 0], max: [2, 1, 3] },
  {
    assetId: "axis-color",
    name: "Axis/color exchange proof",
    anchor: "origin",
  },
);
fs.mkdirSync("artifacts/exchange-proof", { recursive: true });
fs.writeFileSync(
  "artifacts/exchange-proof/axis-color.xhasset.json",
  JSON.stringify(a, null, 2),
);
fs.writeFileSync(
  "artifacts/exchange-proof/axis-color.glb",
  exportNativeAssetGlb(a),
);
import { exportSceneGlb } from "../core/scene-glb.ts";
const scene = createMap();
scene.mapId = "scene-proof";
scene.cells = [
  { x: 0, y: 0, z: 0, color: 0 },
  { x: 4, y: 0, z: 0, color: 0 },
  { x: 0, y: 4, z: 0, color: 0 },
];
scene.instances = [
  { id: "first", assetId: "axis-color", x: 0, y: 0, z: 0.25, rotation: 0 },
  { id: "rotated", assetId: "axis-color", x: 1, y: 0, z: 0.25, rotation: 90 },
  { id: "third", assetId: "axis-color", x: 0, y: 1, z: 0.25, rotation: 0 },
];
scene.instances.push({
  id: "event-preview",
  assetId: "axis-color",
  kind: "event",
  registryKey: "proof.door",
  x: 0,
  y: 0,
  z: 0.25,
  rotation: 0,
});
scene.decals = [
  {
    id: "decal",
    assetId: "png",
    x: 0.125,
    y: 0.125,
    z: 0.25,
    width: 0.25,
    height: 0.25,
    rotation: 0,
  },
];
fs.writeFileSync(
  "artifacts/exchange-proof/assembled.glb",
  exportSceneGlb(
    scene,
    new Map([
      ["axis-color", exportNativeAssetGlb(a)],
      ["png", new Uint8Array(fs.readFileSync("fixtures/纹样.png"))],
    ]),
  ),
);
