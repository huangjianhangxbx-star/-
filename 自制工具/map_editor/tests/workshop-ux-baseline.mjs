import fs from "node:fs/promises";
import path from "node:path";
import { launchWorkshop } from "./workshop-launch.mjs";
const out = path.resolve("validation/workshop-ux");
await fs.mkdir(out, { recursive: true });
const root = await fs.mkdtemp(path.join(out, "baseline-project-"));
const app = await launchWorkshop();
const result = {};
try {
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow, dialog }, root) => {
    BrowserWindow.getAllWindows()[0].setContentSize(1440, 900);
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  await page.getByRole("button", { name: "新建项目", exact: true }).click();
  await page.getByRole("button", { name: "新建场景", exact: true }).click();
  await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
  const style = async (id) =>
    page
      .locator("#" + id)
      .evaluate((e) => ({
        pressed: e.getAttribute("aria-pressed"),
        background: getComputedStyle(e).backgroundColor,
        border: getComputedStyle(e).borderColor,
        label: e.textContent,
      }));
  result.panels = {};
  for (const id of ["toggle-sidebar", "toggle-library", "palette-toggle"]) {
    const before = await style(id);
    await page.locator("#" + id).click();
    const after = await style(id);
    result.panels[id] = { before, after };
    await page.locator("#" + id).click();
  }
  await page.screenshot({ path: path.join(out, "baseline-module.png") });
  await page.locator('[data-workspace="assembly"]').click();
  result.library = {
    selectEntry: await page
      .getByRole("button", { name: "选择公共库", exact: true })
      .filter({ visible: true })
      .count(),
    emptyMessage: await page
      .getByText("尚未选择公共库", { exact: true })
      .count(),
    side: await page
      .locator("#assembly-library")
      .evaluate((e) => ({
        bounds: e.getBoundingClientRect().toJSON(),
        parent: e.parentElement.tagName,
      })),
  };
  await page.locator("#assembly-add").click();
  await page.locator("#assembly-copy").click();
  await page
    .locator("#assembly-viewport")
    .click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+z");
  result.ctrlZ = await page.locator("#assembly-tree [data-instance]").count();
  await page.locator("#assembly-undo").click();
  await page.keyboard.press("Control+Shift+z");
  result.ctrlShiftZ = await page
    .locator("#assembly-tree [data-instance]")
    .count();
  await page.keyboard.press("Control+y");
  result.ctrlY = await page.locator("#assembly-tree [data-instance]").count();
  await page.locator("#assembly-position").fill("1,2,3");
  await page.keyboard.press("Control+z");
  result.inputUndoSceneCount = await page
    .locator("#assembly-tree [data-instance]")
    .count();
  await page
    .locator("#assembly-viewport")
    .click({ position: { x: 20, y: 20 } });
  await page.keyboard.press("Control+s");
  result.ctrlSSaved =
    JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    ).scenes.length === 1;
  result.background = await page
    .locator("body")
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.screenshot({ path: path.join(out, "baseline-assembly.png") });
  await fs.writeFile(
    path.join(out, "baseline.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
}
