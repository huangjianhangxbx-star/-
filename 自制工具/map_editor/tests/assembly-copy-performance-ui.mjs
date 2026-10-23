import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-assembly-"));
const p = core.createProject("p"),
  s = core.createScene("s"),
  a = core.createAsset("a");
a.name = "悬空平台";
a.cells=[];for(let x=0;x<64;x++)for(let y=0;y<32;y++)for(let z=0;z<24;z++)a.cells.push({x,y,z,color:(x+y)%2});
s.assets.push({
  kind: "voxel",
  assetId: "a",
  source: "assets/a.xhmodule.json",
});
for (let i = 0; i < 130; i++)
  s.instances.push({
    instanceId: `i${i}`,
    assetId: "a",
    positionM: [i * 0.5, 0, 0],
    rotationDeg: (i % 4) * 90,
    groupId: "base",
  });
p.scenes.push({
  sceneId: "s",
  name: "墓室",
  source: "scenes/s/scene.xhscene.json",
});
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [file, doc] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
  ["scenes/s/assets/a.xhmodule.json", a],
])
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-workspace="assembly"]').click();
  await page.locator("[data-instance]").first().waitFor();
  assert.equal(await page.locator("[data-instance]").count(), 130);
  await page.locator('[data-instance="i0"]').click();
  const timings=[];
  for(let n=0;n<4;n++)timings.push(await page.evaluate(async()=>{
    const start=performance.now();document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return performance.now()-start;
  }));
  assert.equal(await page.locator('[data-instance]').count(),134);
  console.log(JSON.stringify({operation:'actual Ctrl+D through workspace + session + view',timings}));
  assert.ok(Math.max(...timings.slice(1))<250,'warm copy should complete within 250ms on the regression fixture');
  assert.deepEqual(errors,[]);
}finally{await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.destroy()));await app.close();}
