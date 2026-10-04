import fs from "node:fs/promises";
import path from "node:path";
const targetArgument = process.argv.indexOf("--target");
const packageTarget =
  targetArgument < 0 ? "legacy" : process.argv[targetArgument + 1];
if (!["legacy", "workshop"].includes(packageTarget))
  throw Error("target must be legacy or workshop");
const workshop = packageTarget === "workshop";
const target = path.resolve(
    workshop
      ? "release/星骸地图工坊-Workshop-M2.0"
      : "release/星骸地图工坊-M1.2",
  ),
  app = path.join(target, "resources/app");
await fs.mkdir(app, { recursive: true });
const portableExe = path.join(target, "星骸地图工坊.exe");
if (!(await fs.stat(portableExe).catch(() => null))) {
  await fs.cp("node_modules/electron/dist", target, { recursive: true });
  await fs.rename(path.join(target, "electron.exe"), portableExe);
}
for (const file of [
  "main.cjs",
  "preload.cjs",
  "files.cjs",
  "native-store.cjs",
  "catalog.cjs",
  "rename-plan.cjs",
  "workshop-store.cjs",
  "workshop-ipc.cjs",
  "workshop-library.cjs",
  "index.html",
  "style.css",
  "renderer.js",
  "mesh-worker.js",
  ...(workshop
    ? [
        "legacy-import.cjs",
        "publish-source.cjs",
        "publish-store.cjs",
        "publish-fbx.cjs",
        "workshop.html",
        "workshop.css",
        "workshop.js",
      ]
    : []),
]) {
  await fs.mkdir(path.join(app, "desktop"), { recursive: true });
  await fs.copyFile("desktop/" + file, path.join(app, "desktop", file));
}
await fs.mkdir(path.join(app, "dist"), { recursive: true });
await fs.copyFile("dist/core.cjs", path.join(app, "dist/core.cjs"));
await fs.copyFile(
  "dist/build-info.json",
  path.join(app, "dist/build-info.json"),
);
for (const name of ["references", "exchange", "workshop"])
  await fs.copyFile(`dist/${name}.cjs`, path.join(app, `dist/${name}.cjs`));
await fs.writeFile(
  path.join(app, "package.json"),
  JSON.stringify({
    name: "xinghai-map-editor",
    version: "0.1.0",
    main: "desktop/main.cjs",
    workspaceDefault: workshop ? "workshop" : "legacy",
  }),
);
await fs.mkdir(path.join(app, "fixtures"), { recursive: true });
await fs.cp("examples", path.join(target, "示例"), { recursive: true });
await fs.cp("samples/tower-ruins", path.join(target, "示例/遗迹双路"), {
  recursive: true,
});
await fs.cp("assets/ruins-m11", path.join(target, "真实资产/遗迹套件"), {
  recursive: true,
});
await fs.cp("docs", path.join(target, "docs"), { recursive: true });
await fs.copyFile("README.md", path.join(target, "使用说明.md"));
await fs.copyFile("pnpm-lock.yaml", path.join(target, "开发依赖锁.yaml"));
console.log(target);

await fs.mkdir(path.join(app, "scripts"), { recursive: true });
await fs.copyFile(
  "scripts/glb_to_fbx.py",
  path.join(app, "scripts/glb_to_fbx.py"),
);

await fs.cp("samples/m12-workflow", path.join(target, "示例/M1.2"), {
  recursive: true,
});
await fs.cp("samples/m12-exchange", path.join(target, "示例/材质与轴向"), {
  recursive: true,
});
await fs.copyFile(
  "adapters/tuanjie/README.md",
  path.join(target, "docs/团结接收器-M1.2.md"),
);
const plugin = workshop
  ? "release/星骸地图团结插件-Workshop-M2.0.unitypackage"
  : "release/星骸地图团结插件-M1.2.unitypackage";
if (workshop && !(await fs.stat(plugin).catch(() => null)))
  throw Error("Export the Workshop Unity plugin before packaging");
if (await fs.stat(plugin).catch(() => null))
  await fs.copyFile(plugin, path.join(target, path.basename(plugin)));
if (workshop) {
  await fs.cp(
    "validation/workshop-task9/workflow-project",
    path.join(target, "示例/工坊墓室"),
    { recursive: true },
  );
  await fs.copyFile(
    "docs/Validation-Workshop.md",
    path.join(target, "docs/Validation-Workshop.md"),
  );
  await fs.copyFile(
    "adapters/tuanjie/README-Workshop.md",
    path.join(target, "docs/团结接收器-Workshop-M2.0.md"),
  );
}
