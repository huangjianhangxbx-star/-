import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, path.resolve("validation/workflow/桥洞 模块.json"));
  await page.locator("#top").click();
  const b = await page.locator("#editview canvas").boundingBox(),
    cx = b.x + b.width / 2 + b.height / 80,
    cy = b.y + b.height / 2 + b.height / 80,
    step = b.height / 40;
  await page.locator("[data-mode=volume]").click();
  for (let z = 0; z < 3; z++) {
    await page.locator("#layer").fill(String(z));
    await page.mouse.click(cx - 2 * step, cy);
    await page.mouse.click(cx + 2 * step, cy);
  }
  await page.locator("#layer").fill("3");
  for (let x = -2; x <= 2; x++) await page.mouse.click(cx + x * step, cy);
  await page.locator("#side").selectOption("3");
  await page.waitForFunction(() =>
    document.querySelector("#quads").textContent.startsWith("四边面"),
  );
  await page.locator("[data-mode=height]").click();
  await page.mouse.click(cx, cy);
  await page
    .getByText("此列已有三维结构，请用三维工具编辑", { exact: true })
    .waitFor();
  await page.locator("[data-mode=volume]").click();
  await page.locator("#layer").fill("1");
  await page.locator("#section").check();
  await page.locator("#save").click();
  await page.getByText("已保存 桥洞 模块.json", { exact: true }).waitFor();
  const doc = JSON.parse(
    await fs.readFile("validation/workflow/桥洞 模块.json", "utf8"),
  );
  assert.equal(doc.cells.length, 11);
  assert.equal(doc.sideColor, 3);
  assert.equal(doc.protectedColumns.length, 5);
  await page.screenshot({ path: "validation/bridge-section.png" });
  await page.locator("#section").uncheck();
  await page.locator("#home").click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "validation/bridge-ui.png" });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/logs/bridge-ui.json",
    JSON.stringify({
      passed: true,
      cells: 11,
      protectedColumns: 5,
      normalUI: true,
    }),
  );
  console.log("BRIDGE_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
