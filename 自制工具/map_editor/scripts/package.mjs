import fs from "node:fs/promises";
import path from "node:path";
const target = path.resolve("release/星骸地图工坊"),
  app = path.join(target, "resources/app");
await fs.mkdir(app, { recursive: true });
await fs.cp("node_modules/electron/dist", target, { recursive: true });
await fs
  .rename(
    path.join(target, "electron.exe"),
    path.join(target, "星骸地图工坊.exe"),
  )
  .catch(async (e) => {
    if (e.code !== "EEXIST") throw e;
  });
for (const file of [
  "main.cjs",
  "preload.cjs",
  "files.cjs",
  "catalog.cjs",
  "index.html",
  "style.css",
  "renderer.js",
  "mesh-worker.js",
]) {
  await fs.mkdir(path.join(app, "desktop"), { recursive: true });
  await fs.copyFile("desktop/" + file, path.join(app, "desktop", file));
}
await fs.mkdir(path.join(app, "dist"), { recursive: true });
await fs.copyFile("dist/core.cjs", path.join(app, "dist/core.cjs"));
await fs.writeFile(
  path.join(app, "package.json"),
  JSON.stringify({
    name: "xinghai-map-editor",
    version: "0.1.0",
    main: "desktop/main.cjs",
  }),
);
await fs.mkdir(path.join(app, "fixtures"), { recursive: true });
await fs.cp("examples", path.join(target, "示例"), { recursive: true });
await fs.cp("docs", path.join(target, "docs"), { recursive: true });
await fs.copyFile("README.md", path.join(target, "使用说明.md"));
await fs.copyFile("pnpm-lock.yaml", path.join(target, "开发依赖锁.yaml"));
console.log(target);
