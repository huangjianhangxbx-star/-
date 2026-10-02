import { _electron as electron } from "playwright";
import assert from "node:assert/strict";

const app = await electron.launch({ args: [".", "--test-hidden"], executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  await page.locator('[data-mode="height"]').click();
  await page.locator('[data-tool="rectangle"]').click();
  const canvas = page.locator("#editview canvas");
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + b.width * 0.46, b.y + b.height * 0.48);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.60, b.y + b.height * 0.60, { steps: 5 });
  assert.equal(await page.locator("#editview").getAttribute("data-rectangle-preview"), "active");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#editview").getAttribute("data-rectangle-preview"), null);
  assert.match(await page.locator("#count").textContent(), /体素 0/);
  console.log("M11_RECTANGLE_PASS");
} finally { await app.evaluate(({ app }) => app.exit(0)); }
