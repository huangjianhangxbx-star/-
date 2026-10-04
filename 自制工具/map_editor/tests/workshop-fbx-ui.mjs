import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = await fs.mkdtemp(path.resolve("validation/workshop-fbx-ui-")),
  out = path.resolve("validation/workshop-task7");
await fs.cp(path.join(out, "real-project"), root, { recursive: true });
const app = await launchWorkshop(),
  errors = [];
try {
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-recipe").selectOption("glb-fbx");
  await page.locator("#publish-id").fill("ui-fbx-version");
  await page.locator("#publish-commit").click();
  await page.getByText("发布完成：ui-fbx-version", { exact: true }).waitFor();
  const m = JSON.parse(
    await fs.readFile(
      path.join(root, "releases/ui-fbx-version/manifest.json"),
      "utf8",
    ),
  );
  assert.equal(m.recipe, "glb-fbx");
  assert.equal(m.toolchain.blenderVersion, "5.1.2");
  assert.equal(m.dependencies.filter((d) => d.unity.route === "fbx").length, 2);
  await page.screenshot({ path: path.join(out, "fbx-publish.png") });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "fbx-ui-result.json"),
    JSON.stringify(
      {
        passed: true,
        checks: [
          "真实UI选择FBX配方",
          "实际Blender生成目标和资产级组",
          "完整manifest/版本/绑定反馈",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_FBX_UI_PASS");
} finally {
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
  });
  await app.close();
  if (
    !path.resolve(root).startsWith(path.resolve("validation/workshop-fbx-ui-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}
