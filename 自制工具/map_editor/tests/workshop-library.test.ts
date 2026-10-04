import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as core from "../core/workshop.ts";
const require = createRequire(import.meta.url);
let mod: any = {};
try {
  mod = require("../desktop/workshop-library.cjs");
} catch (e) {
  if (
    e.code !== "MODULE_NOT_FOUND" ||
    !e.message.includes("workshop-library.cjs")
  )
    throw e;
}
async function fixture(fn: (root: string, lib: any) => Promise<void>) {
  assert.equal(typeof mod.createWorkshopLibrary, "function");
  const root = await fs.mkdtemp(path.resolve("validation/workshop-library-"));
  try {
    await fn(root, mod.createWorkshopLibrary(root, core));
  } finally {
    assert.ok(
      path
        .relative(path.resolve("validation"), root)
        .startsWith("workshop-library-"),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
}
test("public registration produces independent source and catalog identity", () =>
  fixture(async (root, lib) => {
    const source = core.createAsset("local");
    source.name = "洞壁";
    source.cells.push({ x: 0, y: 0, z: 0, color: 0 });
    const registered = await lib.register(source),
      opened = await lib.source(registered.assetId);
    assert.notEqual(opened.assetId, "local");
    assert.equal(opened.revision, 0);
    assert.equal(opened.name, "洞壁");
    const manifest = JSON.parse(
      await fs.readFile(path.join(root, ".xinghai-assets.json"), "utf8"),
    );
    assert.equal(manifest.assets.length, 1);
    assert.equal(manifest.assets[0].id, opened.assetId);
    opened.cells[0].z = 3;
    assert.equal((await lib.source(registered.assetId)).cells[0].z, 0);
    assert.equal(source.cells[0].z, 0);
  }));
test("failed public catalog registration cannot leave a valid source or partial catalog", () =>
  fixture(async (root, lib) => {
    const rename = fs.rename;
    try {
      fs.rename = async (from, to) => {
        if (to === path.join(root, ".xinghai-assets.json"))
          throw Error("injected catalog write failure");
        return rename(from, to);
      };
      await assert.rejects(() => lib.register(core.createAsset("local")));
    } finally {
      fs.rename = rename;
    }
    assert.deepEqual(
      (await fs.readdir(root)).filter((x) => x !== ".workshop-txn"),
      [],
    );
  }));
