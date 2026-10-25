import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/surface-paint-ui-")),
  profile = await fs.mkdtemp(
    path.join(await fs.realpath(os.tmpdir()), "xh-paint-profile-"),
  );
const a = core.createAsset("a");
a.schema = "xinghai-workshop-asset-2";
a.name = "彩绘石块";
a.canvases = [0.25, 0.125, 0.0625].map((step, i) => ({
  canvasId: "c" + i,
  name: "石块" + i,
  visible: true,
  locked: false,
  voxelStepM: step,
  originTicks: [i * 32, i * 32, i * 32],
  cells: [{ x: 0, y: 0, z: 0, color: i }],
  protectedColumns: [],
}));
a.objects = a.canvases.map((c, i) => ({
  objectId: "o" + i,
  name: c.name,
  canvasIds: [c.canvasId],
  originTicks: c.originTicks.map((n) => n + c.voxelStepM / 0.03125 / 2),
  cellKeys: ["0,0,0"],
}));
const large=!!process.env.XH_PERF_LARGE;
for(const canvas of a.canvases){canvas.cells=[];for(let x=-16;x<16;x++)for(let y=0;y<(large?24:8);y++)for(let z=0;z<16;z++){if(!(Math.abs(x)<4&&z<9))canvas.cells.push({x,y,z,color:0});}
if(process.env.XH_PERF_PAINTED){canvas.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:{}};for(const c of canvas.cells.filter(c=>c.y===0)){const pixels={};for(let i=0;i<(process.env.XH_PERF_PAINTED==='dense'?canvas.voxelStepM**2*4096:4);i++)pixels[i]='#ac7351';canvas.paintSource.faces[[c.x,c.y,c.z,3].join(',')]=pixels;}}}
a.objects = a.canvases.map((c, i) => ({
  objectId: "o" + i,
  name: "门洞 " + i,
  canvasIds: [c.canvasId],
  originTicks: [...c.originTicks],
  cellKeys: c.cells.map((p) => [p.x, p.y, p.z].join(",")),
}));
const s = core.createScene("s");
s.assets = [{ kind: "voxel", assetId: "a", source: "assets/a.xhmodule.json" }];
s.instances = [
  {
    instanceId: "i",
    assetId: "a",
    positionM: [0, 0, 0],
    rotationDeg: 0,
    groupId: "base",
  },
];
const p = core.createProject("p");
p.scenes = [
  { sceneId: "s", name: "材质绘制", source: "scenes/s/scene.xhscene.json" },
];
const v2 = true,
  source = v2
    ? "assets/a/asset.xhmodule.json"
    : "scenes/s/assets/a.xhmodule.json";
const p2 = {
  schema: "xinghai-workshop-project-2",
  projectId: "p",
  revision: 0,
  name: "彩绘测试",
  assets: [
    {
      assetId: "a",
      kind: "voxel",
      name: a.name,
      revision: 0,
      preview: null,
      source,
    },
  ],
  scenes: [
    {
      sceneId: "s",
      name: s.name,
      revision: 0,
      source: "scenes/s/scene.xhscene.json",
      preview: null,
    },
  ],
};
const { assets, ...s2 } = s;
for (const [f, d] of [
  ["project.xhproject.json", v2 ? p2 : p],
  [
    "scenes/s/scene.xhscene.json",
    v2 ? { ...s2, schema: "xinghai-workshop-scene-2" } : s,
  ],
  [source, a],
]) {
  await fs.mkdir(path.dirname(path.join(root, f)), { recursive: true });
  await fs.writeFile(path.join(root, f), JSON.stringify(d));
}
const launch = () =>
  electron.launch({
    args: process.env.XH_ELECTRON_EXECUTABLE
      ? ["--workspace=workshop", "--test-hidden"]
      : [".", "--workspace=workshop", "--test-hidden"],
    executablePath:
      process.env.XH_ELECTRON_EXECUTABLE ??
      "node_modules/electron/dist/electron.exe",
    env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  });
let app = await launch();
let page;
const errors = [];
const read = async () =>
  JSON.parse(await fs.readFile(path.join(root, source), "utf8"));
async function open() {
  page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1600, height: 1040 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page
    .getByText(v2 ? "项目级资产库已打开" : "项目已打开", { exact: true })
    .waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-instance="i"]').click();
  await page.locator("#assembly-edit").click();
}
async function openChild(id) {
  await page.locator('[data-model-object="' + id + '"]').click();
  const pending = app.waitForEvent("window");
  await page.locator("#open-paint-window").click();
  const child = await pending;
  child.setDefaultTimeout(10000);
  child.on("pageerror", (e) => errors.push(e.message));
  await child.locator("#paint-view[data-surface-paint-mode=paint]").waitFor();
  return child;
}
async function done(child) {
  await child.waitForFunction(() => document.body.dataset.busy === "false");
}
async function childSave(child) {
  await child.locator("#paint-save").click();
  await child.waitForFunction(
    () => document.querySelector("#paint-status").textContent === "项目已保存",
  );
  return read();
}
async function tool(child, name) {
  await child.locator(`[data-paint-tool="${name}"]`).click();
}

try {
 await open();const child=await openChild('o0');await child.locator('[data-ortho=front]').click();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/paint-workspace.html'));w.show();w.focus();});const before=await childSave(child);await tool(child,'fill');await child.locator('#paint-fill-range').selectOption('plane');const b=await child.locator('#paint-view > canvas').boundingBox();await child.mouse.click(b.x+b.width*.65,b.y+b.height*.45);await child.waitForFunction(()=>document.querySelector('#paint-view').dataset.paintComputing==='true');await child.keyboard.press('Escape');await child.waitForFunction(()=>document.querySelector('#paint-view').dataset.paintComputing!=='true');await child.waitForTimeout(100);const after=await childSave(child);assert.deepEqual(after,before);await child.evaluate(()=>globalThis.__paintPerformance={counts:{},samples:{}});await child.mouse.move(b.x+b.width*.6,b.y+b.height*.5);await child.mouse.down({button:'right'});await child.mouse.move(b.x+b.width*.6+80,b.y+b.height*.5+40,{steps:20});await child.mouse.up({button:'right'});await child.waitForFunction(()=>document.querySelector('#paint-view').dataset.viewAxis!=='front');const counters=await child.evaluate(()=>globalThis.__paintPerformance.counts);assert.ok(counters.render>0,'camera changes request visible renders');assert.deepEqual(await childSave(child),before);assert.deepEqual(errors,[]);console.log('PASS cancel large fill and rotate on demand without author writes',root);
}finally{await app.close();}
