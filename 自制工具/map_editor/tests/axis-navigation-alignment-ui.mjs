import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";

const output = await fs.mkdtemp(
  path.resolve("validation/axis-navigation-alignment-"),
);
await fs.writeFile(
  path.join(output, "entry.js"),
  `
import {AssemblyView} from ${JSON.stringify(path.resolve("desktop/assembly-view.ts"))};
import {createAsset,createScene} from ${JSON.stringify(path.resolve("core/workshop-documents.ts"))};
const scene=createScene('alignment'),asset=createAsset('rock');asset.cells=[{x:0,y:0,z:0,color:0}];scene.assets=[{kind:'voxel',assetId:asset.assetId,source:'assets/rock.json'}];scene.instances=[{instanceId:'rock-1',assetId:asset.assetId,positionM:[0,0,0],rotationDeg:0,groupId:'base'}];
window.assembly=new AssemblyView(document.getElementById('assembly-viewport'));window.assembly.update(scene,new Map([[asset.assetId,asset]]),[]);window.assembly.fit();window.ready=true;
`,
);
await build({
  entryPoints: [path.join(output, "entry.js")],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(output, "bundle.js"),
});
const html = `<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop-theme.css"><link rel="stylesheet" href="/desktop/workshop.css"><link rel="stylesheet" href="/desktop/workshop-shell.css"><style>body{margin:0}#assembly-workspace{height:100vh;width:100vw}</style><body class="workshop tool014"><section id="assembly-workspace" class="assembly-layout"><aside class="assembly-inspector"><div class="assembly-inspector-frame">内容缩放</div><div class="assembly-inspector-scroll"><div id="assembly-inspector-content"><h1>试摆场景</h1><button>新建集合</button><button>改名</button></div></div></aside><div id="assembly-viewport"></div><div class="assembly-browser-splitter"></div><aside class="assembly-browser">可放入资产</aside></section><script type="module" src="/bundle.js"></script></body></html>`;
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html;charset=utf-8");
      res.end(html);
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
  const page = await browser.newPage(),
    errors = [],
    measurements = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => window.ready);
  for (const [width, height] of [
    [1859, 1270],
    [1440, 900],
    [1000, 700],
  ])
    for (const zoom of [1, 0.95]) {
      await page.setViewportSize({ width, height });
      await page
        .locator("#assembly-inspector-content")
        .evaluate((node, zoom) => (node.style.zoom = String(zoom)), zoom);
      for (const axis of [
        "free",
        "front",
        "back",
        "left",
        "right",
        "top",
        "bottom",
      ]) {
        await page.evaluate(
          (axis) =>
            axis === "free"
              ? window.assembly.fit()
              : window.assembly.orthographicAxis(axis),
          axis,
        );
        const labels = await page
          .locator("#assembly-viewport .ortho-nav button")
          .evaluateAll((buttons) =>
            buttons.map((button) => {
              const range = document.createRange();
              range.selectNodeContents(button);
              const text = range.getBoundingClientRect(),
                circle = button.getBoundingClientRect(),
                style = getComputedStyle(button);
              return {
                axis: button.dataset.ortho,
                label: button.textContent,
                dx:
                  text.left + text.width / 2 - (circle.left + circle.width / 2),
                dy:
                  text.top + text.height / 2 - (circle.top + circle.height / 2),
                width: circle.width,
                height: circle.height,
                padding: style.padding,
              };
            }),
          );
        const entry = { width, height, zoom, camera: axis, labels };
        measurements.push(entry);
        await fs.writeFile(
          path.join(output, "measurements.json"),
          JSON.stringify(measurements, null, 2),
        );
        if (axis === "free")
          await page.screenshot({
            path: path.join(
              output,
              `navigation-${width}-${Math.round(zoom * 100)}.png`,
            ),
          });
        assert.equal(
          labels.length,
          6,
          "all six direction glyphs must be measured",
        );
        for (const label of labels) {
          assert.ok(
            Math.abs(label.dx) <= 0.75 && Math.abs(label.dy) <= 0.75,
            `${width}x${height} sidebar ${zoom} camera ${axis} ${label.label} must be centred in its circle: ${JSON.stringify(label)}`,
          );
          assert.ok(
            Math.abs(label.width - label.height) <= 0.25,
            `axis ${label.axis} background must remain circular`,
          );
        }
      }
    }
  assert.deepEqual(errors, []);
  await page.evaluate(() => window.assembly.dispose());
  console.log(
    JSON.stringify({
      pass: true,
      output,
      configurations: measurements.length,
      glyphs: measurements.reduce((n, m) => n + m.labels.length, 0),
    }),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
