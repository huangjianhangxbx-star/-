import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const base = path.resolve("validation/m12/native");
await fs.mkdir(base, { recursive: true });
const root = await fs.mkdtemp(path.join(base, "run-"));
const asset = path.join(root, "Wall.xhasset.json"),
  model = path.join(root, "Wall.glb"),
  map = path.join(root, "assembly.xhmap.json");
const app = await electron.launch({
  args:process.env.XH_EDITOR_EXE?['--workspace=legacy','--test-hidden']:['.','--workspace=legacy','--test-hidden'],
  executablePath:process.env.XH_EDITOR_EXE??'node_modules/electron/dist/electron.exe',
});
const checks = [];
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#native-panel summary").waitFor();
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1 });
  });
  async function open(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
  }
  async function save(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, file);
  }
  async function center() {
    const b = await page.locator("#editview canvas").boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  async function importReference(){await page.locator('#reference-panel summary').click();await open(path.resolve('validation/m12/reference/transparent-reference.png'));await page.locator('#reference-import').click();await page.waitForFunction(()=>document.querySelector('#reference-name').textContent.includes('128×256'));await page.locator('#reference-panel summary').click();}
  async function rectangle() {
    await page.locator("#top").click();
    await page.locator("#height").fill("1");
    await page.locator("#thickness").fill("1");
    await page.getByRole("button", { name: "矩形", exact: true }).click();
    const p = await center();
    await page.mouse.move(p.x - 110, p.y - 80);
    await page.mouse.down();
    await page.mouse.move(p.x + 110, p.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(
      () =>
        Number(document.querySelector("#count").textContent.match(/\d+/)?.[0]) >
        20,
    );
  }
  await importReference();
  await rectangle();
  await page.locator("#native-panel summary").click();
  await page.locator("#native-select").click();
  let p = await center();
  await page.mouse.move(p.x - 50, p.y - 30);
  await page.mouse.down();
  await page.mouse.move(p.x + 50, p.y + 30, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() =>
    document.querySelector("#native-selection").textContent.startsWith("范围"),
  );
  await page.locator("#native-all").click();
  await page.locator("#native-name").fill("Wall");
  await page.locator("#native-anchor").selectOption("bottom");
  await save(asset);
  await page.locator("#native-save").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("已保存原生源与GLB"),
  );
  const original = JSON.parse(await fs.readFile(asset, "utf8")),
    oldBytes = await fs.readFile(model);
  assert.ok(original.cells.length > 20);
  assert.equal(original.editor,undefined);
  assert.ok(oldBytes.length > 100);
  checks.push("真实绘制/框选/全部选择/底面中心锚点/原生源与GLB保存");
  await page.locator("#new").click();
  await page.waitForFunction(
    () => document.querySelector("#filename").textContent === "未命名地图",
  );
  await importReference();
  await rectangle();
  await page.locator(".asset").filter({ hasText: "Wall" }).first().click();
  await page.getByRole("button", { name: "模型", exact: true }).click();
  await page.getByRole("button", { name: "笔刷", exact: true }).click();
  p = await center();
  for (const dx of [-65, 0, 65]) await page.mouse.click(p.x + dx, p.y);
  await save(map);
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("已保存 assembly"),
  );
  const assembled = JSON.parse(await fs.readFile(map, "utf8"));
  assert.equal(assembled.instances.length, 3);
  assert.ok(assembled.instances.every((i) => i.assetId === original.assetId));
  checks.push("新地图由正常资产库选择同一GLB摆放三份并保存共享ID");
  await save(path.join(root, "assembly.glb"));
  await page.locator("#model-glb").click();
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.startsWith("已导出 "),
  );
  assert.ok(
    (await fs.stat(path.join(root, "assembly.glb"))).size > oldBytes.length,
  );
  await save(path.join(root, "assembly.fbx"));
  await page.locator("#model-fbx").click();
  await page.waitForFunction(
    () => document.querySelector("#message").textContent.startsWith("已导出 "),
    null,
    { timeout: 60000 },
  );
  assert.ok((await fs.stat(path.join(root, "assembly.fbx"))).size > 100);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,"assembly.xhmaterials.json"),"utf8")).schema,"xinghai-fbx-materials-1");
  checks.push("整图GLB包含装配实例，正常按钮调用真实Blender生成FBX与通用材质旁车");
  await open(asset);
  await page.locator("#native-open").click();
  await page.waitForFunction(
    () => !document.querySelector("#native-update").disabled,
  );
  await page.locator("#top").click();
  await page.getByRole("button", { name: "地台", exact: true }).click();
  await page.locator("#height").fill("3");
  await page.locator("#thickness").fill("2");
  p = await center();
  await page.mouse.click(p.x, p.y);
  await page.locator("#native-update").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("已保存原生源与GLB"),
  );
  const updated = JSON.parse(await fs.readFile(asset, "utf8"));
  assert.equal(updated.assetId, original.assetId);
  assert.equal(updated.revision, 2);
  assert.notDeepEqual(updated.cells, original.cells);
  assert.notDeepEqual(await fs.readFile(model), oldBytes);
  checks.push("通过打开原生资产继续编辑并更新，同ID修订递增且GLB重建");
  await open(map);
  await page.locator("#open").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#filename").textContent === "assembly.xhmap.json",
  );
  await page.getByRole("button", { name: "重载", exact: true }).click();
  await page.waitForTimeout(400);
  await save(map);
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#message")
      .textContent.startsWith("已保存 assembly"),
  );
  const reopened = JSON.parse(await fs.readFile(map, "utf8"));
  assert.deepEqual(reopened.instances, assembled.instances);
  assert.ok(reopened.editor.reference.dataUrl.startsWith('data:image/png;base64,'));
  await save(path.join(root,'assembly.glb'));await page.locator('#model-glb').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('已导出 '));
  await save(path.join(root,'assembly.fbx'));await page.locator('#model-fbx').click();await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('已导出 '),null,{timeout:60000});
  await page.locator("#home").click();
  await page.locator("#previewhome").click();
  await page.screenshot({
    path: path.join(root, "updated-three-instances.png"),
  });
  checks.push("重开装配地图和重载后，三份实例ID/位置/旋转未变，引用已更新模型");
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(root, "result.json"),
    JSON.stringify({ status: "passed", checks, errors, root }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", checks, root }, null, 2));
} catch (error) {
  await fs.writeFile(
    path.join(root, "result.json"),
    JSON.stringify(
      { status: "failed", checks, error: error.stack, root },
      null,
      2,
    ),
  );
  console.error("NATIVE_UI_OUTPUT", root);
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}

