import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { createAsset } from "../core/workshop-documents.ts";
import { createPublishPlan, sha256 } from "../core/publish.ts";
let api: any = {};
try {
  api = createRequire(import.meta.url)("../desktop/publish-store.cjs");
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") throw e;
}
async function plan(
  id = "publish-a",
  recipe: "glb-only" | "glb-fbx" = "glb-only",
) {
  const a = createAsset("a");
  a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
  return createPublishPlan({ kind: "asset", document: a }, id, recipe, {
    workshopVersion: "test",
    sourceFingerprint: "a".repeat(64),
  });
}
async function root() {
  return fs.mkdtemp(path.resolve("validation/workshop-publish-store-"));
}
async function cleanup(root: string) {
  if (
    !path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-publish-store-"))
  )
    throw Error("unsafe cleanup");
  await fs.rm(root, { recursive: true, force: true });
}

test("a committed package uses the designed releases directory", async () => {
  const r = await root();
  try {
    const saved = await api.commitPublish(r, await plan());
    assert.equal(saved.directory, path.join(r, "releases", "publish-a"));
  } finally {
    await cleanup(r);
  }
});
test("process interruption is never listed as a valid version and dead-owner staging recovers before retry", async () => {
  const r = await root();
  try {
    await api.commitPublish(r, await plan("old"));
    const exit = await new Promise((resolve) =>
      execFile(
        process.execPath,
        ["tests/publish-interrupt-child.mjs", r],
        { timeout: 10000 },
        (err) => resolve(err?.code),
      ),
    );
    assert.equal(exit, 73);
    assert.equal((await api.listPublishes(r)).length, 1);
    const retried = await api.commitPublish(r, await plan("interrupted"));
    assert.equal(retried.publishId, "interrupted");
    assert.equal((await api.listPublishes(r)).length, 2);
    assert.equal(
      (await fs.readdir(path.join(r, "releases"))).some((n) =>
        n.startsWith(".staging-"),
      ),
      false,
    );
  } finally {
    await cleanup(r);
  }
});
test("rehashed files cannot forge frozen content bindings or inject editor metadata into runtime payload", async () => {
  const r = await root();
  try {
    const forged = await plan("forged");
    forged.manifest.dependencies[0].contentHash = "f".repeat(64);
    await assert.rejects(
      () => api.commitPublish(r, forged),
      /contentHash|绑定/,
    );
    const editor = await plan("editor"),
      runtime = editor.files.find(
        (f) => f.path === editor.manifest.runtimePath,
      );
    const value = JSON.parse(new TextDecoder().decode(runtime.bytes));
    value.editor = { reference: "unexpected" };
    runtime.bytes = new TextEncoder().encode(JSON.stringify(value));
    runtime.sha256 = await sha256(runtime.bytes);
    const row = editor.manifest.payloadFiles.find(
      (f) => f.path === runtime.path,
    );
    row.sha256 = runtime.sha256;
    row.byteLength = runtime.bytes.length;
    await assert.rejects(
      () => api.commitPublish(r, editor),
      /runtime|制作参考|冻结/,
    );
    assert.equal((await api.listPublishes(r)).length, 0);
  } finally {
    await cleanup(r);
  }
});
test("immutable publish A and B commit to distinct directories, validate hashes and refuse existing identity", async () => {
  const r = await root();
  try {
    const p = await plan(),
      a = await api.commitPublish(r, p),
      bytes = await fs.readFile(path.join(a.directory, "output/target.glb"));
    p.files.find((f) => f.path === "output/target.glb").bytes[0] = 0;
    assert.deepEqual(
      await fs.readFile(path.join(a.directory, "output/target.glb")),
      bytes,
    );
    await assert.rejects(
      async () => api.commitPublish(r, await plan()),
      /存在/,
    );
    const b = await api.commitPublish(r, await plan("publish-b"));
    assert.notEqual(b.directory, a.directory);
    assert.equal((await api.listPublishes(r)).length, 2);
    assert.deepEqual(
      await fs.readFile(path.join(a.directory, "output/target.glb")),
      bytes,
    );
  } finally {
    await cleanup(r);
  }
});
function awaitable(p: any) {
  return p;
}
test("damaged hashes, escaping paths and missing closure reject before a valid package exists", async () => {
  const r = await root();
  try {
    const bad = await plan();
    bad.files[0].bytes[0] ^= 1;
    await assert.rejects(() => api.commitPublish(r, bad), /hash/);
    const escape = await plan();
    escape.files[0].path = "../escape";
    await assert.rejects(() => api.commitPublish(r, escape), /路径|闭包/);
    const missing = await plan();
    missing.files.pop();
    await assert.rejects(() => api.commitPublish(r, missing), /闭包|缺/);
    assert.deepEqual(await api.listPublishes(r), []);
  } finally {
    await cleanup(r);
  }
});
test("input changes and cancellation never produce a valid package; glb-only does not invoke converter", async () => {
  const r = await root();
  try {
    await fs.writeFile(path.join(r, "source.json"), "one");
    const p = await plan();
    p.expectedInputs = [
      {
        path: "source.json",
        sha256: await sha256(new TextEncoder().encode("one")),
      },
    ];
    await fs.writeFile(path.join(r, "source.json"), "two");
    await assert.rejects(() => api.commitPublish(r, p), /输入|修改/);
    const c = new AbortController();
    c.abort();
    await assert.rejects(
      async () =>
        api.commitPublish(r, await plan("cancelled"), { signal: c.signal }),
      /取消|abort/i,
    );
    let calls = 0;
    await api.commitPublish(r, await plan("good"), {
      converter: async () => {
        calls++;
        throw Error("wrong branch");
      },
    });
    assert.equal(calls, 0);
    assert.equal((await api.listPublishes(r)).length, 1);
  } finally {
    await cleanup(r);
  }
});
test("failed FBX conversion leaves prior package unchanged and abandoned staging is excluded from history", async () => {
  const r = await root();
  try {
    const first = await api.commitPublish(r, await plan("old")),
      before = await fs.readFile(path.join(first.directory, "manifest.json"));
    await assert.rejects(
      async () =>
        api.commitPublish(r, await plan("new", "glb-fbx"), {
          converter: async () => {
            throw Error("conversion failed");
          },
        }),
      /conversion failed/,
    );
    await fs.mkdir(path.join(r, "releases", ".staging-abandoned"));
    await fs.writeFile(
      path.join(r, "releases", ".staging-abandoned/manifest.json"),
      "{}",
    );
    assert.equal((await api.listPublishes(r)).length, 1);
    assert.deepEqual(
      await fs.readFile(path.join(first.directory, "manifest.json")),
      before,
    );
  } finally {
    await cleanup(r);
  }
});
test("a later real filesystem output failure cleans staging and preserves the prior version", async () => {
  const r = await root();
  try {
    const old = await api.commitPublish(r, await plan("old")),
      before = await fs.readFile(path.join(old.directory, "manifest.json")),
      p = await plan("broken-write"),
      bytes = new Uint8Array([1]),
      file = "output/" + "x".repeat(260) + ".bin",
      sha = await sha256(bytes);
    p.files.push({ path: file, bytes, sha256: sha });
    p.manifest.outputFiles.push({ path: file, sha256: sha, byteLength: 1 });
    await assert.rejects(() => api.commitPublish(r, p));
    assert.equal((await api.listPublishes(r)).length, 1);
    assert.deepEqual(
      await fs.readFile(path.join(old.directory, "manifest.json")),
      before,
    );
    assert.equal(
      (await fs.readdir(path.join(r, "releases"))).some((n) =>
        n.startsWith(".staging-"),
      ),
      false,
    );
  } finally {
    await cleanup(r);
  }
});
test("a transient Windows rename lock retries boundedly and still commits one immutable package", async (t) => {
  const r = await root(),
    rename = fs.rename.bind(fs);
  let locked = true;
  t.mock.method(fs, "rename", async (from, to) => {
    if (locked && String(from).includes(".staging-")) {
      locked = false;
      throw Object.assign(Error("file temporarily locked"), { code: "EPERM" });
    }
    return rename(from, to);
  });
  try {
    const published = await api.commitPublish(r, await plan("retry"));
    assert.equal((await api.listPublishes(r)).length, 1);
    assert.ok(
      (await fs.stat(path.join(published.directory, "manifest.json"))).isFile(),
    );
  } finally {
    t.mock.restoreAll();
    await cleanup(r);
  }
});
