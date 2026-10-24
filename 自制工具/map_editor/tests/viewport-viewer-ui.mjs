import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = await fs.mkdtemp(path.resolve("validation/viewport-viewer-"));
const html = path.resolve("prototypes/rock-shaping/index.html");
await fs.writeFile(
  path.join(root, "main.cjs"),
  `const {app,BrowserWindow}=require('electron');app.setPath('userData',__dirname+'/profile');app.whenReady().then(()=>{const w=new BrowserWindow({width:1400,height:960});w.loadFile(${JSON.stringify(html)});});`,
);
const app = await electron.launch({
  executablePath: "node_modules/electron/dist/electron.exe",
  args: [path.join(root, "main.cjs")],
});
const page = await app.firstWindow();
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url())) requests.push(r.url());
});
try {
  await page.locator("#stats").waitFor();
  const menu = page.locator(".viewport-display-menu");
  for (const preset of ["columnar-wall", "terraced-rim"]) {
    await page.locator("#preset").selectOption(preset);
    const stats = await page.locator("#stats").textContent();
    const seed = await page.locator("#seed").inputValue();
    for (const display of [
      "studio-gray",
      "albedo",
      "studio-color",
      "raking-gray",
    ]) {
      if (!(await menu.evaluate((e) => e.open)))
        await menu.locator(":scope > summary").click();
      await menu
        .locator('[data-display-control="preset"]')
        .selectOption(display);
      assert.equal(
        await page.locator(".stage").getAttribute("data-display-preset"),
        display,
      );
      assert.equal(await page.locator("#stats").textContent(), stats);
      assert.equal(await page.locator("#seed").inputValue(), seed);
    }
    await menu.locator('[data-display-control="rotation"]').evaluate((e) => {
      e.value = "200";
      e.dispatchEvent(new Event("input"));
    });
    await page.keyboard.press("Escape");
    await page.screenshot({ path: path.join(root, preset + ".png") });
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  await page.reload();
  await page.waitForFunction(
    () =>
      document.querySelector(".stage").dataset.displayPreset === "raking-gray",
  );
  console.log(
    "PASS offline viewer presets, fixed recipe, light direction, preferences " +
      root,
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
}
