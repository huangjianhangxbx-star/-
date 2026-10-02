import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow();
  await page.locator("#top").click();
  await page.locator("#thickness").fill("100");
  await page.locator("[data-tool=rectangle]").click();
  const b = await page.locator("canvas").first().boundingBox(),
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  await page.mouse.move(cx - 200, cy - 200);
  await page.mouse.down();
  await page.mouse.move(cx + 200, cy + 200);
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await page.getByText("体素 0", { exact: true }).waitFor();
  await page.getByText("已取消笔画", { exact: true }).waitFor();
  const webgl = await page.evaluate(() => {
    const gl = document.querySelector("canvas").getContext("webgl2"),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      version: gl.getParameter(gl.VERSION),
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  assert.ok(webgl.version);
  await fs.writeFile(
    "validation/logs/cancel-ui.json",
    JSON.stringify({ passed: true, webgl }, null, 2),
  );
  console.log("CANCEL_UI_PASS", webgl);
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
