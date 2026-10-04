import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";

const lib = path.resolve("assets/ruins-m11");
const app = await electron.launch({ args: [".", "--workspace=legacy", "--test-hidden"], executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  await app.evaluate(({ dialog }, lib) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [lib] });
  }, lib);
  await page.locator("#choose").click();
  await page.locator(".asset").filter({ hasText: "AR_FRAME_01" }).first().click();
  await page.locator("#inspect").click();
  await page.locator("#asset-viewer[open]").waitFor();
  assert.match(await page.locator("#asset-viewer").textContent(), /AR_FRAME_01/);
  assert.match(await page.locator("#asset-viewer").textContent(), /米/);
  assert.equal(await page.locator("#asset-viewer canvas").count(), 1);
  await page.screenshot({ path: "validation/m11-real-asset-viewer.png" });
  await page.locator("#asset-viewer-close").click();
  await page.locator(".asset").filter({ hasText: "PT_EMBLEM_01" }).last().click();
  await page.locator("#inspect").click();
  await page.locator("#asset-viewer img").waitFor();
  console.log("M11_REAL_ASSET_VIEWER_PASS");
} finally { await app.evaluate(({ app }) => app.exit(0)); }
