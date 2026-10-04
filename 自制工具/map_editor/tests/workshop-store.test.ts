import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire(import.meta.url);
let module: any = {};
try {
  module = require("../desktop/workshop-store.cjs");
} catch (error) {
  if (
    error.code !== "MODULE_NOT_FOUND" ||
    !error.message.includes("workshop-store.cjs")
  )
    throw error;
}
const bytes = (text: string) => new TextEncoder().encode(text);
async function fixture(run: (root: string, store: any) => Promise<void>) {
  assert.equal(
    typeof module.createWorkshopStore,
    "function",
    "Task2 must implement project transaction store",
  );
  const root = await fs.mkdtemp(path.resolve("validation/workshop-store-"));
  try {
    await run(root, module.createWorkshopStore(root));
  } finally {
    assert.ok(
      path
        .relative(path.resolve("validation"), root)
        .startsWith("workshop-store-"),
    );
    await fs.rm(root, { recursive: true, force: true });
  }
}
test("project, scene and empty draft commit and reopen as one file group", () =>
  fixture(async (root, store) => {
    const files = [
      "project.xhproject.json",
      "scenes/s/scene.xhscene.json",
      "scenes/s/assets/a.xhmodule.json",
    ];
    const result = await store.commit(
      files.map((file, i) => ({
        path: file,
        bytes: bytes(`source-${i}`),
        expectedHash: null,
      })),
    );
    assert.equal(result.files.length, 3);
    for (const [i, file] of files.entries()) {
      const opened = await module.createWorkshopStore(root).load(file);
      assert.equal(new TextDecoder().decode(opened.bytes), `source-${i}`);
      assert.equal(opened.hash, result.files.find((x) => x.path === file).hash);
    }
  }));
test("external modification prevents every member of the transaction", () =>
  fixture(async (root, store) => {
    await store.commit([
      { path: "a.json", bytes: bytes("a"), expectedHash: null },
      { path: "b.json", bytes: bytes("b"), expectedHash: null },
    ]);
    const a = await store.load("a.json"),
      b = await store.load("b.json");
    await fs.writeFile(path.join(root, "b.json"), "external");
    await assert.rejects(() =>
      store.commit([
        { path: "a.json", bytes: bytes("new-a"), expectedHash: a.hash },
        { path: "b.json", bytes: bytes("new-b"), expectedHash: b.hash },
      ]),
    );
    assert.equal(
      new TextDecoder().decode((await store.load("a.json")).bytes),
      "a",
    );
    assert.equal(
      new TextDecoder().decode((await store.load("b.json")).bytes),
      "external",
    );
  }));
test("new path intent cannot overwrite an existing empty file", () =>
  fixture(async (root, store) => {
    await fs.writeFile(path.join(root, "a.json"), "");
    await assert.rejects(() =>
      store.commit([
        { path: "a.json", bytes: bytes("new"), expectedHash: null },
      ]),
    );
    assert.equal(await fs.readFile(path.join(root, "a.json"), "utf8"), "");
  }));
test("unsafe, duplicate case paths and excessive file sizes are rejected before writes", () =>
  fixture(async (root, store) => {
    for (const target of [
      "../outside.json",
      "C:/outside.json",
      "a.json:stream",
      "a\\b.json",
      "CON.json",
      ".workshop-txn/fake.json",
    ]) {
      await assert.rejects(() =>
        store.commit([
          { path: target, bytes: bytes("new"), expectedHash: null },
        ]),
      );
    }
    await assert.rejects(() =>
      store.commit([
        { path: "A.json", bytes: bytes("a"), expectedHash: null },
        { path: "a.json", bytes: bytes("b"), expectedHash: null },
      ]),
    );
    await assert.rejects(() =>
      store.commit([
        {
          path: "huge.json",
          bytes: new Uint8Array(64 * 1024 * 1024 + 1),
          expectedHash: null,
        },
      ]),
    );
    assert.deepEqual(
      (await fs.readdir(root)).filter((x) => x !== ".workshop-txn"),
      [],
    );
  }));
