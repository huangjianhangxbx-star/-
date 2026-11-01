import { build } from "esbuild";
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";

const output = await fs.mkdtemp(
  path.resolve("validation/scene-preview-navigation-"),
);
await fs.writeFile(
  path.join(output, "entry.js"),
  `import {AssemblyView} from ${JSON.stringify(path.resolve("desktop/assembly-view.ts"))}; window.assembly=new AssemblyView(document.getElementById('assembly-viewport')); window.ready=true;`,
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
        '<html><meta charset="utf-8"><link rel="stylesheet" href="/desktop/style.css"><link rel="stylesheet" href="/desktop/workshop.css"><style>body{margin:0}#assembly-viewport{position:relative;width:100vw;height:100vh}</style><div id="assembly-viewport"></div><script type="module" src="/bundle.js"></script></html>',
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
  const page = await browser.newPage({
    viewport: { width: 1100, height: 800 },
  });
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page.waitForFunction(() => window.ready);
  const nav = page.locator("#assembly-viewport .ortho-nav");
  assert.equal(
    await nav.locator("[data-ortho]").count(),
    6,
    "assembly viewport must expose the same six-direction navigation as modeling",
  );
  for (const axis of ["front", "back", "left", "right", "top", "bottom"]) {
    const opposite = {
        front: "back",
        back: "front",
        left: "right",
        right: "left",
        top: "bottom",
        bottom: "top",
      },
      current = await page
        .locator("#assembly-viewport")
        .getAttribute("data-view-axis");
    await nav
      .locator(`[data-ortho="${current === opposite[axis] ? current : axis}"]`)
      .click();
    assert.equal(
      await page.locator("#assembly-viewport").getAttribute("data-view-axis"),
      axis,
    );
    assert.equal(
      await nav.locator(`[data-ortho="${axis}"]`).getAttribute("aria-pressed"),
      "true",
    );
  }
  await nav.locator('[data-ortho="bottom"]').click();
  assert.equal(
    await page.locator("#assembly-viewport").getAttribute("data-view-axis"),
    "top",
    "clicking the selected axis flips to its opposite",
  );
  await page.screenshot({ path: path.join(output, "assembly-navigation.png") });
  await page.evaluate(() => window.assembly.dispose());
  assert.equal(
    await page.locator(".ortho-nav").count(),
    0,
    "disposing the viewport releases its navigation",
  );
  console.log("PASS assembly navigation", output);
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
