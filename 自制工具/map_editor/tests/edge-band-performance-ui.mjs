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
const supplied=JSON.parse(await fs.readFile(process.env.XH_N3_PERF_ASSET,'utf8'));for(const key of Object.keys(a))delete a[key];Object.assign(a,supplied,{assetId:'a'});
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
const v2 = !!process.env.XH_TEST_PROJECT_V2,
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
async function save() {
  await page.locator("#workshop-message").evaluate((e) => (e.textContent = ""));
  await page.keyboard.press("Control+s");
  try {
    await page
      .getByText(v2 ? "原生资产与试摆草稿已保存" : "草稿已保存", {
        exact: true,
      })
      .waitFor();
  } catch (e) {
    console.error(
      "save diagnostics",
      await page.locator("#workshop-message").textContent(),
      errors,
    );
    throw e;
  }
  return read();
}
const color = async (hex) =>
  page.locator("#color").evaluate((e, hex) => {
    e.value = hex;
    e.dispatchEvent(new Event("change", { bubbles: true }));
  }, hex);
const center = async () => {
  const b = await page.locator("#editview canvas").boundingBox();
  return { x: b.x + b.width * 0.5, y: b.y + b.height * 0.5 };
};
async function view(axis) {
  await page.locator(`[data-ortho="${axis}"]`).evaluate((e) => e.click());
  await page.waitForFunction(
    (axis) => document.querySelector("#editview").dataset.viewAxis === axis,
    axis,
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
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
async function stroke(child, axis, tool = "brush", hex = "#35bd74") {
  const current = await child
      .locator("#paint-view")
      .getAttribute("data-view-axis"),
    opposite = {
      top: "bottom",
      bottom: "top",
      right: "left",
      left: "right",
      front: "back",
      back: "front",
    };
  if (current !== axis)
    await child
      .locator(
        "[data-ortho=" + (opposite[current] === axis ? current : axis) + "]",
      )
      .click();
  await child.locator("#paint-hex").fill(hex);
  await child.locator("#paint-hex").dispatchEvent("change");
  await child.locator("#surface-paint-tool").selectOption(tool);
  await child.locator("#paint-status").evaluate((e) => (e.textContent = ""));
  const b = await child.locator("#paint-view canvas").boundingBox();
  await child.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await child.waitForFunction(() =>
    document.querySelector("#paint-status").textContent.includes("已提交"),
  );
  await done(child);
}
async function closeChild(child) {
  await child.locator("#paint-return").click();
  await page.waitForFunction(
    () => document.querySelector("#paint-lease-banner").hidden,
  );
  assert.equal(app.windows().length, 1);
}

const pixel = (child) =>
  child.locator("#paint-view canvas").evaluate((c) => {
    const gl = c.getContext("webgl2"),
      p = new Uint8Array(4);
    gl.readPixels(
      Math.floor(c.width / 2),
      Math.floor(c.height / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      p,
    );
    return [...p];
  });
const frames = (child) =>
  child.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
async function waitIdle(child){await child.waitForFunction(()=>document.body.dataset.busy==='false');}
async function colour(child,hex){await child.locator('#paint-hex').fill(hex);await child.locator('#paint-hex').dispatchEvent('change');}
async function pointOn(child){
 await child.locator('[data-ortho=top]').click();
 const b=await child.locator('#paint-view canvas').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};
}
async function drawPoint(child,p,hex){await colour(child,hex);await child.locator('[data-paint-tool=brush]').click();await child.mouse.click(p.x,p.y);await waitIdle(child);}
const ready=async child=>{await child.waitForFunction(()=>document.querySelector('#edge-band-panel').dataset.state!=='computing');assert.notEqual(await child.locator('#edge-band-panel').getAttribute('data-state'),'error',await child.locator('#edge-band-status').textContent());};
try{
 await open();const child=await openChild(a.objects[0].objectId);await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/paint-workspace.html'));w.setContentSize(1280,860);w.show();w.focus();});
 const cdp=await child.context().newCDPSession(child);await cdp.send('Performance.enable');
 await child.evaluate(()=>{globalThis.__paintPerformance={counts:{},samples:{}};globalThis.__n3Long=[];new PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.__n3Long.push(e.duration);}).observe({type:'longtask',buffered:false});});
 const report={name:a.name,cells:a.canvases.map(c=>c.cells.length),storedPixels:a.canvases.reduce((n,c)=>n+(c.paintSource?Object.values(c.paintSource.faces).reduce((n,f)=>n+Object.keys(f).length,0):0),0),viewport:await child.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visible:document.visibilityState})),trials:[]};
 for(let trial=-1;trial<3;trial++){
  await child.locator('#paint-auto-outline').click();await ready(child);await child.locator('#edge-band-placement').selectOption('above');await ready(child);const before=await child.evaluate(()=>structuredClone(globalThis.__paintPerformance));
  await child.locator('#edge-band-side-hex').fill(['#203d59','#31516b','#42677d','#537b8f'][trial+1]);await child.locator('#edge-band-side-hex').dispatchEvent('change');await ready(child);
  const color=await child.evaluate(()=>structuredClone(globalThis.__paintPerformance));assert.equal(color.counts.outlineRecognition,before.counts.outlineRecognition,'colour never reruns recognition');
  const started=performance.now();await child.locator('#edge-band-apply').click();await child.waitForFunction(()=>document.querySelector('#edge-band-status').textContent.startsWith('已应用'));await waitIdle(child);const applyMs=performance.now()-started;
  const after=await child.evaluate(()=>structuredClone(globalThis.__paintPerformance));assert.equal(after.counts.geometryBuild??0,before.counts.geometryBuild??0,'paint apply never rebuilds model geometry');
  const row={recognitionMs:before.samples.outlineRecognition.at(-1),colorMs:color.samples.outlinePlan.at(-1),applyMs,geometryBuilds:(after.counts.geometryBuild??0)-(before.counts.geometryBuild??0),status:await child.locator('#edge-band-status').textContent(),textureUpdates:after.counts.textureUpdate??0,resourceCreateDelta:(after.counts.paintResourceCreate??0)-(before.counts.paintResourceCreate??0)};assert.equal(row.resourceCreateDelta,0,'repeated work on the same faces reuses paint resources');if(trial>=0)report.trials.push(row);
  await child.locator('#edge-band-close').click();
 }
 report.maxMainThreadTaskMs=await child.evaluate(()=>Math.max(0,...globalThis.__n3Long));report.resources=(await cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','Documents','Nodes','JSEventListeners'].includes(m.name));assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(root,'n3-performance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({root,...report}));
}finally{await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.removeAllListeners('close');w.destroy();}}).catch(()=>{});await app.close();}
