import { _electron as electron } from "playwright";
import { createMap } from "../core/document.ts";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve("validation/migration-tests");
await fs.mkdir(root, { recursive: true });
const oldFile = path.join(root, "旧地图.json"), newFile = path.join(root, "旧地图-迁移副本.json");
const old = createMap();
old.cells = [{ x: 0, y: 0, z: -1, color: 0, owner: "height" }];
old.surfaces = [{ x: 0, y: 0, z: 0, face: 4, tag: "deploy" }];
await fs.writeFile(oldFile, JSON.stringify(old));
const app = await electron.launch({ args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe" });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await app.evaluate(({ dialog }, { oldFile, newFile }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [oldFile] });
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: newFile });
  }, { oldFile, newFile });
  await page.locator("#open").click();
  await page.locator("#migrate-tags:visible").waitFor();
  await page.locator("#migrate-tags").click();
  await page.getByText(/已另存 旧地图-迁移副本.json/).waitFor();
  const original = JSON.parse(await fs.readFile(oldFile, "utf8"));
  const migrated = JSON.parse(await fs.readFile(newFile, "utf8"));
  assert.equal(original.surfaces[0].tag, "deploy");
  assert.equal(migrated.surfaces[0].tag, "walk");
  assert.equal(migrated.mapId, original.mapId);
  assert.equal(migrated.revision, original.revision + 1);
  assert.deepEqual(errors, []);
  console.log("M11_MIGRATION_UI_PASS");
} finally { await app.evaluate(({ app }) => app.exit(0)); }
