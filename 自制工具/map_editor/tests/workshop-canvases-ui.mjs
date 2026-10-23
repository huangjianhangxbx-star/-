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
  const originalAssetId=await page.locator("#module-tabs").inputValue();
  assert.equal(await page.locator("#canvas-upgrade").count(),0);
  async function joinCanvases(){
    await page.locator("#model-interaction-mode").selectOption("object");
    await page.locator("[data-model-object]").last().click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+j");
    await page.waitForFunction(()=>document.querySelectorAll("[data-model-object]").length===1);
    await page.keyboard.press("Tab");
    await page.waitForFunction(()=>document.querySelector("#model-interaction-mode").value==="edit");
  }
  assert.equal(await page.locator('[data-mode="height"]').isVisible(),false);
  assert.equal(await page.locator('#height').isVisible(),false);
  assert.equal(await page.locator('[data-mode="volume"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#voxel-clarity').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#app .layout > aside [data-tool]').count(),0);
  assert.equal(await page.locator('#selection-brush').count(),0);
  assert.equal(await page.locator('#app .layout > aside [data-mode]').count(),0);
  await page.locator('#viewport-mode-menu summary').click();
  await page.locator('[data-mode="volume"]').click();
  for(const [main,menu] of [['#mode-current','#viewport-mode-menu summary'],['#brush-current','#viewport-brush-menu summary']]){
    const a=await page.locator(main).boundingBox(),b=await page.locator(menu).boundingBox();
    assert.ok(Math.abs(a.y-b.y)<1&&b.x>=a.x+a.width-1,'triangle sits beside its main tool');
  }
  assert.equal(await page.locator('.selection-depth-controls').count(),0);
  await page.locator('#tool-xray').click();
  assert.equal(await page.locator('#tool-xray').textContent(),'选取穿透 · 开');
  await page.locator('#tool-xray').click();
  assert.equal(await page.locator('#tool-xray').textContent(),'选取穿透 · 关');
  await page.locator('#shortcut-map-open').click();
  assert.equal(await page.getByRole('heading',{name:'快捷键与功能'}).isVisible(),true);
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  async function paint() {
    if(!await page.locator('[data-tool="brush"]').isVisible())await page.locator('#viewport-brush-menu summary').click();
    await page.locator('[data-tool="brush"]').click();
    const box = await page.locator("#editview canvas").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByText("体素 1", { exact: true }).waitFor();
  }
  assert.equal(await page.locator('#color-hex').isVisible(),false);
  assert.equal(await page.locator('#color-wheel').isVisible(),false);
  assert.equal(await page.locator('#palette button').count(),32);
  assert.equal(await page.locator('.view-actions #section').count(),1);
  for(let i=0;i<12;i++)await page.locator('#palette button').nth(i).click();
  await page.locator('[data-palette-mode="wheel"]').click();
  assert.equal(await page.locator('#palette button').count(),8);
  assert.equal(await page.locator('#color-wheel').isVisible(),true);
  await page.locator('[data-palette-mode="fixed"]').click();
  assert.equal(await page.locator('#palette button').count(),32);
  const customPalettes=path.join(project,'custom-palettes');await fs.mkdir(customPalettes);await fs.writeFile(path.join(customPalettes,'test.gpl'),'GIMP Palette\n255 0 0 red\n0 255 0 green');
  await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},customPalettes);
  await page.locator('#palette-folder').click();await page.waitForFunction(()=>document.querySelectorAll('#palette button').length===2);
  await page.locator('#palette-project').click();await page.waitForFunction(()=>document.querySelectorAll('#palette button').length===32);
  await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},project);
  if(process.env.XH_PALETTE_SCREENSHOT)await page.screenshot({path:process.env.XH_PALETTE_SCREENSHOT});
  await paint();
  await page.mouse.move(5,5);
  const viewSamples=[];
  for(const id of ['editview','preview']){const box=await page.locator('#'+id).boundingBox();const clip={x:box.x+80,y:box.y+box.height-90,width:24,height:24};viewSamples.push({clip,before:await page.screenshot({clip})});}
  await app.evaluate(({Menu})=>{const menu=Menu.getApplicationMenu();menu.items.find(i=>i.label==='颜色').submenu.items[0].click();});
  await page.getByRole('heading',{name:'颜色调整'}).waitFor();
  assert.equal(await page.locator('.color-adjust-dialog').evaluate(el=>getComputedStyle(el,'::backdrop').backgroundColor),'rgba(0, 0, 0, 0)','color adjustment must not dim either viewport');
  for(const sample of viewSamples)assert.deepEqual(await page.screenshot({clip:sample.clip}),sample.before,'viewport pixels must retain their original brightness under the modal');
  const colorBox=await page.locator('.color-adjust-dialog').boundingBox();assert.ok(colorBox.width<400);
  const titleBox=await page.getByRole('heading',{name:'颜色调整'}).boundingBox();
  await page.mouse.move(titleBox.x+20,titleBox.y+10);await page.mouse.down();await page.mouse.move(titleBox.x+70,titleBox.y+35,{steps:5});await page.mouse.up();
  assert.ok((await page.locator('.color-adjust-dialog').boundingBox()).x>colorBox.x+30);

  await page.getByLabel('色相',{exact:true}).fill('120');
  await page.getByLabel('亮度',{exact:true}).fill('20');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(i=>i.label==='设置').submenu.items[0].click());
  await page.getByRole('heading',{name:'快捷键与功能'}).waitFor();
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  await page.locator('#brush-current').click();
  assert.equal(await page.locator('[data-tool="brush"]').getAttribute('aria-pressed'),'false');
  const empty=await page.locator('#editview canvas').boundingBox();
  await page.mouse.click(empty.x+empty.width*.8,empty.y+empty.height*.8);
  assert.equal(await page.locator('#count').textContent(),'体素 1');
  await page.locator('#viewport-brush-menu summary').click();
  await page.locator('[data-tool="repaint"]').click();
  assert.match(await page.locator('#brush-current').getAttribute('aria-label'),/重染/);
  await page.locator('#brush-current').click();await page.locator('#brush-current').click();
  assert.equal(await page.locator('[data-tool="repaint"]').getAttribute('aria-pressed'),'true');
  await page.locator('#brush-current').click();
  await page.locator("#canvas-list").waitFor();
  assert.equal(await page.locator('.canvas-layer-row.active .canvas-opacity').inputValue(),'100');
  await page.locator('.canvas-layer-row.active .canvas-opacity').fill('40');
  const base = await page.locator(".canvas-layer-row.active").getAttribute("data-canvas-id");
  await page.locator("#canvas-step").fill("1");
  await page.locator("#canvas-add").click();
  await paint();
  assert.equal(await page.locator('.canvas-layer-row.active .canvas-opacity').inputValue(),'100');
  await page.locator('.canvas-layer-row.active .canvas-opacity').fill('100');
  const detail = await page.locator(".canvas-layer-row.active").getAttribute("data-canvas-id");
  assert.notEqual(base, detail);
  await joinCanvases();
  assert.equal(await page.locator(`[data-canvas-id="${base}"] .canvas-opacity`).inputValue(),'40');
  await page.locator(`[data-canvas-id="${base}"] .canvas-layer-select`).click();
  assert.equal(await page.locator('.canvas-layer-row.active .canvas-opacity').inputValue(),'40');
  await page.locator(`[data-canvas-id="${detail}"] .canvas-layer-select`).click();
  await page.locator(".canvas-layer-row.active .canvas-layer-lock").click();
  if(!await page.locator('[data-tool="brush"]').isVisible())await page.locator("#viewport-brush-menu summary").click();
  await page.locator('[data-tool="brush"]').click();
  let box = await page.locator("#editview canvas").boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 55, box.y + box.height / 2);
  assert.equal(await page.locator("#count").textContent(), "体素 1");
  await page.locator(".canvas-layer-row.active .canvas-layer-lock").click();
  await page.locator("#canvas-origin").fill("0.25,0,0");
  await page.getByRole("button", { name: "应用位置", exact: true }).click();
  await page.locator("#canvas-step").fill("2");
  await page.locator("#canvas-add").click();
  await paint();
  await joinCanvases();
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
  assert.equal(loaded.length,1,"multi-canvas editing retains the original asset identity");
  const multi=loaded[0];
  assert.equal(multi.row.assetId,originalAssetId);
  assert.equal(multi.doc.canvases.find(c=>c.canvasId===base).cells.length,1,"original canvas content retained");
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
  await page.locator("#model-interaction-mode").selectOption("edit");
  await page.locator("#canvas-list").waitFor();
  assert.equal(await page.locator("#canvas-list .canvas-layer-row").count(), 3);
  assert.equal(await page.locator(`[data-canvas-id="${base}"] .canvas-opacity`).inputValue(),"40");
  await page.locator(`[data-canvas-id="${detail}"] .canvas-layer-select`).click();
  assert.equal(
    await page.locator("#editview").getAttribute("data-canvas-step"),
    "0.125",
  );
  assert.equal(await page.locator("#canvas-origin").inputValue(), "0.25,0,0");
  // Real mouse two-point alignment on a top view, in active canvas coordinates.
  await page.locator("#home").click();
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
  await page.getByText("画布已对齐 · 可撤销",{exact:true}).waitFor();
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
  await page.locator('code').filter({hasText:otherProject}).waitFor();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, portable);
  await page.getByRole('button',{name:'导入便携源',exact:true}).click();
  await page.getByText('便携源已导入为新资产',{exact:true}).waitFor();
  await page.locator("#model-interaction-mode").selectOption("edit");
  await page.waitForFunction(()=>document.querySelectorAll("#canvas-list .canvas-layer-row").length===3);
  assert.equal(await page.locator("#canvas-list .canvas-layer-row").count(), 3);
  await page.locator(`[data-canvas-id="${multi.doc.canvases[2].canvasId}"] .canvas-layer-select`).click();
  await page.locator("#canvas-origin").fill("-0.5,0,0.25");
  await page.getByRole("button", { name: "应用位置", exact: true }).click();
  await page.getByRole("button", { name: "查看全部画布", exact: true }).click();
  if (process.env.XH_UI_SCREENSHOT)
    await page.screenshot({ path: process.env.XH_UI_SCREENSHOT });
  await page.setViewportSize({width:1000,height:700});
  const beforeCopy=await page.locator('.canvas-layer-row').count();
  await page.locator('.canvas-layer-row.active .canvas-layer-select').click();
  await page.waitForFunction(()=>document.activeElement?.id==='canvas-list');
  await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');
  await page.waitForFunction(()=>document.querySelectorAll("[data-model-object]").length===2);
  await joinCanvases();
  await page.waitForFunction(n=>document.querySelectorAll('.canvas-layer-row').length===n,beforeCopy+1);
  const copiedId=await page.locator('.canvas-layer-row.active').getAttribute('data-canvas-id');
  await page.locator('.canvas-layer-row.active .canvas-layer-select').dragTo(page.locator('.canvas-layer-row').first());
  await page.waitForFunction(id=>document.querySelector('.canvas-layer-row')?.getAttribute('data-canvas-id')===id,copiedId);
  await page.locator('#canvas-list').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#canvas-list').isVisible(),true);
  if(process.env.XH_UI_SCREENSHOT)await page.screenshot({path:process.env.XH_UI_SCREENSHOT+'.1000.png'});
  assert.deepEqual(errors, []);
  console.log(
    "multi canvas Electron: three resolutions, isolation, locked painting, original identity retained, object join, save/reopen passed",
  );
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(project, { recursive: true, force: true });
  await fs.rm(profile, { recursive: true, force: true });
}
