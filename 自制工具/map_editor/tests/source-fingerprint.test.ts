import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
let api: any = {};
try {
  api = await import("../scripts/source-fingerprint.mjs");
} catch (e) {
  if (
    e.code !== "ERR_MODULE_NOT_FOUND" ||
    !e.url.endsWith("/scripts/source-fingerprint.mjs")
  )
    throw e;
}
test("build source fingerprint covers nested workspace source and excludes generated bundles", async () => {
  assert.equal(typeof api.sourceFingerprint, "function");
  const root = await fs.mkdtemp(path.resolve("validation/fingerprint-"));
  try {
    await fs.mkdir(path.join(root, "desktop/workspaces"), { recursive: true });
    await fs.mkdir(path.join(root, "core"));
    await fs.mkdir(path.join(root, "scripts"));
    await fs.writeFile(
      path.join(root, "desktop/workspaces/assembly.ts"),
      "export const test=1;",
    );
    const before = await api.sourceFingerprint(root);
    await fs.writeFile(
      path.join(root, "desktop/workspaces/assembly.ts"),
      "export const test=2;",
    );
    const after = await api.sourceFingerprint(root);
    assert.notEqual(after, before);
    await fs.writeFile(path.join(root, "desktop/workshop.js"), "generated");
    assert.equal(await api.sourceFingerprint(root), after);
  } finally {
    assert.ok(
      path
        .relative(path.resolve("validation"), root)
        .startsWith("fingerprint-"),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
});
