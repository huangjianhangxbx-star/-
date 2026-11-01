import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
const output = await fs.mkdtemp(
  path.resolve("validation/model-scene-preview-"),
);
await fs.writeFile(
  path.join(output, "entry.js"),
  `
import {MapView} from ${JSON.stringify(path.resolve("desktop/view.ts"))};
import {ModelScenePreview} from ${JSON.stringify(path.resolve("desktop/model-scene-preview.ts"))};
import {createAsset,createScene} from ${JSON.stringify(path.resolve("core/workshop-documents.ts"))};
const asset=createAsset('rock');asset.cells=[{x:0,y:0,z:0,color:0}];asset.paintSource={schema:'xinghai-surface-paint-1',density:64,faces:{'0,0,0,4':{'0':'#cf44ff'}}};
const first=createScene('first');first.name='台地试摆';first.assets=[{kind:'voxel',assetId:'rock',source:'assets/rock.json'}];first.instances=[{instanceId:'i1',assetId:'rock',positionM:[0,0,0],rotationDeg:0,groupId:'base'}];
const second=structuredClone(first);second.sceneId='second';second.name='门前试摆';second.instances.push({...second.instances[0],instanceId:'i2',positionM:[2,0,0]});
const originals=JSON.stringify({asset,first,second});let root=null;
const view=new MapView(document.getElementById('preview'),false,false);
window.view=view;window.mounted=()=>root;window.sourcesUnchanged=()=>JSON.stringify({asset,first,second})===originals;window.cameraState=()=>[...view.camera.position.toArray(),...view.controls.target.toArray(),...view.camera.up.toArray(),view.camera.zoom,view.camera.far];const draw=()=>{if(!view.disposed){view.draw();requestAnimationFrame(draw);}};draw();
let delayNext=false;window.delayRead=()=>delayNext=true;
const panel=new ModelScenePreview({view,mount(next){root?.removeFromParent();root=next;if(root)view.scene.add(root);},options:()=>({key:'fixture',scenes:[{sceneId:'first',name:first.name},{sceneId:'second',name:second.name}],selectedSceneId:'first'}),readScene:async id=>{if(delayNext){delayNext=false;await new Promise(resolve=>window.releaseRead=resolve);}return {scene:id==='first'?first:second,assets:new Map([['rock',asset]]),binaries:new Map()};}});
window.panel=panel;window.ready=true;
`,
);
await build({
  entryPoints: [path.join(output, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(output, "bundle.js"),
});
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(
        '<html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop-shell.css"><style>body{margin:0}.view{width:100vw;height:100vh;position:relative}.viewport{width:100%;height:100%}</style><div class="view preview"><div id="preview" class="viewport"></div><div class="view-label">模型预览</div></div><script type="module" src="/bundle.js"></script></html>',
      );
      return;
    }
    const file =
      req.url === "/bundle.js"
        ? path.join(output, "bundle.js")
        : path.resolve("." + req.url);
    res.setHeader(
      "Content-Type",
      file.endsWith(".css") ? "text/css" : "text/javascript",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => window.ready);
  const scope = page.getByLabel("预览内容", { exact: true }),
    scenes = page.getByLabel("预览搭建场景", { exact: true });
  assert.equal(await scope.inputValue(), "model");
  const originalCamera=await page.evaluate(()=>window.cameraState());
  await scope.selectOption("scene");
  await page.waitForFunction(
    () => document.getElementById("preview").dataset.previewScene === "first",
  );
  assert.equal(await scenes.locator("option").count(), 2);
  assert.equal(
    await page.locator("#preview").getAttribute("data-preview-instances"),
    "1",
  );
  await scenes.selectOption("second");
  await page.waitForFunction(
    () => document.getElementById("preview").dataset.previewScene === "second",
  );
  assert.equal(
    await page.locator("#preview").getAttribute("data-preview-instances"),
    "2",
  );
  assert.ok(await page.evaluate(()=>{let painted=0;window.mounted().traverse(node=>{if(node.userData.surfacePaint)painted+=node.children.length;});return painted;})>0,'scene preview reuses authored surface paint');
  await page.mouse.click(450, 350);
  assert.ok(
    await page.evaluate(() => window.sourcesUnchanged()),
    "preview gestures must not mutate scene documents or assets",
  );
  for (let i = 0; i < 3; i++) {
    await scope.selectOption("model");
    assert.equal(await page.evaluate(() => window.mounted()), null);
    await scope.selectOption("scene");
    await page.waitForFunction(
      () =>
        document.getElementById("preview").dataset.previewScene === "second",
    );
  }
  assert.equal(
    await page.locator("canvas").count(),
    1,
    "switching preview content must reuse the existing WebGL viewport",
  );
  await page.screenshot({ path: path.join(output, "scene-preview.png") });
  await scope.selectOption('model');
  const restoredCamera=await page.evaluate(()=>window.cameraState());
  assert.ok(restoredCamera.every((value,i)=>Math.abs(value-originalCamera[i])<1e-6),'returning to current model restores its camera including clipping distance');
  await page.evaluate(()=>window.delayRead());await scope.selectOption('scene');await page.waitForFunction(()=>!!window.releaseRead);await scope.selectOption('model');await page.evaluate(()=>window.releaseRead());await page.waitForTimeout(50);
  assert.equal(await page.evaluate(()=>window.mounted()),null,'a late scene read cannot reattach after switching to current model');
  await page.evaluate(() => window.panel.dispose());
  assert.equal(await page.locator("canvas").count(), 1);
  assert.equal(await page.locator(".model-preview-controls").count(), 0);
  await page.evaluate(() => window.view.dispose());
  assert.equal(await page.locator("canvas").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS read-only selected scene / reused viewport", output);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
