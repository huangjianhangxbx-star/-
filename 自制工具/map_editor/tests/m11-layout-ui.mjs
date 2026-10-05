import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
const app = await electron.launch({
  args: [".", "--workspace=legacy", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
let initialWidth;
try {
  const page = await app.firstWindow();
  initialWidth = await page.evaluate(() => {
    const value = localStorage.getItem("xinghai-map--sidebar-width");
    // The drag starts below its upper limit even when earlier runs saved 480px.
    localStorage.setItem("xinghai-map--sidebar-width", "216px");
    return value;
  });
  await page.reload();
  const splitter = page.locator("#sidebar-splitter");
  const before = await page.locator("aside").boundingBox();
  const b = await splitter.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 80);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 70, b.y + 80);
  await page.mouse.up();
  const after = await page.locator("aside").boundingBox();
  assert.ok(after.width > before.width + 50);
  const canvas = await page.locator("#editview canvas").boundingBox();
  assert.ok(canvas.width > 100);
  await page.reload();
  const saved = await page.locator("aside").boundingBox();
  assert.ok(Math.abs(saved.width - after.width) < 3);
  await page.locator("#toggle-sidebar").click();
  assert.equal(await page.locator("aside").isVisible(), false);
  await page.locator("#toggle-sidebar").click();
  assert.equal(await page.locator("aside").isVisible(), true);
  await page.locator("#toggle-library").click();
  assert.equal(await page.locator(".library").isVisible(), false);
  await page.locator("#toggle-library").click();
  assert.equal(await page.locator(".library").isVisible(), true);
  console.log("M11_LAYOUT_PASS");
} finally {
  if (initialWidth !== undefined) {
    const page = await app.firstWindow();
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem("xinghai-map--sidebar-width");
      else localStorage.setItem("xinghai-map--sidebar-width", value);
    }, initialWidth);
  }
  await app.evaluate(({ app }) => app.exit(0));
}
