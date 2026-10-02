import { build } from "esbuild";
import fs from "node:fs/promises";
await fs.mkdir("dist", { recursive: true });
await build({
  entryPoints: ["core/document.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/core.cjs",
});
if (await fs.stat("desktop/renderer.ts").catch(() => null))
  await build({
    entryPoints: ["desktop/renderer.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: "desktop/renderer.js",
  });
await build({
  entryPoints: ["desktop/mesh-worker.ts"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: "desktop/mesh-worker.js",
});
