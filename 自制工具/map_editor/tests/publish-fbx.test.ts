import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createAsset, createScene } from "../core/workshop-documents.ts";
import { createPublishPlan, sha256 } from "../core/publish.ts";
import { exportAssetGlb } from "../core/workshop-glb.ts";
const require = createRequire(import.meta.url),
  { commitPublish, listPublishes } = require("../desktop/publish-store.cjs");
let api: any = {};
try {
  api = require("../desktop/publish-fbx.cjs");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") throw e;
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR4nGN4ppHyH4QZYAwAVugJxfB+DTwAAAAASUVORK5CYII=",
  "base64",
);
async function fixture() {
  const a = createAsset("a");
  a.cells = [{ x: 0, y: 1, z: 2, color: 0 }];
  const glb = exportAssetGlb(a),
    s = createScene("s"),
    assets = new Map<string, any>();
  for (const id of ["e1", "e2"]) {
    const model = `external/${id}/model.glb`;
    s.assets.push({
      kind: "external",
      assetId: id,
      revision: 0,
      model,
      files: [model],
      anchorM: [0, 0, 0],
      recipe: "glb-rh-y-up",
    });
    assets.set(id, {
      kind: "external",
      revision: 0,
      anchorM: [0, 0, 0],
      recipe: "glb-rh-y-up",
      glb,
      files: [{ path: model, bytes: glb, sha256: await sha256(glb) }],
    });
    for (let i = 0; i < 3; i++)
      s.instances.push({
        instanceId: `${id}-${i}`,
        assetId: id,
        positionM: [i, -i, 0],
        rotationDeg: i * 90,
        groupId: "base",
      });
  }
  const root = await fs.mkdtemp(path.resolve("validation/publish-fbx-test-")),
    plan = await createPublishPlan(
      { kind: "scene", document: s, assets },
      "fbx-scene",
      "glb-fbx",
      { workshopVersion: "test", sourceFingerprint: "a".repeat(64) },
    );
  return { root, plan };
}
async function cleanup(root: string) {
  if (
    !path.resolve(root).startsWith(path.resolve("validation/publish-fbx-test-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}
async function runner(input: string, output: string) {
  const bytes = Buffer.alloc(64);
  bytes.write("Kaydara FBX Binary  \0\x1a\0");
  await fs.writeFile(output, bytes);
  const stem = output.slice(0, -4),
    dir = stem + ".xhtextures";
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "color.png"), png);
  await fs.writeFile(
    stem + ".xhmaterials.json",
    JSON.stringify({
      schema: "xinghai-fbx-materials-1",
      colors: [
        {
          colorId: "stone",
          baseColorTexturePath: path.basename(dir) + "/color.png",
        },
      ],
      textureDependencies: [path.basename(dir) + "/color.png"],
    }),
  );
}
test("shared embedded images listed more than once freeze as one physical texture dependency per group", async () => {
  const { root, plan } = await fixture();
  try {
    const published = await commitPublish(root, plan, {
      converter: (stage, m, signal) =>
        api.convertPublishFbx(stage, m, {
          blenderExecutable: "test-runner",
          blenderVersion: "5.1.2",
          signal,
          runner: async (input, output) => {
            await runner(input, output);
            const file = output.slice(0, -4) + ".xhmaterials.json",
              json = JSON.parse(await fs.readFile(file, "utf8"));
            json.textureDependencies.push(json.textureDependencies[0]);
            await fs.writeFile(file, JSON.stringify(json));
          },
        }),
    });
    const m = JSON.parse(
      await fs.readFile(
        path.join(published.directory, "manifest.json"),
        "utf8",
      ),
    );
    assert.ok(
      m.dependencies
        .filter((d) => d.kind === "external")
        .every((d) => d.unity.texturePaths.length === 1),
    );
    assert.equal(
      new Set(m.outputFiles.map((f) => f.path)).size,
      m.outputFiles.length,
    );
  } finally {
    await cleanup(root);
  }
});
test("FBX recipe creates target plus per-external asset groups, binds six instances by two stable identities and hashes every generated file", async () => {
  const { root, plan } = await fixture();
  try {
    const published = await commitPublish(root, plan, {
        converter: (stage, m, signal) =>
          api.convertPublishFbx(stage, m, {
            blenderExecutable: "test-runner",
            blenderVersion: "5.1.2",
            runner,
            signal,
          }),
      }),
      manifest = JSON.parse(
        await fs.readFile(
          path.join(published.directory, "manifest.json"),
          "utf8",
        ),
      );
    assert.ok(manifest.outputFiles.some((f) => f.path === "output/target.fbx"));
    assert.equal(manifest.dependencies.length, 2);
    for (const d of manifest.dependencies) {
      assert.equal(d.unity.route, "fbx");
      assert.equal(
        d.unity.modelPath,
        `output/assets/${d.assetId}/${d.assetId}.fbx`,
      );
      assert.equal(d.unity.texturePaths.length, 1);
      assert.equal(
        d.contentHash,
        plan.manifest.dependencies.find((p) => p.assetId === d.assetId)
          .contentHash,
      );
    }
    for (const f of manifest.outputFiles)
      assert.equal(
        await sha256(await fs.readFile(path.join(published.directory, f.path))),
        f.sha256,
      );
    assert.equal((await listPublishes(root)).length, 1);
  } finally {
    await cleanup(root);
  }
});
test("missing FBX, sidecar, texture and escaping sidecar dependencies refuse the whole package", async () => {
  for (const kind of ["fbx", "sidecar", "texture", "escape"]) {
    const { root, plan } = await fixture();
    try {
      await assert.rejects(() =>
        commitPublish(root, plan, {
          converter: (stage, m, signal) =>
            api.convertPublishFbx(stage, m, {
              blenderExecutable: "test-runner",
              blenderVersion: "5.1.2",
              signal,
              runner: async (input, output) => {
                await runner(input, output);
                const stem = output.slice(0, -4);
                if (kind === "fbx") await fs.unlink(output);
                if (kind === "sidecar")
                  await fs.unlink(stem + ".xhmaterials.json");
                if (kind === "texture")
                  await fs.unlink(path.join(stem + ".xhtextures", "color.png"));
                if (kind === "escape")
                  await fs.writeFile(
                    stem + ".xhmaterials.json",
                    JSON.stringify({
                      schema: "xinghai-fbx-materials-1",
                      colors: [],
                      textureDependencies: ["../../escape.png"],
                    }),
                  );
              },
            }),
        }),
      );
      assert.equal((await listPublishes(root)).length, 0);
    } finally {
      await cleanup(root);
    }
  }
});
test("timeout waits for late runner completion and then cleans staging without publishing late results", async () => {
  const { root, plan } = await fixture();
  try {
    await assert.rejects(
      () =>
        commitPublish(root, plan, {
          converter: (stage, m, signal) =>
            api.convertPublishFbx(stage, m, {
              blenderExecutable: "test-runner",
              blenderVersion: "5.1.2",
              signal,
              timeoutMs: 5,
              runner: async (input, output) => {
                await new Promise((r) => setTimeout(r, 20));
                await runner(input, output);
              },
            }),
        }),
      /超时/,
    );
    assert.equal((await listPublishes(root)).length, 0);
    assert.equal(
      (await fs.readdir(path.join(root, "releases"))).some((n) =>
        n.startsWith(".staging-"),
      ),
      false,
    );
  } finally {
    await cleanup(root);
  }
});
test("a converter returning unchanged GLB manifest cannot claim a successful FBX recipe", async () => {
  const { root, plan } = await fixture();
  try {
    await assert.rejects(
      () => commitPublish(root, plan, { converter: async (stage, m) => m }),
      /FBX|绑定|缺少/,
    );
    assert.equal((await listPublishes(root)).length, 0);
  } finally {
    await cleanup(root);
  }
});
test("nonzero child process and cancellation never commit a package or overwrite a prior valid version", async () => {
  const { root, plan } = await fixture();
  try {
    const prior = structuredClone(plan);
    prior.manifest.publishId = "old";
    prior.manifest.recipe = "glb-only";
    const saved = await commitPublish(root, prior),
      before = await fs.readFile(path.join(saved.directory, "manifest.json"));
    await assert.rejects(
      () =>
        commitPublish(root, plan, {
          converter: (stage, m, signal) =>
            api.convertPublishFbx(stage, m, {
              blenderExecutable: process.execPath,
              blenderVersion: "5.1.2",
              signal,
              runner: api.blenderRunner,
            }),
        }),
      /Blender转换失败/,
    );
    const controller = new AbortController();
    await assert.rejects(
      () =>
        commitPublish(root, plan, {
          signal: controller.signal,
          converter: (stage, m, signal) =>
            api.convertPublishFbx(stage, m, {
              blenderExecutable: "test-runner",
              blenderVersion: "5.1.2",
              signal,
              runner: async (input, output) => {
                controller.abort();
                await new Promise((r) => setTimeout(r, 15));
                await runner(input, output);
              },
            }),
        }),
      /取消|abort/i,
    );
    assert.equal((await listPublishes(root)).length, 1);
    assert.deepEqual(
      await fs.readFile(path.join(saved.directory, "manifest.json")),
      before,
    );
  } finally {
    await cleanup(root);
  }
});
