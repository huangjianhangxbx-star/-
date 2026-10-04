import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const app = await electron.launch({
  args: [".", "--workspace=legacy", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow();
  await page
    .getByRole("button", { name: "新建", exact: true })
    .waitFor({ timeout: 8000 });
  assert.equal(await page.locator("#editview canvas, #preview canvas").count(), 2);
  await page.getByLabel("顶面高度").fill("-2");
  await page.getByLabel("厚度", { exact: true }).fill("2");
  const canvas = page.locator("#editview canvas");
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText("体素 2", { exact: true }).waitFor();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.getByText("体素 0", { exact: true }).waitFor();
  await page.screenshot({ path: "validation/ui.png" });
  console.log("UI_SMOKE_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
