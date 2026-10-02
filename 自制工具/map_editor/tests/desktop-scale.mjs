import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
const rows = [];
try {
  const page = await app.firstWindow();
  const cdp = await page.context().newCDPSession(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const name of ["small", "medium", "large", "small", "large", "small"]) {
    await app.evaluate(
      ({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
        dialog.showMessageBox = async () => ({ response: 1 });
      },
      path.resolve("validation/scale/" + name + ".json"),
    );
    let start = Date.now();
    await page.locator("#open").click();
    await page
      .locator("#filename")
      .filter({ hasText: name + ".json" })
      .waitFor();
    await page.waitForFunction(() =>
      document.querySelector("#quads").textContent.startsWith("四边面 "),
    );
    const openMs = Date.now() - start;
    const perf = await page.evaluate(async () => {
      const times = [];
      await new Promise((resolve) => {
        let last = performance.now(),
          n = 0;
        const tick = (t) => {
          times.push(t - last);
          last = t;
          if (++n < 90) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return {
        fps:
          1000 /
          (times.slice(2).reduce((a, b) => a + b, 0) / (times.length - 2)),
        heapMiB: performance.memory.usedJSHeapSize / 1048576,
        mesh: document.querySelector("#quads").textContent,
      };
    });
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage"),
      resources = JSON.parse(
        await page.locator("#quads").getAttribute("data-resources"),
      );
    delete perf.heapMiB;
    const processes = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((p) => ({ type: p.type, memory: p.memory })),
    );
    rows.push({
      name,
      openMs,
      ...perf,
      heapMiB: heap.usedSize / 1048576,
      resources,
      processes,
    });
  }
  await page.setViewportSize({ width: 1050, height: 760 });
  await page.screenshot({ path: "validation/compact.png" });
  assert.deepEqual(errors, []);
  const gpu = await app.evaluate(async ({ app }) => app.getGPUInfo("basic"));
  await fs.writeFile(
    "validation/logs/desktop-scale.json",
    JSON.stringify(
      {
        rows,
        gpu,
        note: "Electron offscreen GPU dual WebGL views, 90-frame rAF measurements; not a foreground input-latency benchmark.",
      },
      null,
      2,
    ),
  );
  console.log("DESKTOP_SCALE_PASS", rows);
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
