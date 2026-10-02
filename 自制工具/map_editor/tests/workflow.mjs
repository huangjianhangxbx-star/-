import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("validation/workflow");
await fs.mkdir(root, { recursive: true });
const lib = path.join(root, "资产 库");
await fs.mkdir(lib, { recursive: true });
for (const name of [
  "direction.glb",
  "direction.fbx",
  "direction.blend",
  "纹样.png",
])
  await fs.copyFile("fixtures/" + name, path.join(lib, name));
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Only native file selection is automated; drawing, commands and IPC use the real UI.
  await app.evaluate(
    ({ dialog }, { root, lib }) => {
      dialog.showOpenDialog = async (_w, opts) => ({
        canceled: false,
        filePaths: [
          opts.properties.includes("openDirectory")
            ? lib
            : root + "/地图 样本.json",
        ],
      });
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: root + "/地图 样本.json",
      });
      dialog.showMessageBox = async () => ({ response: 1 });
    },
    { root, lib },
  );
  await page.getByRole("button", { name: "俯视", exact: true }).click();
  await page.getByLabel("顶面高度").fill("0");
  await page.getByLabel("厚度").fill("2");
  await page.getByRole("button", { name: "矩形", exact: true }).click();
  const box = await page.locator("#editview canvas").boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx - 100, cy - 100);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 100, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "选择目录", exact: true }).click();
  await page.locator(".asset").filter({ hasText: "GLB" }).first().click();
  await page.getByRole("button", { name: "模型", exact: true }).click();
  await page.getByRole("button", { name: "笔刷", exact: true }).click();
  await page.mouse.click(cx, cy);
  await page.getByRole("button", { name: "事件", exact: true }).click();
  await page.mouse.click(cx - 60, cy + 50);
  await page.locator(".asset").filter({ hasText: "PNG" }).first().click();
  await page.getByRole("button", { name: "贴花", exact: true }).click();
  await page.mouse.click(cx + 60, cy + 40);
  await page.getByRole("button", { name: "属性", exact: true }).click();
  await page.mouse.click(cx - 40, cy);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存 地图 样本.json", { exact: true }).waitFor();
  const source = JSON.parse(
    await fs.readFile(path.join(root, "地图 样本.json"), "utf8"),
  );
  assert.ok(source.cells.length > 50);
  assert.equal(source.instances.length, 2);
  assert.equal(source.instances[1].registryKey, "sample.switch");
  assert.equal(source.decals.length, 1);
  assert.equal(source.surfaces.length, 1);
  await page.getByRole("button", { name: "新建", exact: true }).click();
  await page.getByRole("button", { name: "打开", exact: true }).click();
  await page
    .getByText("体素 " + source.cells.length, { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "重载", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "validation/workflow.png" });
  assert.equal(errors.length, 0, errors.join("\n"));
  await fs.writeFile(
    "validation/logs/workflow.json",
    JSON.stringify(
      {
        passed: true,
        cells: source.cells.length,
        instances: 2,
        decals: 1,
        surfaces: 1,
        nativeDialogs: "automatically selected; all content entered through UI",
      },
      null,
      2,
    ),
  );
  console.log("WORKFLOW_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
