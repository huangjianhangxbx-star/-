import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
await import("./build-appearance-samples.mjs");
const out = path.resolve("../../docs/tasks/TOOL-013/evidence");
await fs.mkdir(out, { recursive: true });
const bundle = await build({
  entryPoints: ["desktop/workshop-preview.ts"],
  bundle: true,
  format: "iife",
  globalName: "Preview",
  write: false,
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1750, height: 770 },
  });
  await page.setContent(
    "<style>body{margin:0;background:#171d22;color:#d4dbe1;font:14px sans-serif}main{display:grid;grid-template-columns:repeat(7,250px)}article{padding:8px;box-sizing:border-box}canvas{width:234px;height:280px}h1{font-size:19px;margin:12px}p{margin:5px;font-size:12px}</style><h1>TOOL-013 · 原创 SAMPLE · 固定视角缩略图对照</h1><main></main><p>每排：纯色 / 逐格噪点 / 区域种子17、73、211 / 暗面 / 组合。缩略图使用固定方向权重；主视口请切换“材质原色”验收。</p>",
  );
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const project = JSON.parse(
    await fs.readFile(
      "samples/RegionalAppearance-TOOL013/project/project.xhproject.json",
      "utf8",
    ),
  );
  for (const item of project.assets) {
    const asset = JSON.parse(
      await fs.readFile(
        path.join("samples/RegionalAppearance-TOOL013/project", item.source),
        "utf8",
      ),
    );
    await page.evaluate((asset) => {
      const article = document.createElement("article"),
        canvas = document.createElement("canvas"),
        label = document.createElement("p");
      canvas.width = 468;
      canvas.height = 560;
      label.textContent = asset.name;
      article.append(canvas, label);
      document.querySelector("main").append(article);
      Preview.drawAssetPreview(canvas, asset);
    }, asset);
  }
  await page.screenshot({
    path: path.join(out, "same-view-comparison.png"),
    fullPage: true,
  });
} finally {
  await browser.close();
}
