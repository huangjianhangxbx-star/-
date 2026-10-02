import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const { FileStore, digest } = createRequire(import.meta.url)(
  "../desktop/files.cjs",
);
const { Catalog } = createRequire(import.meta.url)("../desktop/catalog.cjs");
test("concurrent saves with same revision allow only one winner", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/concurrent-")),
    file = path.join(root, "m.json");
  await fs.writeFile(file, "old");
  const s = new FileStore(root),
    results = await Promise.allSettled([
      s.save(file, "a", digest("old")),
      new FileStore(root).save(file, "b", digest("old")),
    ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await fs.readFile(file, "utf8"), "a");
});
test("junctions cannot escape selected asset root", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/junction-")),
    outside = await fs.mkdtemp(path.resolve("validation/target-"));
  await fs.writeFile(path.join(outside, "a.json"), "keep");
  await fs.symlink(outside, path.join(root, "linked"), "junction");
  await assert.rejects(() => new FileStore(root).safe("linked/a.json"));
  await assert.rejects(() =>
    new FileStore(root).save(path.join(root, "linked/a.json"), "replace"),
  );
  assert.equal(await fs.readFile(path.join(outside, "a.json"), "utf8"), "keep");
});
test("GLB may not read external files or URLs", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/glb-")),
    body = Buffer.from(
      JSON.stringify({
        asset: { version: "2.0" },
        buffers: [{ uri: "https://example.invalid/private" }],
      }),
    ),
    bytes = Buffer.alloc(body.length + 20);
  bytes.writeUInt32LE(0x46546c67, 0);
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(body.length, 12);
  bytes.writeUInt32LE(0x4e4f534a, 16);
  body.copy(bytes, 20);
  await fs.writeFile(path.join(root, "bad.glb"), bytes);
  await fs.writeFile(path.join(root, "unsupported.obj"), "v 0 0 0");
  const catalog = new Catalog(root),
    rows = await catalog.scan();
  assert.equal(rows.find((r) => r.type === "obj").status, "unsupported");
  await assert.rejects(
    () => catalog.payload(rows.find((r) => r.type === "glb").id),
    /自包含/,
  );
});
