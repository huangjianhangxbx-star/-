import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const { FileStore } = createRequire(import.meta.url)("../desktop/files.cjs");
const root = path.resolve("validation/file-tests");
await fs.mkdir(root, { recursive: true });
test("reject paths outside selected asset root", async () => {
  const s = new FileStore(root);
  await assert.rejects(() => s.safe("../escape.json"));
  await assert.rejects(() => s.safe("C:/Windows/system.ini"));
});
test("atomic write detects external conflict and preserves external bytes", async () => {
  const s = new FileStore(root);
  const f = path.join(root, "map.json");
  await fs.writeFile(f, "old");
  const old = await s.save(f, "first");
  await fs.writeFile(f, "external");
  await assert.rejects(() => s.save(f, "overwrite", old));
  assert.equal(await fs.readFile(f, "utf8"), "external");
});
test("saving preserves previous version as backup", async () => {
  const s = new FileStore(root);
  const f = path.join(root, "backup.json");
  await fs.writeFile(f, "old");
  const h = await s.save(f, "new");
  assert.equal(await fs.readFile(f + ".bak", "utf8"), "old");
  assert.equal(await fs.readFile(f, "utf8"), "new");
  assert.equal(h.length, 64);
});
