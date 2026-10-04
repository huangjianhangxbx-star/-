import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = await fs.mkdtemp(
    path.resolve("validation/workshop-publish-source-"),
  ),
  app = await launchWorkshop();
try {
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="publish"]').click();
  await page.locator("#publish-target").selectOption({ index: 1 });
  await page.locator("#publish-commit").click();
  await page.getByText("空模块不能导出GLB", { exact: true }).first().waitFor();
  assert.equal(
    await page.locator("#publish-source").count(),
    1,
    "Failed publish must offer returning to its source",
  );
  await page.locator("#publish-source").click();
  assert.equal(await page.locator("#module-workspace").isVisible(), true);
  await page.getByText("体素 0", { exact: true }).waitFor();
  assert.deepEqual(
    await fs.readdir(path.join(root, "releases")).catch(() => []),
    [],
  );
  await fs.writeFile(
    "validation/workshop-task9/publish-source-ui-result.json",
    JSON.stringify({
      passed: true,
      emptyPublishRejected: true,
      returnedToSelectedSource: true,
      noVersionWritten: true,
    }),
  );
  console.log("WORKSHOP_PUBLISH_SOURCE_UI_PASS");
} finally {
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  });
  await app.close();
  assert.ok(
    path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-publish-source-")),
  );
  await fs.rm(root, { recursive: true, force: true });
}
