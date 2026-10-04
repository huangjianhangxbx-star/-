import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../dist/workshop.cjs");
const root = await fs.mkdtemp(path.resolve("validation/workshop-workflow-")),
  out = path.resolve("validation/workshop-task9"),
  library = path.join(root, "library");
await fs.mkdir(library, { recursive: true });
await fs.mkdir(out, { recursive: true });
const specs = [
    ["floor", "地面", 4, 4, 1],
    ["platform", "高台", 4, 4, 2],
    ["wall", "洞壁", 8, 1, 8],
    ["rock", "断崖", 3, 3, 4],
    ["lamp", "灯座", 1, 1, 5],
  ],
  publicSources = new Map();
for (const [id, name, w, h, height] of specs) {
  const a = core.createAsset("public-" + id);
  a.name = name;
  for (let z = 0; z < height; z++)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (id === "wall" && x >= 2 && x <= 5 && z < 5) continue;
        if (id === "rock" && x + y + z > 5) continue;
        a.cells.push({
          x,
          y,
          z: id === "floor" ? -1 : z,
          color: id === "lamp" ? 1 : 0,
          owner: "volume",
        });
      }
  if (id === "rock") {
    a.anchorM = [0.125, 0, 0.125];
    a.rootMode = "legacy";
  }
  const file = path.join(library, id + ".xhmodule.json"),
    bytes = Buffer.from(JSON.stringify(a));
  await fs.writeFile(file, bytes);
  publicSources.set(file, bytes);
}
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  assert.match(
    page.url(),
    /workshop\.html$/,
    "The default entry must be the real workshop",
  );
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setMenuBarVisibility(false);
    win.setContentSize(1440, 900);
  });
  async function pick(file) {
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, file);
  }
  async function save() {
    await page.locator("#save-draft").click();
    await page.getByText("草稿已保存", { exact: true }).waitFor();
  }
  await pick(root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await pick(library);
  await page.getByRole("button", { name: "选择公共库", exact: true }).click();
  for (const [id, name] of specs) {
    await page.locator('[data-workspace="project"]').click();
    const row = page.getByText(new RegExp("^" + id + " ·")).locator("..");
    await row
      .getByRole("button", { name: "取用到当前场景", exact: true })
      .click();
    await page.locator("#module-name").waitFor();
    assert.equal(await page.locator("#module-name").inputValue(), name);
    await save();
  }
  await page.locator("#module-tabs").selectOption({ label: "地面" });
  const reference = path.join(root, "reference.png");
  await fs.copyFile("samples/m12-exchange/neutral-colors.png", reference);
  await pick(reference);
  await page.locator("#reference-panel summary").click();
  await page.locator("#reference-import").click();
  await page.waitForFunction(() =>
    document.querySelector("#reference-name").textContent.includes("×"),
  );
  await page.locator('[data-mode="volume"]').click();
  await page.locator("#layer").fill("-1");
  await page.locator("#brush-size").fill("1");
  await page.locator("#palette button").nth(1).click();
  await page.locator('[data-tool="repaint"]').click();
  const box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator("#module-root").fill(".25,-.25,0");
  await page.locator("#module-root-apply").click();
  await save();
  const project = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    ),
    scenePath = path.join(root, project.scenes[0].source),
    scenePrefix = path.dirname(scenePath),
    initial = JSON.parse(await fs.readFile(scenePath, "utf8")),
    modules = new Map();
  for (const a of initial.assets) {
    const document = JSON.parse(
      await fs.readFile(path.join(scenePrefix, a.source), "utf8"),
    );
    modules.set(document.name, { row: a, document });
    assert.notEqual(
      a.assetId,
      "public-" + specs.find((s) => s[1] === document.name)[0],
    );
  }
  const floor = modules.get("地面");
  assert.ok(floor.document.editor.reference);
  assert.ok(
    floor.document.cells.some((c) => c.color === 1),
    "Real brush stroke must change copied source",
  );
  assert.deepEqual(floor.document.anchorM, [0.25, -0.25, 0]);
  await page.screenshot({ path: path.join(out, "module.png") });
  await page.locator('[data-workspace="project"]').click();
  await page.screenshot({ path: path.join(out, "project.png") });
  await page.locator('[data-workspace="assembly"]').click();
  const placements = [
    ["地面", [-1, -1, 0], "base"],
    ["地面", [0, -1, 0], "base"],
    ["地面", [-1, 0, 0], "base"],
    ["地面", [0, 0, 0], "base"],
    ["高台", [-0.5, -0.5, 0], "platform"],
    ["洞壁", [-1, 1, 0], "large-env"],
    ["洞壁", [-1, -1, 0], "large-env"],
    ["断崖", [1.125, 0, 0.125], "large-env"],
    ["灯座", [-0.5, -0.5, 0.5], "small-env"],
    ["灯座", [0.25, -0.5, 0.5], "small-env"],
  ];
  for (const [name, position, group] of placements) {
    await page
      .locator("#assembly-assets")
      .selectOption(modules.get(name).row.assetId);
    await page.locator("#assembly-add").click();
    await page.locator("#assembly-position").fill(position.join(","));
    await page.locator("#assembly-apply").click();
    await page.locator("#assembly-group").selectOption(group);
    await page.locator("#assembly-group-apply").click();
  }
  assert.equal(await page.locator("[data-instance]").count(), 10);
  await page.locator("#assembly-fit").click();
  await page.locator("#assembly-save").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "assembly.png") });
  const savedScene = JSON.parse(await fs.readFile(scenePath, "utf8"));
  await page.locator('[data-workspace="project"]').click();
  await pick(root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  assert.equal(await page.locator("[data-instance]").count(), 10);
  assert.deepEqual(
    JSON.parse(await fs.readFile(scenePath, "utf8")).instances,
    savedScene.instances,
  );
  await page.locator("#assembly-fit").click();
  await page.screenshot({ path: path.join(out, "tomb.png") });
  async function publish(id) {
    await page.locator('[data-workspace="publish"]').click();
    await page.locator("#publish-target").selectOption("");
    await page.locator("#publish-id").fill(id);
    await page.locator("#publish-recipe").selectOption("glb-only");
    await page.locator("#publish-commit").click();
    await page.getByText("发布完成：" + id, { exact: true }).waitFor();
    return path.join(root, "releases", id);
  }
  const a = await publish("workflow-a"),
    aBytes = await fs.readFile(path.join(a, "output/target.glb")),
    aManifest = await fs.readFile(path.join(a, "manifest.json"));
  await page.locator('[data-workspace="project"]').click();
  await page
    .getByRole("heading", { name: "地面", exact: true })
    .locator("..")
    .getByRole("button", { name: "编辑模块", exact: true })
    .click();
  await page.locator("#module-tabs").selectOption(floor.row.assetId);
  await page.locator("#module-name").fill("地面 · 本地B");
  await page.locator("#module-name").press("Tab");
  await page.locator('[data-mode="volume"]').click();
  await page.locator("#layer").fill("-1");
  await page.locator("#brush-size").fill("3");
  await page.locator("#palette button").nth(2).click();
  await page.locator('[data-tool="repaint"]').click();
  const bBox = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
  await save();
  const changedFloor = JSON.parse(
    await fs.readFile(path.join(scenePrefix, floor.row.source), "utf8"),
  );
  assert.notDeepEqual(
    changedFloor.cells,
    floor.document.cells,
    "B must contain a real changed brush result",
  );
  await publish("workflow-b");
  assert.deepEqual(
    await fs.readFile(path.join(a, "output/target.glb")),
    aBytes,
  );
  assert.deepEqual(await fs.readFile(path.join(a, "manifest.json")), aManifest);
  const ma = JSON.parse(aManifest),
    mb = JSON.parse(
      await fs.readFile(
        path.join(root, "releases/workflow-b/manifest.json"),
        "utf8",
      ),
    );
  assert.notEqual(
    ma.dependencies.find((d) => d.assetId === floor.row.assetId).contentHash,
    mb.dependencies.find((d) => d.assetId === floor.row.assetId).contentHash,
  );
  for (const id of ["workflow-a", "workflow-b"]) {
    const directory = path.join(root, "releases", id),
      m = JSON.parse(
        await fs.readFile(path.join(directory, "manifest.json"), "utf8"),
      );
    assert.equal(m.dependencies.length, 5);
    for (const f of [...m.payloadFiles, ...m.outputFiles])
      assert.equal(
        await core.sha256(await fs.readFile(path.join(directory, f.path))),
        f.sha256,
      );
    const runtime = JSON.parse(
      await fs.readFile(path.join(directory, m.runtimePath), "utf8"),
    );
    assert.equal(runtime.instances.length, 10);
    assert.ok(!("editor" in runtime));
    for (const dep of m.dependencies) {
      const source = JSON.parse(
        await fs.readFile(path.join(directory, dep.unity.runtimePath), "utf8"),
      );
      assert.ok(!("editor" in source));
    }
  }
  await page.screenshot({ path: path.join(out, "publish.png") });
  for (const [file, bytes] of publicSources)
    assert.deepEqual(await fs.readFile(file), bytes);
  assert.deepEqual(errors, []);
  const destination = path.join(out, "workflow-project");
  assert.equal(
    path.resolve(destination),
    path.resolve("validation/workshop-task9/workflow-project"),
  );
  await fs.rm(destination, { recursive: true, force: true });
  await fs.cp(root, destination, { recursive: true });
  for (const name of ["project", "module", "assembly", "publish", "tomb"]) {
    const png = await fs.readFile(path.join(out, name + ".png"));
    assert.equal(png.readUInt32BE(16), 1440);
    assert.equal(png.readUInt32BE(20), 900);
  }
  await fs.writeFile(
    path.join(out, "workflow-ui-result.json"),
    JSON.stringify(
      {
        passed: true,
        instances: 10,
        modules: 5,
        publishes: ["workflow-a", "workflow-b"],
        floorAssetId: floor.row.assetId,
        sceneId: initial.sceneId,
        sourceFilesUnchanged: publicSources.size,
        screenshots: 5,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_WORKFLOW_UI_PASS");
} finally {
  await app.evaluate(({ BrowserWindow }) => {
    for (const win of BrowserWindow.getAllWindows()) win.destroy();
  });
  await app.close();
  assert.ok(
    path
      .resolve(root)
      .startsWith(path.resolve("validation/workshop-workflow-")),
  );
  await fs.rm(root, { recursive: true, force: true });
}
