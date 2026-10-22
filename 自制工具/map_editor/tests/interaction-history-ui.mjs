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
  page.setDefaultTimeout(10000);page.on('console',m=>console.log(m.text()));
  page.on("pageerror", (e) => (console.log(e.message),errors.push(e.message)));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, project);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建资产", exact: true }).click();


 await page.locator('#viewport-brush-menu summary').click();await page.locator('[data-tool="brush"]').click();const box=await page.locator('#editview canvas').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.getByText('体素 1',{exact:true}).waitFor();
 await page.locator('#brush-current').click();await page.locator('#native-all').evaluate(e=>e.click());assert.equal(await page.locator('#editview').getAttribute('data-selection-count'),'1');
 await page.keyboard.press('Control+z');assert.equal(await page.locator('#editview').getAttribute('data-selection-count'),'0');assert.equal(await page.locator('#count').textContent(),'体素 1');await page.keyboard.press('Control+Shift+z');assert.equal(await page.locator('#editview').getAttribute('data-selection-count'),'1');
 await page.locator('#brush-current').focus();await page.keyboard.press('Escape');await page.keyboard.press('Control+z');assert.equal(await page.locator('#editview').getAttribute('data-selection-count'),'1');
 await page.keyboard.press('Control+c');await page.keyboard.press('Control+v');await page.keyboard.press('Escape');assert.ok(await page.locator('#editview').getAttribute('data-active-copy'),'paste at source retains copy identity');
 await page.locator('#home').click();await page.locator('#top').click();const v=await page.locator('#editview canvas').boundingBox();await page.screenshot({path:'validation/copy-debug.png'});await page.mouse.move(v.x+v.width/2+33,v.y+v.height/2);await page.mouse.down();await page.mouse.move(v.x+v.width/2+85,v.y+v.height/2,{steps:8});await page.mouse.up();
 await page.getByRole('button',{name:'保存资产',exact:true}).click();await page.getByText('原生资产与试摆草稿已保存',{exact:true}).waitFor();const manifest=JSON.parse(await fs.readFile(path.join(project,'project.xhproject.json'),'utf8'));const doc=JSON.parse(await fs.readFile(path.join(project,manifest.assets[0].source),'utf8'));assert.equal(doc.baseCells.length,1);assert.equal(doc.voxelCopies.length,1);assert.notDeepEqual(doc.voxelCopies[0].cells.map(c=>[c.x,c.y,c.z]),doc.baseCells.map(c=>[c.x,c.y,c.z]));assert.deepEqual(errors,[]);console.log('copy identity and interleaved selection undo passed');
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}

