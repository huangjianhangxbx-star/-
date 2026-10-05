import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { launchWorkshop } from "./workshop-launch.mjs";
const out = path.resolve("validation/workshop-operation");
await fs.mkdir(out, { recursive: true });
const root = await fs.mkdtemp(path.join(out, "project-"));
const app = await launchWorkshop();
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.stack));
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  const canvas = page.locator("#editview canvas"),
    b = await canvas.boundingBox();
  await page.locator("#brush-size").fill("3");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  // Read renderer plans through the view's diagnostic event, without bypassing input.
  const preview = await page
    .locator("#editview")
    .getAttribute("data-operation-plan");
  assert.ok(
    preview,
    "real input must expose its applied operation plan for validation",
  );
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const project = JSON.parse(
    await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
  );
  const scene = JSON.parse(
    await fs.readFile(path.join(root, project.scenes[0].source), "utf8"),
  );
  const assetFile = path.join(
    root,
    path.dirname(project.scenes[0].source),
    scene.assets[0].source,
  );
  const asset = JSON.parse(await fs.readFile(assetFile, "utf8"));
  assert.deepEqual(
    asset.cells.map((c) => `${c.x},${c.y},${c.z}`).sort(),
    JSON.parse(preview).sort(),
  );
  await page
    .locator("#editview")
    .click({ position: { x: 5, y: 5 }, button: "right" });
  await page.keyboard.press("Control+z");
  await page.waitForFunction(() =>
    document.querySelector("#count").textContent.includes("体素 0"),
  );
  await page.keyboard.press("Control+Shift+z");
  await page.waitForFunction(
    () => !document.querySelector("#count").textContent.includes("体素 0"),
  );
  await page.locator("#top").click();
  for (const reason of ["pointercancel", "blur"]) {
    await canvas.evaluate(c=>c.addEventListener('pointerdown',e=>{window.testPointerId=e.pointerId;},{once:true}));
    await page.mouse.move(b.x + b.width * 0.75, b.y + b.height * 0.3);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#count").textContent !== "体素 9");
    if (reason === "pointercancel") await canvas.dispatchEvent("pointercancel",{pointerId:await page.evaluate(()=>window.testPointerId),pointerType:'mouse'});
    else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await page.getByText("体素 9", {exact:true}).waitFor();
  }
  await page.locator("[data-tool=rectangle]").click();
  const start = { x: b.x + b.width * 0.15, y: b.y + b.height * 0.15 },
    end = { x: b.x + b.width * 0.85, y: b.y + b.height * 0.85 };
  const rectangle = async () => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 3 });
  };
  await rectangle();
  await page.mouse.up();
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.includes("Esc 可取消"),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector("#count").textContent === "体素 9",
  );
  await rectangle();
  const rectangleKeys = JSON.parse(
    await page.locator("#editview").getAttribute("data-operation-plan"),
  );
  await page.mouse.up();
  await page.waitForFunction(() =>
    document.querySelector("#message").textContent.includes("笔画完成"),
  );
  await page.locator("#save-draft").click();
  await page.getByText("草稿已保存", { exact: true }).waitFor();
  const final = JSON.parse(await fs.readFile(assetFile, "utf8"));
  const original = new Set(asset.cells.map((c) => `${c.x},${c.y},${c.z}`));
  assert.deepEqual(
    final.cells
      .map((c) => `${c.x},${c.y},${c.z}`)
      .filter((k) => !original.has(k))
      .sort(),
    rectangleKeys.sort(),
  );
  assert.ok(final.cells.length > 300, "real multi-chunk rectangle");
  await page.reload();
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page.getByText("项目已打开", { exact: true }).waitFor();
  await page.locator("[data-action=edit-asset]").first().click();
  await page.getByText(`体素 ${final.cells.length}`, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, "operation.png") });
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "ui-result.json"),
    JSON.stringify(
      {
        passed: true,
        brushKeys: JSON.parse(preview),
        rectangleCells: final.cells.length,
        previewEqualsSaved: true,
        cancelledDuringChunk: true,
        reopened: true,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("WORKSHOP_OPERATION_UI_OK");
} finally {
  await app.evaluate(({ app }) => app.exit(0));
}
