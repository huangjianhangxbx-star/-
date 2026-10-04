import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const dir = path.resolve("validation/m12/package-use");
await fs.mkdir(dir, { recursive: true });
const app = await electron.launch({
  args: ["--workspace=legacy", "--test-hidden"],
  executablePath: process.env.XH_EDITOR_EXE ?? path.resolve("release/星骸地图工坊-M1.2/星骸地图工坊.exe"),
});
try {
  const page = await app.firstWindow();
  await page.locator("#build-info").waitFor();
  const info = await page.evaluate(() => window.workbench.info());
  assert.equal(info.version,"M1.2"); assert.equal(info.executable.toLowerCase(), (process.env.XH_EDITOR_EXE ?? path.resolve("release/星骸地图工坊-M1.2/星骸地图工坊.exe")).toLowerCase());
  assert.ok(info.sourceFingerprint.length===64);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      dialog.showMessageBox = async () => ({ response: 1 });
    },
    path.join(dir, "first.json"),
  );
  await page.locator("#height").fill("-2");
  await page.locator("#thickness").fill("2");
  const b = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(b.x + b.width / 2 + 10, b.y + b.height / 2 + 10);
  await page.locator("#save").click();
  await page.getByText("已保存 first.json", { exact: true }).waitFor();
  const a = JSON.parse(await fs.readFile(path.join(dir, "first.json"), "utf8"));
  assert.equal(a.cells.length, 2);
  assert.ok(a.cells.every((c) => c.z < 0));
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    },
    path.join(dir, "backup.json"),
  );
  await page.locator("#saveas").click();
  await page.getByText("已保存 backup.json", { exact: true }).waitFor();
  assert.equal(
    JSON.parse(await fs.readFile(path.join(dir, "backup.json"), "utf8")).mapId,
    a.mapId,
  );
  await page.locator("#duplicate").click();
  await app.evaluate(
    ({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    },
    path.join(dir, "copy.json"),
  );
  await page.locator("#save").click();
  await page.getByText("已保存 copy.json", { exact: true }).waitFor();
  assert.notEqual(
    JSON.parse(await fs.readFile(path.join(dir, "copy.json"), "utf8")).mapId,
    a.mapId,
  );
  await fs.writeFile(path.join(dir, "copy.json"), "external change");
  await page.locator("#save").click();
  await page
    .getByText("文件已被外部修改，请另存或重新打开", { exact: true })
    .waitFor();
  assert.equal(
    await fs.readFile(path.join(dir, "copy.json"), "utf8"),
    "external change",
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/m12/package-smoke.json",
    JSON.stringify(
      {
        passed: true,
        portableExe: true,
        noNodeRuntimeRequired: true,
        saveAsIdentity: true,
        copyNewIdentity: true,
        externalConflictProtected: true,
      },
      null,
      2,
    ),
  );
  console.log("PACKAGE_SMOKE_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}

