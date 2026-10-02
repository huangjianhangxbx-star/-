import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EditorDocument, createMap, validateMap } from "../core/document.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../samples/tower-ruins");
await fs.mkdir(root, { recursive: true });
const width = 24, height = 14;
const goal = { x: 1, y: 7 }, spawnA = { x: 23, y: 2 }, spawnB = { x: 23, y: 11 };
const waypoints = [
  [spawnA, { x: 16, y: 2 }, { x: 16, y: 5 }, { x: 11, y: 5 }, { x: 11, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 7 }, goal],
  [spawnB, { x: 18, y: 11 }, { x: 18, y: 8 }, { x: 11, y: 8 }, { x: 3, y: 8 }, { x: 3, y: 7 }, goal],
];
const routeTiles = new Set();
for (const route of waypoints) for (let i = 1; i < route.length; i++) {
  const a = route[i - 1], b = route[i];
  if (a.x !== b.x && a.y !== b.y) throw Error("路线必须正交");
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++)
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) routeTiles.add(`${x},${y}`);
}
const courtyard = (x, y) => x >= 1 && x <= 7 && y >= 5 && y <= 9;
const northPlatform = (x, y) => x >= 6 && x <= 10 && y >= 2 && y <= 4;
const southPlatform = (x, y) => x >= 11 && x <= 15 && y >= 9 && y <= 11;
const ruinsWall = (x, y) => y === 0 || y === height - 1 || x === 0 ||
  (x >= 8 && x <= 13 && y === 3) || (x >= 13 && x <= 17 && y === 10) ||
  (x === 22 && y >= 4 && y <= 8);
const kind = (x, y) => routeTiles.has(`${x},${y}`) || courtyard(x, y) ? "walk" :
  northPlatform(x, y) || southPlatform(x, y) ? "highground" :
  ruinsWall(x, y) ? "obstacle" : "walk";
const d = createMap();
d.mapId = "tower-ruins-m11-v1";
d.palette = ["#73888b", "#829493", "#9baaa5", "#61747a", "#bd9b68", "#587d79", "#a9aca0", "#34434a"];
d.sideColor = 3;
const assetIndex = JSON.parse(await fs.readFile(path.resolve(root, "../../assets/ruins-m11/.xinghai-assets.json"), "utf8"));
const emblemPng = assetIndex.assets.find((a) => a.path === "PT_EMBLEM_01.png")?.id;
if (!emblemPng) throw Error("真实纹样 PNG 未登记");
const editor = new EditorDocument(d);
editor.begin();
for (let uy = 0; uy < height; uy++) for (let ux = 0; ux < width; ux++) {
  const type = kind(ux, uy), top = type === "obstacle" ? 2 : type === "highground" ? 2 : 0;
  const color = type === "obstacle" ? 3 : type === "highground" ? 2 : routeTiles.has(`${ux},${uy}`) ? 0 : 1;
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++)
    editor.height(ux * 4 + dx, uy * 4 + dy, top, top + 1, color);
  if (type !== "walk") editor.surface(ux * 4 + 2, uy * 4 + 2, top, 4, type);
}
const addEvent = (id, registryKey, assetId, p) => editor.place({
  id, assetId, kind: "event", registryKey, x: p.x + 0.5, y: p.y + 0.5, z: 0,
  rotation: 0, anchor: [0, 0, 0],
});
addEvent("tower-goal", "tower.goal", "ruins:IT_LIGHT_01", goal);
addEvent("tower-spawn-a", "tower.spawn.a", "ruins:PT_EMBLEM_01", spawnA);
addEvent("tower-spawn-b", "tower.spawn.b", "ruins:PT_EMBLEM_01", spawnB);
addEvent("tower-ally-start", "tower.ally.start", "ruins:IT_LIGHT_01", { x: 4, y: 7 });
for (const [id, assetId, x, y, rotation] of [
  ["pillar-a", "ruins:AR_COLUMN_02", 7, 3, 0],
  ["arch-a", "ruins:AR_FRAME_01", 14, 1, 90],
  ["rock-a", "ruins:EX_ROCK_01", 20, 6, 0],
  ["light-a", "ruins:IT_LIGHT_01", 8, 6, 0],
  ["landmark-a", "ruins:EX_LANDMARK_01", 4, 1, 0],
]) editor.place({ id, assetId, kind: "model", x: x + 0.5, y: y + 0.5,
  z: kind(x, y) === "obstacle" || kind(x, y) === "highground" ? 0.5 : 0,
  rotation, anchor: [0, 0, 0] });
editor.decal({ id: "floor-emblem", assetId: emblemPng,
  kind: "decal", x: 5.5, y: 7.5, z: 0, rotation: 0, width: 1.5, height: 1.5, order: 0 });
editor.commit();
const doc = validateMap(editor.doc);
const content = { version: 1, mapId: doc.mapId, width, height, metersPerUnit: 1,
  requiredMarkerKeys: ["tower.goal", "tower.spawn.a", "tower.spawn.b", "tower.ally.start"],
  routes: waypoints, waves: 3, description: "遗迹双路 · 体素尺度验证" };
for (const [name, body] of [["遗迹双路.xhmap.json", JSON.stringify(doc)],
  ["tower-content.json", JSON.stringify(content, null, 2)]]) {
  const target = path.join(root, name);
  await fs.writeFile(target, body, { flag: process.argv.includes("--force") ? "w" : "wx" });
}
console.log(JSON.stringify({ cells: doc.cells.length, surfaces: doc.surfaces.length,
  instances: doc.instances.length, decals: doc.decals.length, root }));
