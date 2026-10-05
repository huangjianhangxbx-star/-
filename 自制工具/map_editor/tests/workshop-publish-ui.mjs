import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = await fs.mkdtemp(path.resolve("validation/workshop-publish-ui-")),
  out = path.resolve("validation/workshop-task6"),
  project = path.join(root, "project");
await fs.cp("validation/workshop-task4c/tomb-project", project, {
  recursive: true,
});
const app = await launchWorkshop(),
  errors = [],
  hash = (b) => createHash("sha256").update(b).digest("hex");
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator('[data-asset-scope="scene"]').click();
  const pngSource = path.join(root, "art.png");
  await fs.copyFile("samples/m12-exchange/neutral-colors.png", pngSource);
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, pngSource);
  await page.locator("#assembly-import").click();
  await page.getByText("已导入独立本地副本", { exact: true }).waitFor();
  await page.locator("#assembly-copy").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-id").fill("version-a");
  await page.locator("#publish-commit").click();
  await page.getByText("发布完成：version-a", { exact: true }).waitFor();
  const first = path.join(project, "releases/version-a"),
    manifest = JSON.parse(
      await fs.readFile(path.join(first, "manifest.json"), "utf8"),
    ),
    before = await fs.readFile(path.join(first, "output/target.glb"));
  assert.equal(manifest.kind, "scene");
  for (const f of [...manifest.payloadFiles, ...manifest.outputFiles]) {
    const b = await fs.readFile(path.join(first, f.path));
    assert.equal(hash(b), f.sha256);
    assert.equal(b.length, f.byteLength);
  }
  assert.equal(manifest.dependencies.length, 7);
  const n = before.readUInt32LE(12),
    gltf = JSON.parse(before.subarray(20, 20 + n).toString("utf8"));
  assert.equal(gltf.images.length, 1);
  const image = gltf.bufferViews[gltf.images[0].bufferView];
  assert.deepEqual(
    before.subarray(
      28 + n + (image.byteOffset ?? 0),
      28 + n + (image.byteOffset ?? 0) + image.byteLength,
    ),
    await fs.readFile(pngSource),
  );
  await page.locator("#publish-id").fill("version-a");
  await page.locator("#publish-commit").click();
  await page.locator("#workshop-message.error").waitFor();
  assert.deepEqual(
    await fs.readFile(path.join(first, "output/target.glb")),
    before,
  );
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator("[data-instance]").first().click();
  await page.locator("#assembly-copy").click();
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-id").fill("version-b");
  await page.locator("#publish-commit").click();
  await page.locator("#workshop-message.error").waitFor();
  assert.ok(
    (await page.locator("#workshop-message").textContent()).includes("保存"),
  );
  assert.equal(
    await fs.stat(path.join(project, "releases/version-b")).catch(() => null),
    null,
  );
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-id").fill("version-b");
  await page.locator("#publish-commit").click();
  await page.getByText("发布完成：version-b", { exact: true }).waitFor();
  assert.deepEqual(
    await fs.readFile(path.join(first, "output/target.glb")),
    before,
  );
  const next = JSON.parse(
    await fs.readFile(
      path.join(project, "releases/version-b/manifest.json"),
      "utf8",
    ),
  );
  assert.ok(next.sourceRevision > manifest.sourceRevision);
  await page.locator("#publish-target").selectOption({ index: 1 });
  await page.locator("#publish-id").fill("single-module");
  await page.locator("#publish-commit").click();
  await page.getByText("发布完成：single-module", { exact: true }).waitFor();
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(project, "releases/single-module/manifest.json"),
        "utf8",
      ),
    ).kind,
    "asset",
  );
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="publish"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll("[data-publish]").length === 3,
  );
  await page.screenshot({ path: path.join(out, "publish.png") });
  assert.deepEqual(errors, []);
  await fs.cp(project, path.join(out, "published-project"), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(out, "publish-ui-result.json"),
    JSON.stringify(
      {
        passed: true,
        versions: 3,
        checks: [
          "场景GLB-only实际发布与完整hash",
          "重复ID拒绝",
          "未保存草稿拒绝",
          "修改草稿发布B不改变A",
          "单模块发布",
          "重开发布历史",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_PUBLISH_UI_PASS");
} finally {
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
  });
  await app.close();
  if (
    !path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-publish-ui-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}
