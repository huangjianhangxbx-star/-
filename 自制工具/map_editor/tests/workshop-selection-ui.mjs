import { launchWorkshop } from "./workshop-launch.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const out = path.resolve("validation/workshop-selection");
await fs.mkdir(out, { recursive: true });
const root = await fs.mkdtemp(path.join(out, "project-"));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog, BrowserWindow }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900);
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  assert.equal(await page.locator("#selection-brush").count(), 1);
  const save = async () => {
    await page.locator("#save-draft").click();
    await page.getByText("草稿已保存", { exact: true }).waitFor();
  };
  await save();
  const project = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    ),
    scene = JSON.parse(
      await fs.readFile(path.join(root, project.scenes[0].source), "utf8"),
    ),
    source = path.join(
      root,
      path.dirname(project.scenes[0].source),
      scene.assets[0].source,
    ),
    doc = JSON.parse(await fs.readFile(source, "utf8"));
  doc.cells = [];
  for (const z of [0, 2, 4])
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        doc.cells.push({
          x,
          y,
          z,
          color: 0,
          owner: z === 0 ? "height" : "volume",
        });
  doc.cells.push({ x: 3, y: 0, z: 2, color: 0, owner: "volume" });
  await fs.writeFile(source, JSON.stringify(doc));
  await page.reload();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator("[data-action=edit-asset]").first().click();
  await page.getByText("体素 28", { exact: true }).waitFor();
  await page.locator("#top").click();
  const selection = page.locator("#editview");
  const waitCount = async (n) => {
    await page.waitForFunction(
      (n) =>
        document.querySelector("#editview").dataset.selectionCount ===
          String(n) &&
        document.querySelector("#editview").dataset.selectionBusy !== "true",
      n,
    );
  };
  const box = async () => {
    await page.locator("#native-select").click();
    const b = await page.locator("#editview canvas").boundingBox();
    await page.mouse.move(b.x + 5, b.y + 45);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 5, b.y + b.height - 5, { steps: 8 });
    await page.mouse.up();
  };
  await box();
  await waitCount(10);
  await page.screenshot({ path: path.join(out, "01-visible.png") });
  const wheelBox=await page.locator('#editview canvas').boundingBox();await page.mouse.move(wheelBox.x+wheelBox.width/2,wheelBox.y+wheelBox.height/2);await page.keyboard.down('Alt');await page.mouse.wheel(0,-100);await page.keyboard.up('Alt');
  await waitCount(19);
  await page.screenshot({ path: path.join(out, "02-depth2.png") });
  await page.locator("#selection-through").click();
  await waitCount(28);
  await page.screenshot({ path: path.join(out, "03-through.png") });
  // Camera changes keep the confirmed set; fresh rectangles also work obliquely and from the side.
  for (const [name, dx, dy] of [
    ["oblique", 80, 40],
    ["side", 140, 80],
  ]) {
    const v = await page.locator("#editview canvas").boundingBox();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(v.x + v.width / 2 + dx, v.y + v.height / 2 + dy, {
      steps: 10,
    });
    await page.mouse.up({ button: "right" });
    await waitCount(28);
    await box();
    await waitCount(28);
    await page.locator("#selection-visible").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#editview").dataset.selectionBusy === "false",
    );
    const visible = Number(
      await selection.getAttribute("data-selection-count"),
    );
    assert.ok(visible > 0 && visible < 28);
    await page.screenshot({ path: path.join(out, `angle-${name}.png`) });
    await page.locator("#selection-through").click();
    await waitCount(28);
  }
  await page.locator("#top").click();
  await page.locator("#voxel-clarity").click();
  await waitCount(28);
  await page.locator("#selection-brush").click();
  const b = await page.locator("#editview canvas").boundingBox(),
    cx = b.x + b.width / 2,
    cy = b.y + b.height / 2;
  // Fit centers X=1.5; point X=.5 in the main wall at Y=.5 is one voxel left.
  const radius = Math.sqrt(1.25 ** 2 + 0.75 ** 2 + 1.25 ** 2) / 2,
    ppu = b.height / (8 * Math.max(1, radius) * 1.15);
  await page.mouse.click(cx-ppu,cy);await waitCount(1);
  await page.mouse.move(cx-2*ppu,cy);await page.mouse.down();await page.mouse.move(cx,cy,{steps:2});await page.mouse.up();await waitCount(3);
  await page.keyboard.press('Control+z');await page.getByText('体素 28',{exact:true}).waitFor();await waitCount(3);
  await page.locator('#native-all').click();await waitCount(28);
  await page.mouse.move(cx - ppu, cy);
  await page.keyboard.down("Control");
  await page.mouse.click(cx - ppu, cy);
  await page.keyboard.up("Control");
  await waitCount(27);
  await page.screenshot({ path: path.join(out, "04-irregular.png") });
  await page.keyboard.down("Shift");
  await page.mouse.click(cx - ppu, cy);
  await page.keyboard.up("Shift");
  await waitCount(28);
  await page.keyboard.down("Control");
  await page.mouse.click(cx - ppu, cy);
  await page.keyboard.up("Control");
  await waitCount(27);
  await page.locator("#palette button").nth(2).click();
  await page.locator("#selection-replace").click();
  await page.getByText("体素 28", { exact: true }).waitFor();
  await save();
  let saved = JSON.parse(await fs.readFile(source, "utf8"));
  assert.equal(saved.cells.filter((c) => c.color === 2).length, 27);
  assert.equal(saved.cells.filter((c) => c.owner === "height").length, 9);
  await page.screenshot({ path: path.join(out, "05-replace.png") });
  await page.keyboard.press("Control+z");
  await save();
  assert.equal(
    JSON.parse(await fs.readFile(source, "utf8")).cells.filter(
      (c) => c.color === 2,
    ).length,
    0,
  );
  await waitCount(27);
  await page.locator("#selection-erase").click();
  await page.getByText("体素 1", { exact: true }).waitFor();
  await waitCount(27);
  await page.screenshot({ path: path.join(out, "06-cleared-mask.png") });
  await page.locator("#selection-fill").click();
  await page.getByText("体素 28", { exact: true }).waitFor();
  await save();
  saved = JSON.parse(await fs.readFile(source, "utf8"));
  assert.equal(saved.cells.filter((c) => c.owner === "height").length, 9);
  assert.equal(saved.cells.filter((c) => c.color === 2).length, 27);
  // Escape restores the previous exact set.
  await page.locator("#native-select").click();
  await page.mouse.move(b.x + 10, b.y + 50);
  await page.mouse.down();
  await page.mouse.move(cx, cy);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await waitCount(27);
  await page
    .getByRole("button", { name: "复制选区为模块", exact: true })
    .click();
  await page.getByText("体素 27", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "07-exact-copy.png") });
  await save();
  await page.reload();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator("[data-action=edit-asset]").last().click();
  await page.getByText("体素 27", { exact: true }).waitFor();
  await waitCount(0);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1000, 700),
  );
  await page.locator("#native-all").click();
  await waitCount(27);
  assert.equal(
    await page.evaluate(() => document.body.scrollWidth > innerWidth + 1),
    false,
  );
  await page.screenshot({ path: path.join(out, "selection-1000.png") });
  await page.locator('#layer').fill('2');await page.locator('#section').check();await page.locator('#selection-through').click();await box();await waitCount(19);await page.screenshot({path:path.join(out,'section-filter.png')});await page.locator('#section').uncheck();
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "ui-result.json"),
    JSON.stringify(
      { passed: true, depthCounts: [10, 19, 28], irregular: 27, errors },
      null,
      2,
    ),
  );
  console.log("SELECTION_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
