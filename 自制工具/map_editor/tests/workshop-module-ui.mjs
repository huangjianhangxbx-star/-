import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = await fs.mkdtemp(path.resolve("validation/workshop-module-ui-"));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow();
  await page.addInitScript(() => {
    const metrics = (window.resourceMetrics = {
      workers: 0,
      observers: 0,
      createdWorkers: 0,
      createdObservers: 0,
      listeners: 0,
    });
    const WorkerBase = window.Worker,
      ObserverBase = window.ResizeObserver;
    window.Worker = class extends WorkerBase {
      constructor(...args) {
        super(...args);
        metrics.workers++;
        metrics.createdWorkers++;
      }
      terminate() {
        if (!this.ended) {
          this.ended = true;
          metrics.workers--;
        }
        super.terminate();
      }
    };
    window.ResizeObserver = class extends ObserverBase {
      constructor(...args) {
        super(...args);
        metrics.observers++;
        metrics.createdObservers++;
      }
      disconnect() {
        if (!this.ended) {
          this.ended = true;
          metrics.observers--;
        }
        super.disconnect();
      }
    };
    const add = EventTarget.prototype.addEventListener,
      remove = EventTarget.prototype.removeEventListener,
      registered = new WeakMap();
    EventTarget.prototype.addEventListener = function (type, fn, options) {
      const key =
        type +
        ":" +
        !!(typeof options === "boolean" ? options : options?.capture);
      let list = registered.get(this);
      if (!list) {
        list = [];
        registered.set(this, list);
      }
      if (!list.some((x) => x.key === key && x.fn === fn)) {
        list.push({ key, fn });
        metrics.listeners++;
      }
      return add.call(this, type, fn, options);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, options) {
      const key =
          type +
          ":" +
          !!(typeof options === "boolean" ? options : options?.capture),
        list = registered.get(this),
        i = list?.findIndex((x) => x.key === key && x.fn === fn) ?? -1;
      if (i >= 0) {
        list.splice(i, 1);
        metrics.listeners--;
      }
      return remove.call(this, type, fn, options);
    };
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  assert.equal(
    await page.locator("[data-workspace]").count(),
    4,
    "workshop must expose four real workspace entries",
  );
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  await page.getByLabel("笔刷范围 / 格", { exact: true }).fill("6");
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByText("体素 36", { exact: true }).waitFor();
  assert.equal(
    await page.locator("#native-select").isVisible(),
    true,
    "module selection must be available outside the Legacy export panel",
  );
  await page.locator("#native-all").click();
  await page
    .getByRole("button", { name: "复制选区为模块", exact: true })
    .click();
  await page.getByText("体素 36", { exact: true }).waitFor();
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const project = JSON.parse(
    await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
  );
  const scene = JSON.parse(
    await fs.readFile(path.join(root, project.scenes[0].source), "utf8"),
  );
  const file = path.join(
    root,
    path.dirname(project.scenes[0].source),
    scene.assets[0].source,
  );
  assert.equal(scene.assets.length, 2);
  assert.notEqual(scene.assets[0].assetId, scene.assets[1].assetId);
  const selectedCopy = JSON.parse(
    await fs.readFile(
      path.join(
        root,
        path.dirname(project.scenes[0].source),
        scene.assets[1].source,
      ),
      "utf8",
    ),
  );
  assert.equal(selectedCopy.cells.length, 36);
  assert.notEqual(
    selectedCopy.materialProfile.paletteId,
    JSON.parse(await fs.readFile(file, "utf8")).materialProfile.paletteId,
  );
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).cells.length, 36);
  await page.locator('[data-workspace="project"]').click();
  await page.locator('[data-action="edit-asset"]').first().click();
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.getByText("体素 0", { exact: true }).waitFor();
  await page.getByRole("button", { name: "重做", exact: true }).click();
  await page.getByText("体素 36", { exact: true }).waitFor();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#ed567a";
    g.fillRect(48, 48, 32, 160);
    return c.toDataURL("image/png");
  });
  const referenceFile = path.join(root, "reference.png");
  await fs.writeFile(referenceFile, Buffer.from(png.split(",")[1], "base64"));
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, referenceFile);
  await page.locator("#reference-panel summary").click();
  await page.locator("#reference-import").click();
  await page.waitForFunction(() =>
    document.querySelector("#reference-name").textContent.includes("128×256"),
  );
  await page.locator("#reference-height").fill("1.8");
  await page.locator("#reference-height").press("Tab");
  await page.locator("#brush-size").fill("1");
  await page.locator("#palette button").nth(1).click();
  await page.locator('[data-tool="repaint"]').click();
  const referenceBox = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(
    referenceBox.x + referenceBox.width / 2,
    referenceBox.y + referenceBox.height / 2,
  );
  await page.locator("#module-root").fill("0.25,-0.25,0");
  await page.locator("#module-root-apply").click();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const withReference = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(withReference.editor.reference.height, 1.8);
  assert.equal(withReference.editor.reference.contentTop, 48 / 256);
  assert.equal(withReference.editor.reference.contentBottom, 208 / 256);
  assert.deepEqual(withReference.anchorM, [0.25, -0.25, 0]);
  assert.ok(withReference.cells.some((c) => c.color === 1));
  assert.equal(withReference.cells.length, 36);
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  await page.getByText("体素 0", { exact: true }).waitFor();
  assert.equal(
    await page.locator("#reference-name").textContent(),
    "未导入参考",
  );
  assert.equal(await page.locator("#module-root").inputValue(), "0,0,0");
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator('[data-workspace="project"]').click();
  await page.locator('[data-action="edit-asset"]').first().click();
  await page.getByText("体素 36", { exact: true }).waitFor();
  await page.waitForTimeout(700);
  const baseline = await page.evaluate(() => ({ ...window.resourceMetrics }));
  const memoryBefore = JSON.parse(
    await page.locator("#quads").getAttribute("data-resources"),
  );
  for (let i = 0; i < 30; i++) {
    await page.locator('[data-workspace="project"]').click();
    await page.locator('[data-action="edit-asset"]').first().click();
  }
  for (let i = 0; i < 10; i++) {
    await page.locator("#close-module").click();
    await page.locator('[data-action="edit-asset"]').first().click();
  }
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({ ...window.resourceMetrics }));
  assert.equal(after.workers, 1);
  assert.equal(after.observers, 2);
  assert.equal(after.createdWorkers, baseline.createdWorkers);
  assert.equal(after.createdObservers, baseline.createdObservers);
  assert.ok(after.listeners <= baseline.listeners);
  const memoryAfter = JSON.parse(
    await page.locator("#quads").getAttribute("data-resources"),
  );
  for (let i = 0; i < 2; i++) {
    assert.equal(memoryAfter[i].geometry, memoryBefore[i].geometry);
    assert.equal(memoryAfter[i].textures, memoryBefore[i].textures);
  }
  assert.equal(await page.locator("#module-root").inputValue(), "0.25,-0.25,0");
  assert.equal(await page.locator("#reference-height").inputValue(), "1.8");
  const libraryRoot = path.join(root, "public");
  await fs.mkdir(libraryRoot);
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, libraryRoot);
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "选择公共库", exact: true }).click();
  await page
    .getByRole("button", { name: "登记到公共库", exact: true })
    .first()
    .click();
  await page.getByText("已登记独立公共副本", { exact: true }).waitFor();
  const catalog = JSON.parse(
    await fs.readFile(path.join(libraryRoot, ".xinghai-assets.json"), "utf8"),
  );
  assert.equal(catalog.assets.length, 1);
  const publicPath = path.join(libraryRoot, catalog.assets[0].path),
    publicBefore = await fs.readFile(publicPath, "utf8");
  assert.notEqual(JSON.parse(publicBefore).assetId, withReference.assetId);
  await page.locator('[data-workspace="project"]').click();
  await page
    .getByRole("button", { name: "取用到当前场景", exact: true })
    .click();
  await page.locator("#module-name").fill("私有修改");
  await page.locator("#module-name").press("Tab");
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  assert.equal(await fs.readFile(publicPath, "utf8"), publicBefore);
  const nativeBytes = await fs.readFile(
      "samples/m12-workflow/Wall.xhasset.json",
    ),
    native = JSON.parse(nativeBytes);
  await fs.copyFile(
    "samples/m12-workflow/Wall.glb",
    path.join(libraryRoot, "Wall.glb"),
  );
  await fs.writeFile(path.join(libraryRoot, "Wall.xhasset.json"), nativeBytes);
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "重载公共库", exact: true }).click();
  await page
    .getByRole("button", { name: "取用到当前场景", exact: true })
    .nth(1)
    .waitFor();
  await page
    .getByRole("button", { name: "取用到当前场景", exact: true })
    .nth(1)
    .click();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const updatedProject = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    ),
    updatedScene = JSON.parse(
      await fs.readFile(
        path.join(root, updatedProject.scenes[0].source),
        "utf8",
      ),
    );
  const taken = JSON.parse(
    await fs.readFile(
      path.join(
        root,
        path.dirname(updatedProject.scenes[0].source),
        updatedScene.assets.at(-1).source,
      ),
      "utf8",
    ),
  );
  assert.notEqual(taken.assetId, native.assetId);
  assert.deepEqual(taken.cells, native.cells);
  assert.deepEqual(taken.anchorM, native.anchor);
  assert.equal(
    await fs.readFile(path.join(libraryRoot, "Wall.xhasset.json"), "utf8"),
    nativeBytes.toString(),
  );
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.locator('[data-workspace="project"]').click();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  assert.equal(
    await page
      .locator("#project-workspace")
      .getByText("私有修改", { exact: true })
      .count(),
    1,
    "reopening project must retain names of unopened module sources",
  );
  await page.locator('[data-action="edit-asset"]').first().click();
  await page.getByText("体素 36", { exact: true }).waitFor();
  const resourceBefore = await page
    .locator("#quads")
    .getAttribute("data-resources");
  await page.locator("#module-root-pick").click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#module-root").inputValue(), "0.25,-0.25,0");
  assert.deepEqual(errors, []);
  await page.locator("#top").click();
  await page.locator("#module-root-pick").click();
  const pickBox = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(
    pickBox.x + pickBox.width / 2,
    pickBox.y + pickBox.height / 2,
  );
  assert.notEqual(
    await page.locator("#module-root").inputValue(),
    "0.25,-0.25,0",
  );
  await page.locator("#undo").click();
  assert.equal(await page.locator("#module-root").inputValue(), "0.25,-0.25,0");
  const savedBytes = await fs.readFile(file, "utf8");
  const external = JSON.parse(savedBytes);
  external.name = "外部修改";
  await fs.writeFile(file, JSON.stringify(external));
  await page.locator("#module-name").fill("洞壁校色样块");
  await page.locator("#module-name").press("Tab");
  await page.locator("#save-draft").click();
  await page.waitForFunction(() =>
    document
      .querySelector("#workshop-message")
      .textContent.includes("外部修改"),
  );
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).name, "外部修改");
  await fs.writeFile(file, savedBytes);
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.locator("#app aside").evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: "validation/workshop-task3/module.png" });
  await page.locator('[data-workspace="project"]').click();
  await page.screenshot({ path: "validation/workshop-task3/project.png" });
  await fs.writeFile(
    "validation/workshop-task3/electron-result.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "36格笔刷保存",
          "选区复制身份/色板独立",
          "切页撤销重做",
          "PNG有效范围/身高保存",
          "A/B Root/PNG隔离",
          "30次切换/10次关闭重开资源计数不增长",
          "公共登记与取用均独立副本",
          "真实M1.2 native取用为私有副本，原件不变",
          "项目重开",
          "Esc取消Root选点",
          "真实体素Root选点与撤销",
          "外部冲突保留字节并可重试",
        ],
        baseline,
        after,
        memoryBefore,
        memoryAfter,
        resources: resourceBefore,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_MODULE_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-module-ui-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
