import { _electron as electron } from "playwright";
import assert from "node:assert/strict";

const app = await electron.launch({ args: [".", "--workspace=legacy", "--test-hidden"], executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#top").click();
  await page.locator("#height").fill("1");
  await page.locator("#thickness").fill("1");
  const canvas = page.locator("#editview canvas");
  const rect = await canvas.boundingBox();
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const before = await canvas.evaluate((c) => c.toDataURL());
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 85, y, { steps: 18 });
  await page.waitForFunction(() => Number(document.querySelector("#count").textContent.match(/\d+/)?.[0]) >= 3);
  await page.waitForFunction((old) => document.querySelector("#editview canvas").toDataURL() !== old, before);
  assert.ok((await page.locator("#quads").textContent()).includes("四边面"));
  await page.screenshot({ path: "validation/m11-stroke-held.png" });
  await page.mouse.up();
  assert.deepEqual(errors, []);
  console.log("M11_HELD_STROKE_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
