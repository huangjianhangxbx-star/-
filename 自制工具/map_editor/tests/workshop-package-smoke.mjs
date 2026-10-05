import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { _electron as electron } from "playwright";
import { sourceFingerprint } from "../scripts/source-fingerprint.mjs";
const root = path.resolve("release/星骸地图工坊-Workshop-M2.0"),
  exe = path.join(root, "星骸地图工坊.exe"),
  appRoot = path.join(root, "resources/app"),
  out = path.resolve("validation/workshop-task9");
await fs.stat(exe);
const required = [
  "desktop/main.cjs",
  "desktop/preload.cjs",
  "desktop/workshop.html",
  "desktop/workshop.css",
  "desktop/workshop-theme.css",
  "desktop/workshop.js",
  "desktop/index.html",
  "desktop/renderer.js",
  "desktop/legacy-import.cjs",
  "desktop/publish-source.cjs",
  "desktop/publish-store.cjs",
  "desktop/publish-fbx.cjs",
  "desktop/workshop-store.cjs",
  "desktop/workshop-ipc.cjs",
  "desktop/workshop-library.cjs",
  "desktop/files.cjs",
  "desktop/catalog.cjs",
  "desktop/native-store.cjs",
  "desktop/rename-plan.cjs",
  "desktop/mesh-worker.js",
  "desktop/style.css",
  "dist/core.cjs",
  "dist/exchange.cjs",
  "dist/references.cjs",
  "dist/workshop.cjs",
  "dist/build-info.json",
  "scripts/glb_to_fbx.py",
];
for (const file of required)
  assert.deepEqual(
    await fs.readFile(path.join(appRoot, file)),
    await fs.readFile(file),
    "Packaged bytes differ: " + file,
  );
const info = JSON.parse(
  await fs.readFile(path.join(appRoot, "dist/build-info.json"), "utf8"),
);
assert.equal(info.version, "Workshop-M2.0");
assert.equal(info.sourceFingerprint, await sourceFingerprint("."));
assert.equal(
  await fs.stat(path.join(appRoot, "node_modules")).catch(() => null),
  null,
);
const plugin = path.join(root, "星骸地图团结插件-Workshop-M2.0.unitypackage"),
  tar = gunzipSync(await fs.readFile(plugin)),
  paths = [],
  entries = new Map(),
  assetDirectories = new Map();
for (let offset = 0; offset + 512 <= tar.length; ) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((b) => b === 0)) break;
  const name = header.subarray(0, 100).toString().replace(/\0.*$/s, ""),
    size =
      parseInt(
        header.subarray(124, 136).toString().replace(/\0.*$/s, "").trim(),
        8,
      ) || 0;
  assert.ok(size >= 0 && offset + 512 + size <= tar.length);
  entries.set(name, tar.subarray(offset + 512, offset + 512 + size));
  if (name.endsWith("/pathname"))
    paths.push(
      tar
        .subarray(offset + 512, offset + 512 + size)
        .toString("utf8")
        .trim(),
    );
  if (name.endsWith("/pathname"))
    assetDirectories.set(paths.at(-1), name.slice(0, -"pathname".length));
  offset += 512 + Math.ceil(size / 512) * 512;
}
const expected = [
  "Runtime/MapDocument.cs",
  "Runtime/GreedyMesher.cs",
  "Runtime/MapRegistry.cs",
  "Runtime/MapSurfaceData.cs",
  "Runtime/ModulePlacement.cs",
  "Runtime/SampleEvent.cs",
  "Runtime/VertexColor.shader",
  "Runtime/Decal.shader",
  "Runtime/ExchangeDoubleSided.shader",
  "Runtime/ExchangeDoubleSidedBlend.shader",
  "Runtime/WorkshopPublish.cs",
  "Runtime/PublishedInstance.cs",
  "Runtime/PublishedVisual.cs",
  "Runtime/WrapperState.cs",
  "Editor/BakeWindow.cs",
  "Editor/MapBaker.cs",
  "Editor/BakeJournal.cs",
  "Editor/SourceReader.cs",
  "Editor/PlacementIdentity.cs",
  "Editor/NativeAssetMaterials.cs",
  "Editor/PublishReader.cs",
  "Editor/AssetBaker.cs",
  "Editor/SceneBaker.cs",
  "Editor/WrapperUpgrade.cs",
  "Editor/PublishWindow.cs",
];
const files = paths.filter((p) => /\.(cs|shader)$/.test(p));
for (const file of files) {
  const directory = assetDirectories.get(file);
  assert.ok(entries.get(directory + "asset.meta")?.length, "Missing plugin meta: " + file);
  assert.deepEqual(
    entries.get(directory + "asset"),
    await fs.readFile(path.join("adapters/tuanjie", file.replace("Assets/XinghaiMap/", ""))),
    "Plugin source differs: " + file,
  );
}
assert.deepEqual(
  files.sort(),
  expected.map((p) => "Assets/XinghaiMap/" + p).sort(),
);
assert.ok(
  !paths.some((p) => /Proof|Generated|Fixtures|node_modules/.test(p)),
  "Test or generated assets leaked into plugin",
);
const temp = await fs.mkdtemp(
  path.resolve("validation/workshop-package-smoke-"),
);
let app;
try {
  app = await electron.launch({ args: ["--test-hidden"], executablePath: exe });
  let page = await app.firstWindow();
  assert.match(page.url(), /workshop\.html$/);
  assert.equal(await page.locator("[data-workspace]").count(), 4);
  assert.equal(await app.evaluate(() => process.execPath), exe);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, temp);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  await page.locator("#brush-size").fill("2");
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText("体素 4", { exact: true }).waitFor();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-target").selectOption({ index: 1 });
  await page.locator("#publish-id").fill("portable-proof");
  await page.locator("#publish-commit").click();
  await page.getByText("发布完成：portable-proof", { exact: true }).waitFor();
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(temp, "releases/portable-proof/manifest.json"),
        "utf8",
      ),
    ).toolchain.sourceFingerprint,
    info.sourceFingerprint,
  );
  assert.deepEqual(errors, []);
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  });
  await app.close();
  app = null;
  app = await electron.launch({
    args: ["--workspace=legacy", "--test-hidden"],
    executablePath: exe,
  });
  page = await app.firstWindow();
  assert.match(page.url(), /index\.html$/);
  const legacy = path.join(temp, "legacy.xhmap.json");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, legacy);
  await page.locator("#brush-size").fill("2");
  const oldBox = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(
    oldBox.x + oldBox.width / 2,
    oldBox.y + oldBox.height / 2,
  );
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#filename")
      .textContent.includes("legacy.xhmap.json"),
  );
  assert.equal(JSON.parse(await fs.readFile(legacy, "utf8")).cells.length, 4);
  await fs.writeFile(
    path.join(out, "package-smoke-result.json"),
    JSON.stringify(
      {
        passed: true,
        exe,
        version: info.version,
        sourceFingerprint: info.sourceFingerprint,
        pluginFiles: files.length,
        pluginSha256: createHash("sha256")
          .update(await fs.readFile(plugin))
          .digest("hex"),
        workshopSavedAndPublished: true,
        legacySaved: true,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_PACKAGE_SMOKE_PASS");
} finally {
  if (app) {
    await app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) win.destroy();
    });
    await app.close();
  }
  assert.ok(
    path
      .resolve(temp)
      .startsWith(path.resolve("validation/workshop-package-smoke-")),
  );
  await fs.rm(temp, { recursive: true, force: true });
}
