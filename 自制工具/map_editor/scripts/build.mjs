import { execFileSync } from "node:child_process";
import { sourceFingerprint } from "./source-fingerprint.mjs";
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
if (await fs.stat("desktop/workshop.ts").catch(() => null))
  await build({
    entryPoints: ["desktop/workshop.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: "desktop/workshop.js",
  });
await build({
  entryPoints: ["desktop/mesh-worker.ts"],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: "desktop/mesh-worker.js",
});

let commit = "unknown";
try {
  commit = execFileSync(
    "git",
    [
      "-c",
      "safe.directory=E:/WORLDCREATOR/XingHaiHuiLang/Origin",
      "rev-parse",
      "HEAD",
    ],
    { encoding: "utf8" },
  ).trim();
} catch {}
await fs.writeFile(
  "dist/build-info.json",
  JSON.stringify(
    {
      version: "Workshop-M2.0",
      commit,
      sourceFingerprint: await sourceFingerprint("."),
      builtAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

for (const name of ["references", "exchange", "workshop"])
  await build({
    entryPoints: [`core/${name}.ts`],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: `dist/${name}.cjs`,
  });
