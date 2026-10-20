import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const project = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-canvases-"),
);
const profile = await fs.mkdtemp(
  path.join(await fs.realpath(os.tmpdir()), "xh-canvas-profile-"),
);
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE
    ? ["--test-hidden"]
    : [".", "--test-hidden"],
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
  executablePath:
    process.env.XH_ELECTRON_EXECUTABLE ??
    "node_modules/electron/dist/electron.exe",
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建资产", exact: true }).click();
  async function paint() {
    await page.locator('[data-tool="brush"]').click();
    const box = await page.locator("#editview canvas").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByText("体素 1", { exact: true }).waitFor();
  }
  await paint();
  await page.locator("#canvas-upgrade").click();
  await page.locator("#canvas-select").waitFor();
  const base = await page.locator("#canvas-select").inputValue();
  await page.locator("#canvas-step").selectOption("0.125");
  await page.locator("#canvas-add").click();
  await paint();
  const detail = await page.locator("#canvas-select").inputValue();
  assert.notEqual(base, detail);
  await page.locator("#canvas-lock").click();
  await page.locator('[data-tool="brush"]').click();
  let box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 55, box.y + box.height / 2);
  assert.equal(await page.locator("#count").textContent(), "体素 1");
  await page.locator("#canvas-lock").click();
  await page.locator("#canvas-origin").fill("0.25,0,0");
  await page.getByRole("button", { name: "应用位置", exact: true }).click();
  await page.locator("#canvas-step").selectOption("0.0625");
  await page.locator("#canvas-add").click();
  await paint();
  await page.getByRole("button", { name: "保存资产", exact: true }).click();
  await page.getByText("原生资产与试摆草稿已保存").waitFor();
  const manifest = JSON.parse(
    await fs.readFile(path.join(project, "project.xhproject.json"), "utf8"),
  );
  const loaded = await Promise.all(
    manifest.assets.map(async (row) => ({
      row,
      doc: JSON.parse(
        await fs.readFile(path.join(project, row.source), "utf8"),
      ),
    })),
  );
  const multi = loaded.find((x) => x.doc.canvases),
    old = loaded.find((x) => !x.doc.canvases);
  assert.equal(old.doc.cells.length, 1);
  assert.deepEqual(
    multi.doc.canvases.map((c) => [c.voxelStepM, c.cells.length]),
    [
      [0.25, 1],
      [0.125, 1],
      [0.0625, 1],
    ],
  );
  assert.deepEqual(multi.doc.canvases[1].originTicks, [8, 0, 0]);
  await page.reload();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page
    .locator(
      '#project-workspace .project-browser-tree-item[data-path="assets"]',
    )
    .first()
    .click();
  await page
    .locator(
      '#project-workspace .project-browser-card[data-path="assets/' +
        multi.row.assetId +
        '"]',
    )
    .dblclick();
  await page.locator("#canvas-select").waitFor();
  assert.equal(await page.locator("#canvas-select option").count(), 3);
  await page.locator("#canvas-select").selectOption(detail);
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-step"),
    "0.125",
  );
  assert.equal(await page.locator("#canvas-origin").inputValue(), "0.25,0,0");
  // Real mouse two-point alignment on a top view, in active canvas coordinates.
  await page.locator("#top").click();
  box = await page.locator("#editview canvas").boundingBox();
  const a = multi.doc.canvases[1],
    b = multi.doc.canvases[0],
    ac = a.cells[0],
    bc = b.cells[0];
  const src = [ac.x, ac.y, ac.z].map(
    (v, i) => (v + 0.5) * a.voxelStepM + a.originTicks[i] / 32,
  );
  const dst = [bc.x, bc.y, bc.z].map(
    (v, i) => (v + 0.5) * b.voxelStepM + b.originTicks[i] / 32,
  );
  src[2] = (ac.z + 1) * a.voxelStepM + a.originTicks[2] / 32;
  dst[2] = (bc.z + 1) * b.voxelStepM + b.originTicks[2] / 32;
  const pixelsPerUnit = box.height / 2.3;
  await page.locator("#canvas-align").click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(
    box.x +
      box.width / 2 +
      (((dst[0] - src[0]) * 0.25) / a.voxelStepM) * pixelsPerUnit,
    box.y +
      box.height / 2 -
      (((dst[1] - src[1]) * 0.25) / a.voxelStepM) * pixelsPerUnit,
  );
  await page
    .getByText("对齐预览 · 点击确认对齐或 Enter，Esc 取消", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#canvas-origin").inputValue(), "0.25,0,0");
  await page.locator("#canvas-align").click();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(
    box.x +
      box.width / 2 +
      (((dst[0] - src[0]) * 0.25) / a.voxelStepM) * pixelsPerUnit,
    box.y +
      box.height / 2 -
      (((dst[1] - src[1]) * 0.25) / a.voxelStepM) * pixelsPerUnit,
  );
  await page.locator("#canvas-align-confirm").click();
  const expected = a.originTicks
    .map((n, i) => n / 32 + dst[i] - src[i])
    .join(",");
  assert.equal(await page.locator("#canvas-origin").inputValue(), expected);
  await page.locator("#undo").click();
  assert.equal(await page.locator("#canvas-origin").inputValue(), "0.25,0,0");
  await page.locator("#redo").click();
  assert.equal(await page.locator("#canvas-origin").inputValue(), expected);
  const portable = path.join(project, "transfer.xhasset");
  await app.evaluate(({ dialog }, file) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
  }, portable);
  await page.locator("#canvas-export-source").click();
  await page
    .getByText("已导出可编辑源与预览：" + portable, { exact: true })
    .waitFor();
  const otherProject=path.join(project,'other-project');await fs.mkdir(otherProject);
  await page.locator('[data-workspace="project"]').click();
  await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},otherProject);
  await page.getByRole('button',{name:'新建项目',exact:true}).click();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, portable);
  await page.getByRole('button',{name:'导入便携源',exact:true}).click();
  await page.getByText("便携源已导入为新资产", { exact: true }).waitFor();
  assert.equal(await page.locator("#canvas-select option").count(), 3);
  await page
    .locator("#canvas-select")
    .selectOption(multi.doc.canvases[2].canvasId);
  await page.locator("#canvas-origin").fill("-0.5,0,0.25");
  await page.getByRole("button", { name: "应用位置", exact: true }).click();
  await page.getByRole("button", { name: "查看全部画布", exact: true }).click();
  if (process.env.XH_UI_SCREENSHOT)
    await page.screenshot({ path: process.env.XH_UI_SCREENSHOT });
  await page.setViewportSize({width:1000,height:700});
  await page.locator('#canvas-select').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#canvas-select').isVisible(),true);
  if(process.env.XH_UI_SCREENSHOT)await page.screenshot({path:process.env.XH_UI_SCREENSHOT+'.1000.png'});
  assert.deepEqual(errors, []);
  console.log(
    "multi canvas Electron: three resolutions, isolation, locked painting, original retained, save/reopen passed",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(project, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