test("symlink directory cannot become a new document destination", () =>
  fixture(async (root, store) => {
    const outside = await fs.mkdtemp(
      path.resolve("validation/workshop-outside-"),
    );
    try {
      await fs.symlink(outside, path.join(root, "linked"), "junction");
      await assert.rejects(() =>
        store.commit([
          { path: "linked/a.json", bytes: bytes("escape"), expectedHash: null },
        ]),
      );
      assert.deepEqual(await fs.readdir(outside), []);
    } finally {
      await fs.unlink(path.join(root, "linked"));
      await fs.rm(outside, { recursive: true, force: true });
    }
  }));
test("separate process interruption restores partial files on next recovery", () =>
  fixture(async (root, store) => {
    await store.commit([
      { path: "a.json", bytes: bytes("old"), expectedHash: null },
    ]);
    const originalHash = (await store.load("a.json")).hash;
    const script = path.resolve("tests/workshop-store-child.mjs");
    const exit = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, [script, root], {
        windowsHide: true,
        stdio: "pipe",
      });
      child.on("error", reject);
      child.on("exit", resolve);
    });
    assert.equal(exit, 23);
    const recoveryExit = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(process.execPath, [script, root, "recover"], {
        windowsHide: true,
        stdio: "pipe",
      });
      child.on("error", reject);
      child.on("exit", resolve);
    });
    assert.equal(recoveryExit, 0);
    assert.equal(
      new TextDecoder().decode((await store.load("a.json")).bytes),
      "old",
    );
    assert.equal((await store.load("a.json")).hash, originalHash);
    await assert.rejects(() => store.load("b.json"));
    await assert.rejects(() => store.load("c.json"));
  }));
test("failed second rename rolls back existing source and removes new registrations", () =>
  fixture(async (root, store) => {
    await store.commit([
      { path: "a.json", bytes: bytes("old"), expectedHash: null },
    ]);
    const opened = await store.load("a.json"),
      rename = fs.rename;
    try {
      fs.rename = async (from, to) => {
        if (to === path.join(root, "b.json"))
          throw Error("injected second rename failure");
        return rename(from, to);
      };
      await assert.rejects(() =>
        store.commit([
          { path: "a.json", bytes: bytes("new"), expectedHash: opened.hash },
          { path: "b.json", bytes: bytes("created"), expectedHash: null },
          { path: "c.json", bytes: bytes("unregistered"), expectedHash: null },
        ]),
      );
    } finally {
      fs.rename = rename;
    }
    assert.equal(
      new TextDecoder().decode((await store.load("a.json")).bytes),
      "old",
    );
    await assert.rejects(() => store.load("b.json"));
    await assert.rejects(() => store.load("c.json"));
  }));
test("staging-time external modification is preserved and recovery refuses ambiguous bytes", () =>
  fixture(async (root, store) => {
    await store.commit([
      { path: "a.json", bytes: bytes("old"), expectedHash: null },
    ]);
    const opened = await store.load("a.json"),
      open = fs.open;
    try {
      fs.open = async (...args) => {
        const handle = await open(...args);
        if (String(args[0]).endsWith("journal.json"))
          await fs.writeFile(path.join(root, "a.json"), "external-race");
        return handle;
      };
      await assert.rejects(() =>
        store.commit([
          { path: "a.json", bytes: bytes("new"), expectedHash: opened.hash },
        ]),
      );
    } finally {
      fs.open = open;
    }
    assert.equal(
      await fs.readFile(path.join(root, "a.json"), "utf8"),
      "external-race",
    );
    await assert.rejects(() => store.recover(), /恢复冲突/);
  }));
test("external modification during recovery preflight is not deleted", () =>
  fixture(async (root, store) => {
    await store.commit([
      { path: "a.json", bytes: bytes("old"), expectedHash: null },
    ]);
    const exit = await new Promise<number | null>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [path.resolve("tests/workshop-store-child.mjs"), root],
        { windowsHide: true, stdio: "pipe" },
      );
      child.on("error", reject);
      child.on("exit", resolve);
    });
    assert.equal(exit, 23);
    const readFile = fs.readFile;
    let injected = false;
    try {
      fs.readFile = async (...args) => {
        const result = await readFile(...args);
        if (args[0] === path.join(root, "b.json") && !injected) {
          injected = true;
          await fs.writeFile(args[0], "external-during-recovery");
        }
        return result;
      };
      await assert.rejects(() => store.recover(), /恢复冲突/);
    } finally {
      fs.readFile = readFile;
    }
    assert.equal(
      await fs.readFile(path.join(root, "b.json"), "utf8"),
      "external-during-recovery",
    );
  }));
