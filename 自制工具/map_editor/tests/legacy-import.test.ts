import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import * as core from "../core/workshop.ts";
import { createMap, validateMap } from "../core/document.ts";
const require = createRequire(import.meta.url),
  { resolveLegacyAssets } = require("../desktop/legacy-import.cjs"),
  { FileStore } = require("../desktop/files.cjs");
test("migration resolver copies FBX, material sidecar and nested texture bytes from an existing exchange group", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/legacy-resolver-"));
  try {
    await fs.copyFile(
      "samples/m12-exchange/assembled.glb",
      path.join(root, "model.glb"),
    );
    await fs.copyFile(
      "samples/m12-exchange/assembled.fbx",
      path.join(root, "model.fbx"),
    );
    await fs.writeFile(path.join(root, "model.xhmaterials.json"), "sidecar");
    await fs.mkdir(path.join(root, "model.xhtextures"));
    await fs.writeFile(
      path.join(root, "model.xhtextures/p.png"),
      Buffer.from([1, 2, 3]),
    );
    const m = createMap();
    m.cells = [{ x: 0, y: 0, z: -1, color: 0 }];
    m.instances = [{ id: "i", assetId: "a", x: 0, y: 0, z: 0, rotation: 0 }];
    const catalog = {
        store: new FileStore(root),
        get: () => ({ type: "glb", path: "model.glb", anchor: [0, 0, 0] }),
      },
      r = await resolveLegacyAssets(
        JSON.stringify(m),
        catalog,
        core,
        validateMap,
      ),
      a = r.assets.get("a");
    assert.deepEqual(r.issues, []);
    assert.equal(a.recipe, "blender-fbx-5.1.2");
    assert.ok(
      a.files.some(
        (f) =>
          f.path === "model.xhmaterials.json" &&
          Buffer.from(f.bytes).toString() === "sidecar",
      ),
    );
    assert.ok(
      a.files.some(
        (f) =>
          f.path === "model.xhtextures/p.png" &&
          Buffer.from(f.bytes).equals(Buffer.from([1, 2, 3])),
      ),
    );
  } finally {
    if (
      !path
        .resolve(root)
        .startsWith(path.resolve("validation/legacy-resolver-"))
    )
      throw Error("unsafe cleanup");
    await fs.rm(root, { recursive: true, force: true });
  }
});
