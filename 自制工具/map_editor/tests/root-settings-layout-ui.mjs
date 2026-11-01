// Actual WorkshopShell DOM/layout in an artifact-only headless browser. The
// WebGL editor dependency is isolated; root visibility/navigation stays real.
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

const out = await fs.mkdtemp(path.resolve("validation/root-settings-layout-"));
const editorStub = `export const moduleEditor={externalPaintOnly(){},dockTools(){},resize(){},hasDraft:false,currentTool:'选择',resolveDraft:async()=>true,openAppearance(){},rockShaping(){},history(){},cancelDraft(){}};`;
const entry = `import {WorkshopShell} from ${JSON.stringify(path.resolve("desktop/workshop-shell.ts"))};
const paint=document.createElement('button');paint.textContent='贴图绘制 ↗';
const session={savedRevision:0,canvases:{model:{assetId:'layout-fixture',name:'测试资产',revision:0,objects:[]},active:{name:'主体',voxelStepM:.25},editObjectId:null,selectedObjectIds:[]}};
window.shell=new WorkshopShell({session:()=>session,paintButton:paint});window.ready=true;`;
await fs.writeFile(path.join(out, "entry.js"), entry);
await build({
  entryPoints: [path.join(out, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(out, "app.js"),
  plugins: [
    {
      name: "isolate-webgl-editor",
      setup(b) {
        b.onResolve({ filter: /^\.\/renderer\.ts$/ }, () => ({
          path: "editor-interface",
          namespace: "fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: editorStub,
          loader: "js",
        }));
      },
    },
  ],
});
const context = (await fs.readFile("desktop/workshop.html", "utf8"))
  .match(
    /<div class="module-context">([\s\S]*?)<\/div>\s*<div id="module-export-result"/,
  )[0]
  .replace(/\s*<div id="module-export-result"$/, "");
const app = `<header><nav><button id="duplicate">复制模块</button><button id="undo">撤销</button><button id="redo">重做</button></nav></header>
<div class="layout"><aside>
<label><input id="brush-size"></label><label><input id="brush-direction"></label><p id="brush-meters">1格</p><label><input id="thickness"></label><label><input id="layer"></label><label><select id="side"></select></label>
<details><summary>平面</summary><select id="work-plane"></select></details>
<div class="palette-library"></div><div id="palette"></div><button id="palette-toggle"></button><div id="color-panel"></div>
</aside><div class="workspace"><div class="views"><div class="view" id="editview">编辑视口</div><div class="view preview" id="preview">预览</div></div><div class="library"></div></div></div>
<button id="toggle-library"></button><button id="toggle-sidebar"></button><button id="shortcut-map-open">快捷键与功能</button>
<div><button id="appearance-open"></button></div><button id="random-tone"></button><button id="random-edge"></button>
<details><summary>参考</summary><button id="reference-import"></button></details><button id="canvas-align">点对点对齐</button>
<div id="model-canvases"></div><div class="viewport-brush-toolbar">工具</div>
<details id="viewport-mode-menu"><summary>模式</summary><div id="modes"></div></details>
<details id="viewport-brush-menu"><summary>笔刷</summary><div id="tools"></div></details>
<details id="viewport-precision"><summary>精度</summary><div></div></details>`;
const html = `<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop-theme.css"><link rel="stylesheet" href="/desktop/workshop.css"><link rel="stylesheet" href="/desktop/workshop-shell.css"><body class="workshop"><header class="workshop-bar"><nav><button data-workspace="module">模块编辑</button><button data-workspace="assembly">场景装配</button></nav></header><section id="module-workspace">${context}<main id="app">${app}</main></section><script type="module" src="/bundle.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }
    const file =
      req.url === "/bundle.js"
        ? path.join(out, "app.js")
        : path.resolve("." + decodeURIComponent(req.url));
    const bytes = await fs.readFile(file);
    res.setHeader(
      "Content-Type",
      file.endsWith(".css") ? "text/css" : "text/javascript",
    );
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 940 } }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => window.ready);
  const root = page.getByRole("button", { name: "根设置", exact: true });
  assert.equal(
    await root.count(),
    1,
    "Root settings must have one directly visible button rather than being buried in a management menu",
  );
  assert.equal(await page.getByText("资产定位", { exact: true }).count(), 0);
  assert.equal(
    await page.locator("#asset-document-more>summary").textContent(),
    "模型管理",
  );
  for (const width of [2116, 1440, 960]) {
    await page.setViewportSize({ width, height: 940 });
    const rootBox = await root.boundingBox(),
      manageBox = await page
        .locator("#asset-document-more>summary")
        .boundingBox();
    assert.ok(
      rootBox && rootBox.x + rootBox.width < width / 2,
      "Root settings should stay in the left half",
    );
    assert.ok(
      manageBox && manageBox.x + manageBox.width < width / 2,
      "Model management should stay in the left half",
    );
    await root.click();
    await page.waitForFunction(
      () =>
        !document.getElementById("inspector-asset").hidden &&
        document.getElementById("module-root-menu").open,
    );
    assert.equal(
      await page.locator("#module-root-menu>summary").textContent(),
      "根设置",
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#tool-inspector h2").textContent === "根设置",
    );
    assert.ok(
      await page.locator("#module-root-bottom").isVisible(),
      "Bottom-centre preset should be reachable from direct root control",
    );
    await page.locator("#asset-document-more>summary").click();
    await page.locator("#close-module").waitFor({ state: "visible" });
    const open = await page.locator("#close-module").boundingBox();
    assert.ok(
      open.x >= 0 && open.x + open.width < width / 2,
      "Opened management menu should stay anchored to the left control",
    );
    await page.screenshot({ path: path.join(out, "layout-" + width + ".png") });
    await page.locator("#asset-document-more>summary").click();
    results.push({
      width,
      rootBox,
      manageBox,
      openedMenu: open,
      rootControlsReachable: true,
    });
  }
  await page.locator("#model-commands-more>summary").click();
  await page.locator("#shell-rock").click();
  await page.waitForTimeout(350);
  assert.equal(
    await root.getAttribute("aria-pressed"),
    "false",
    "Root settings button should reflect leaving root settings for another tool",
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "result.json"),
    JSON.stringify({ pass: true, headless: true, results, errors }, null, 2),
  );
  console.log(JSON.stringify({ pass: true, out, viewports: results.length }));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
