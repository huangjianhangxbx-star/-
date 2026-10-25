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
try {
 await open();let child=await openChild('o0');
 child.on('pageerror',e=>errors.push(e.message));
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/paint-workspace.html'));w.setContentSize(1280,860);w.show();w.focus();});
 assert.equal(await child.locator('#paint-stroke-outline').isChecked(),false);
 let pt=await pointOn(child);
 await drawPoint(child,pt,'#ff0000');
 let model=await childSave(child);assert.equal(Object.values(model.canvases[0].paintSource.faces).flatMap(Object.values).includes('#ff0000'),true);
 await child.locator('#paint-layer-add').click();await waitIdle(child);
 assert.equal(await child.locator('.paint-layer-row').count(),2);
 await drawPoint(child,pt,'#0000ff');model=await childSave(child);
 assert.equal(model.canvases[0].paintSource.layers.length,2);
 const current=model.canvases[0].paintSource.layers[1],currentRow=child.locator('[data-layer-id="'+current.id+'"]');
 assert.ok(Object.values(current.faces).flatMap(Object.values).includes('#0000ff'));
 await currentRow.locator('input[type=checkbox]').uncheck();await waitIdle(child);
 model=await childSave(child);assert.ok(Object.values(model.canvases[0].paintSource.faces).flatMap(Object.values).includes('#ff0000'));
 assert.ok(!Object.values(model.canvases[0].paintSource.faces).flatMap(Object.values).includes('#0000ff'));
 await child.locator('#paint-undo').click();await waitIdle(child);model=await childSave(child);assert.equal(model.canvases[0].paintSource.layers[1].visible,true);
 await child.locator('[data-paint-tool=select]').click();
 await child.mouse.move(pt.x-10,pt.y-10);await child.mouse.down();await child.mouse.move(pt.x+10,pt.y+10,{steps:3});await child.mouse.up();
 await child.locator('#paint-copy').click();assert.match(await child.locator('#paint-status').innerText(),/已复制/);
 const original=structuredClone(model.canvases[0].paintSource);
 await child.locator('#paint-target-switch').selectOption('o1');await waitIdle(child);
 await child.waitForFunction(()=>document.querySelector('#paint-scope').textContent.includes('石块1'));
 assert.equal(await child.locator('.paint-layer-row').count(),1);
 // New target is fitted after switching. Use its current centre, without toggling top to bottom.
 let box=await child.locator('#paint-view canvas').boundingBox();pt={x:box.x+box.width/2,y:box.y+box.height/2};
 await child.locator('#paint-paste').click();await child.mouse.move(pt.x,pt.y);
 await child.locator('#paint-paste-scale').fill('200');await child.locator('#paint-paste-scale').dispatchEvent('change');await child.locator('#paint-paste-rotate').click();
 await child.mouse.click(pt.x,pt.y);await waitIdle(child);assert.equal(await child.locator('#paint-paste-controls').isVisible(),false);
 model=await childSave(child);assert.deepEqual(model.canvases[0].paintSource,original);assert.ok(Object.values(model.canvases[1].paintSource.faces).flatMap(Object.values).includes('#0000ff'));
 const pasted=structuredClone(model.canvases[1].paintSource);
 await child.locator('#paint-paste').click();await child.mouse.move(pt.x+12,pt.y+12);await child.keyboard.press('Escape');model=await childSave(child);assert.deepEqual(model.canvases[1].paintSource,pasted);
 await child.locator('#paint-undo').click();await waitIdle(child);model=await childSave(child);assert.equal(model.canvases[1].paintSource,undefined);
 await child.locator('#paint-redo').click();await waitIdle(child);model=await childSave(child);assert.deepEqual(model.canvases[1].paintSource,pasted);
 await child.locator('#paint-target-switch').selectOption('o0');await waitIdle(child);
 await child.locator('#paint-layer-merge').click();await waitIdle(child);model=await childSave(child);assert.equal(model.canvases[0].paintSource.layers.length,1);assert.deepEqual(model.canvases[0].paintSource.faces,original.faces);
 await child.locator('#paint-undo').click();await waitIdle(child);model=await childSave(child);assert.deepEqual(model.canvases[0].paintSource,original);
 await child.locator('#paint-stroke-outline').check();await child.locator('aside').evaluate(e=>e.scrollTop=0);await child.screenshot({path:path.join(root,'layers-paste.png')});
 await closeChild(child);child=await openChild('o0');assert.equal(await child.locator('#paint-stroke-outline').isChecked(),true);assert.equal(await child.locator('.paint-layer-row').count(),2);
 await child.locator('#paint-stroke-outline').uncheck();await childSave(child);await closeChild(child);
 await app.close();app=await launch();await open();child=await openChild('o0');assert.equal(await child.locator('.paint-layer-row').count(),2);assert.equal(await child.locator('#paint-stroke-outline').isChecked(),false);const restarted=await childSave(child);assert.deepEqual(restarted.canvases[0].paintSource,original);assert.deepEqual(restarted.canvases[1].paintSource,pasted);await closeChild(child);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({root,result:'layers hide/undo/merge, cross-canvas transformed paste/cancel/history, outline preference reopen PASS'}));
} catch(error){console.error('UI errors',errors);for(const w of app.windows())console.error(await w.locator('body').innerText().catch(()=>''));throw error;}
finally{await app.close();}
