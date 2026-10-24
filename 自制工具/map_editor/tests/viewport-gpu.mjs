import { build } from "esbuild";
import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("validation/viewport-display");
await fs.mkdir(root, { recursive: true });
await build({
  entryPoints: ["tests/viewport-gpu-fixture.ts"],
  bundle: true,
  outfile: path.join(root, "gpu.js"),
});
await fs.writeFile(
  path.join(root, "gpu.html"),
  '<style>body{margin:0}main{width:640px;height:480px}</style><main></main><script src="gpu.js"></script>',
);
await fs.writeFile(
  path.join(root, "main.cjs"),
  "const {app,BrowserWindow}=require('electron');app.setPath('userData',__dirname+'/profile');app.whenReady().then(()=>{let w=new BrowserWindow({width:680,height:540,webPreferences:{contextIsolation:false}});w.loadFile(__dirname+'/gpu.html');});",
);
const app = await electron.launch({
  executablePath: "node_modules/electron/dist/electron.exe",
  args: [path.join(root, "main.cjs")],
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.waitForFunction(() => window.fixture);
  const evidence = [];
  for (const perspective of [false, true]) {
    await page.evaluate((p) => window.fixture.camera(p), perspective);
    const stats = await page.evaluate(() => {
      const f = window.fixture,
        read = () => {
          const c = document.createElement("canvas");
          c.width = 640;
          c.height = 480;
          const x = c.getContext("2d");
          x.drawImage(f.renderer.domElement, 0, 0);
          return x.getImageData(0, 0, 640, 480).data;
        };
      f.render({ preset: "studio-gray", cavity: "off" });
      const off = read();
      f.render({ cavity: "medium" });
      const on = read();
      let changed = 0,
        total = 0;
      for (let i = 0; i < off.length; i += 4) {
        const d = off[i] - on[i];
        if (d > 2) {
          changed++;
          total += d;
        }
      }
      const [x, y] = window.project([0, -0.449, 0.5]);
      const index = (y * 640 + x) * 4;
      return {
        changed,
        mean: total / Math.max(1, changed),
        flatDifference: Math.abs(off[index] - on[index]),
        status: f.display.context.host.dataset.cavityStatus,
      };
    });
    assert(stats.changed > 100, JSON.stringify(stats));
    assert(stats.flatDifference <= 2, JSON.stringify(stats));
    evidence.push({ perspective, ...stats });
    await page.screenshot({
      path: path.join(
        root,
        perspective ? "cavity-perspective.png" : "cavity-orthographic.png",
      ),
    });
  }
  const scales = await page.evaluate(() => {
    const f = window.fixture,
      counts = [];
    for (const step of [0.25, 0.125, 0.0625]) {
      window.scale(step);
      for (let axis = 0; axis < 6; axis++) {
        window.axis(axis);
        f.render({ preset: "studio-gray", cavity: "low" });
        counts.push({
          step,
          axis,
          status: f.display.context.host.dataset.cavityStatus,
        });
      }
    }
    window.scale(0.25);
    return counts;
  });
  assert(scales.every((s) => s.status === "low"));
  await page.evaluate(() => window.fixture.camera(false));
  const compatibility = await page.evaluate(() => {
    const f = window.fixture,
      whole = f.render({ preset: "studio-gray", cavity: "low" });
    window.clip(true);
    const clipped = f.render({});
    window.clip(false);
    window.transparent(true);
    f.render({});
    const status = f.display.context.host.dataset.cavityStatus;
    window.transparent(false);
    return { clipChanged: whole !== clipped, transparentStatus: status };
  });
  assert(compatibility.clipChanged);
  assert.match(compatibility.transparentStatus, /暂停/);
  await page.evaluate(() => window.fixture.camera(false));
  const colors = await page.evaluate(() => {
    const f = window.fixture;
    f.colors();
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const x = c.getContext("2d");
    x.drawImage(f.renderer.domElement, 0, 0);
    return [112, 216, 320, 424, 528].map((p) =>
      Array.from(x.getImageData(p, 240, 1, 1).data).slice(0, 3),
    );
  });
  const expected = [
    [64, 64, 64],
    [128, 128, 128],
    [192, 192, 192],
    [176, 72, 104],
    [56, 168, 188],
  ];
  colors.forEach((color, i) =>
    color.forEach((n, c) =>
      assert(
        Math.abs(n - expected[i][c]) <= 2,
        JSON.stringify({ colors, expected }),
      ),
    ),
  );
  const paint = await page.evaluate(() => {
    const points = window.paintPair(),
      f = window.fixture,
      result = {};
    for (const preset of [
      "studio-gray",
      "albedo",
      "studio-color",
      "raking-gray",
    ]) {
      f.render({ preset, cavity: "off" });
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 480;
      const ctx = c.getContext("2d");
      ctx.drawImage(f.renderer.domElement, 0, 0);
      result[preset] = points.map(([x, y]) =>
        Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 3),
      );
    }
    return result;
  });
  for (const pair of Object.values(paint))
    pair[0].forEach((value, i) =>
      assert(Math.abs(value - pair[1][i]) <= 2, JSON.stringify(paint)),
    );
  const opacity = await page.evaluate(() => {
    const material = window.paintOpacity(0.3);
    return {
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
    };
  });
  assert.deepEqual(opacity, {
    opacity: 0.3,
    transparent: true,
    depthWrite: false,
  });
  await page.evaluate(() => window.paintOpacity(1));
  const resources = await page.evaluate(() => {
    const f = window.fixture,
      values = [];
    for (let i = 0; i < 20; i++) {
      for (const preset of [
        "studio-gray",
        "albedo",
        "studio-color",
        "raking-gray",
      ])
        f.render({ preset });
      if (i === 2 || i === 19)
        values.push({
          ...f.renderer.info.memory,
          programs: f.renderer.info.programs.length,
        });
    }
    return values;
  });
  assert(
    resources[1].textures <= resources[0].textures + 1,
    JSON.stringify(resources),
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  const gpu = await page.evaluate(() => {
    const g = window.fixture.renderer.getContext(),
      e = g.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: e
        ? g.getParameter(e.UNMASKED_RENDERER_WEBGL)
        : g.getParameter(g.RENDERER),
      dpr: devicePixelRatio,
    };
  });
  await fs.writeFile(
    path.join(root, "gpu-result.json"),
    JSON.stringify(
      {
        evidence,
        scales,
        compatibility,
        colors,
        paint,
        resources,
        gpu,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ evidence, compatibility, colors, paint, resources, gpu }),
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
}
