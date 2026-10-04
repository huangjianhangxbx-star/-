import { launchWorkshop } from "./workshop-launch.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-protected-"));
const p = core.createProject("p"),
  s = core.createScene("s"),
  a = core.createAsset("a");
p.scenes.push({
  sceneId: "s",
  name: "桥洞",
  source: "scenes/s/scene.xhscene.json",
});
s.assets.push({
  kind: "voxel",
  assetId: "a",
  source: "assets/a.xhmodule.json",
});
a.cells = [
  { x: -4, y: 0, z: -1, color: 0, owner: "height" },
  { x: 4, y: 0, z: -1, color: 0, owner: "height" },
  { x: 0, y: 0, z: 4, color: 1, owner: "volume" },
];
a.protectedColumns = ["0,0"];
await fs.mkdir(path.join(root, "scenes/s/assets"), { recursive: true });
for (const [file, doc] of [
  ["project.xhproject.json", p],
  ["scenes/s/scene.xhscene.json", s],
  ["scenes/s/assets/a.xhmodule.json", a],
])
  await fs.writeFile(path.join(root, file), JSON.stringify(doc));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator('[data-action="edit-asset"]').click();
  await page.locator("#top").click();
  await page.locator("#height").fill("0");
  await page.locator("#thickness").fill("2");
  const r = await page.locator("#editview canvas").boundingBox(),
    ppu =
      (r.height / (Math.sqrt(2.25 ** 2 + 0.25 ** 2 + 1.5 ** 2) * 1.15)) * 0.25,
    cx = r.x + r.width / 2,
    cy = r.y + r.height / 2;
  await page.mouse.move(cx - 2 * ppu, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 2 * ppu, cy, { steps: 30 });
  await page.mouse.up();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const source = path.join(root, "scenes/s/assets/a.xhmodule.json"),
    doc = JSON.parse(await fs.readFile(source, "utf8"));
  assert.ok(doc.cells.some((c) => c.x < 0 && c.x > -4 && c.z === -2));
  assert.ok(doc.cells.some((c) => c.x > 0 && c.x < 4 && c.z === -2));
  assert.ok(doc.cells.some((c) => c.x === 0 && c.z === 4));
  assert.ok(!doc.cells.some((c) => c.x === 0 && c.z < 4));
  await page.locator("#undo").click();
  await page.getByText("体素 3", { exact: true }).waitFor();
  await page.locator('[data-mode="volume"]').click();
  await page.locator("#brush-size").fill("17");
  await page.locator("#thickness").fill("128");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.getByText("体素 3", { exact: true }).waitFor();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  assert.equal(JSON.parse(await fs.readFile(source, "utf8")).cells.length, 3);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await page.getByText("体素 3", { exact: true }).waitFor();
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  assert.equal(JSON.parse(await fs.readFile(source, "utf8")).cells.length, 3);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "validation/workshop-task3/protected-ui.json",
    JSON.stringify(
      {
        passed: true,
        strokeCells: doc.cells.length,
        checks: [
          "跨保护列两侧保留",
          "桥洞下方为空",
          "整笔撤销",
          "大笔画Esc取消",
          "取消后源保持原几何",
          "失焦取消",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_PROTECTED_UI_PASS");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-protected-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
