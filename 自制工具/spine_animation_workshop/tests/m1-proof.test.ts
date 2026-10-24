import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const toolRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workRoot = resolve(toolRoot, "../../work/SPW-01");
const glbPath = join(workRoot, "inputs/CesiumMan.glb");
const jsonPath = join(workRoot, "inputs/rozeul/packed/rozeul.json");
const spinePath = "E:\\Spine\\Spine.com";

function hash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("M1 proof writes distinct short and full JSON with CLI-confirmed animations while preserving inputs", {
  skip: !existsSync(glbPath) || !existsSync(jsonPath) || !existsSync(spinePath),
}, () => {
  const before = [hash(glbPath), hash(jsonPath)];
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/m1-proof.mjs"], {
    cwd: toolRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!) as {
    directory: string;
    outputs: { short: string; full: string; config: string; summary: string };
    cli: { short: { complete: boolean; animationCount: number }; full: { complete: boolean; animationCount: number } };
  };
  assert.ok(summary.directory.startsWith(join(workRoot, "proofs")));
  assert.notEqual(summary.outputs.short, summary.outputs.full);
  assert.ok([summary.outputs.short, summary.outputs.full, summary.outputs.config, summary.outputs.summary].every(existsSync));
  const calibration = JSON.parse(readFileSync(summary.outputs.config, "utf8")) as { full: { target: { directionId: string } } };
  assert.equal(calibration.full.target.directionId, "rozeul-Z-current");
  const evidence = JSON.parse(readFileSync(summary.outputs.summary, "utf8")) as { generated: { short: { name: string }; full: { name: string } } };
  assert.equal(evidence.generated.short.name, "workshop/cesium_rozeul_Z_short_001");
  assert.equal(evidence.generated.full.name, "workshop/cesium_rozeul_Z_full_001");
  for (const variant of ["short", "full"] as const) {
    const output = JSON.parse(readFileSync(summary.outputs[variant], "utf8")) as { animations: Record<string, unknown> };
    assert.equal(Object.keys(output.animations).length, 111);
    assert.equal(summary.cli[variant].complete, true);
    assert.equal(summary.cli[variant].animationCount, 111);
  }
  assert.deepEqual([hash(glbPath), hash(jsonPath)], before);
});
