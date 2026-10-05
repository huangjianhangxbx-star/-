import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { launchWorkshop } from "./workshop-launch.mjs";
const requested = process.argv[process.argv.indexOf("--case") + 1];
const cases =
  requested && requested !== process.argv[0]
    ? [requested]
    : ["keyboard", "library", "states", "theme"];
const out = path.resolve("validation/workshop-ux");
await fs.mkdir(out, { recursive: true });
const core = createRequire(import.meta.url)("../dist/workshop.cjs");
for (const testCase of cases) {
  const root = await fs.mkdtemp(path.join(out, testCase + "-project-"));
  const app = await launchWorkshop();
  const errors = [];
  try {
    const page = await app.firstWindow();
    page.on("pageerror", (e) => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setContentSize(1440, 900),
    );
    const pick = async (file) =>
      app.evaluate(({ dialog }, file) => {
        dialog.showOpenDialog = async () => ({
          canceled: false,
          filePaths: [file],
        });
      }, file);
    await pick(root);
    await page.getByRole("button", { name: "新建项目", exact: true }).click();
    await page.getByRole("button", { name: "新建场景", exact: true }).click();
    await page.getByRole("button", { name: "新建空草稿", exact: true }).click();
    await page.locator("#editview canvas").waitFor();
    const box = await page.locator("#editview canvas").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(
      () => !document.querySelector("#count").textContent.includes("体素 0"),
    );
    const cellCount = await page.locator("#count").textContent();
    const save = async () => {
      await page.locator("#save-draft").click();
      await page.getByText("草稿已保存", { exact: true }).waitFor();
    };
    await save();
    const project = JSON.parse(
      await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    );
    const sceneFile = path.join(root, project.scenes[0].source);
    const scene = () => fs.readFile(sceneFile, "utf8").then(JSON.parse);
    const count = () => page.locator("#assembly-tree [data-instance]").count();
    const blur = async () => {
      await page
        .locator("#assembly-viewport")
        .click({ position: { x: 20, y: 20 } });
    };
    const go = async (name) =>
      page.locator(`[data-workspace="${name}"]`).click();
    const pressed = async (id) =>
      assert.equal(
        await page.locator("#" + id).getAttribute("aria-pressed"),
        "true",
        id,
      );
    const style = async (id) => {
      await page.mouse.move(1420, 860);
      return page
        .locator("#" + id)
        .evaluate((e) => ({
          bg: getComputedStyle(e).backgroundColor,
          border: getComputedStyle(e).borderColor,
          shadow: getComputedStyle(e).boxShadow,
        }));
    };
    if (testCase === "keyboard") {
      await go("assembly");
      await page.locator("[data-asset-scope=scene]").click();
      await page.locator("#assembly-add").click();
      await page.locator("#assembly-copy").click();
      await blur();
      await page.keyboard.press("Control+z");
      assert.equal(await count(), 1, "Ctrl+Z must undo scene duplicate");
      await page.keyboard.press("Control+Shift+z");
      assert.equal(await count(), 2, "Ctrl+Shift+Z must redo scene duplicate");
      await page.keyboard.press("Control+z");
      await page.keyboard.press("Control+y");
      assert.equal(await count(), 2, "Ctrl+Y must redo scene duplicate");
      await page.locator("#assembly-tree [data-instance]").first().click();
      await page.locator("#assembly-position").fill("");
      await page.keyboard.type("3,4,5");
      await page.keyboard.press("Control+z");
      assert.equal(
        await count(),
        2,
        "Text undo must leave scene history alone",
      );
      assert.notEqual(
        await page.locator("#assembly-position").inputValue(),
        "3,4,5",
        "Native input text undo stays available",
      );
      await page.keyboard.press("Control+s");
      assert.equal(
        (await scene()).instances.length,
        0,
        "Input shortcut must not save the scene",
      );
      await page.locator("#assembly-group").focus();
      await page.keyboard.press("Control+z");
      assert.equal(await count(), 2, "Select must keep scene history alone");
      // Real editable DOM target: textarea/contenteditable are supported keyboard boundaries.
      await page.evaluate(() => {
        const field = document.createElement("textarea");
        field.id = "ux-notes";
        document.querySelector("#assembly-workspace").append(field);
      });
      await page.locator("#ux-notes").focus();
      await page.keyboard.type("notes");
      await page.keyboard.press("Control+z");
      assert.equal(await count(), 2, "Textarea must keep scene history alone");
      assert.equal(
        await page.locator("#ux-notes").inputValue(),
        "",
        "Native textarea undo stays available",
      );
      await page.locator("#ux-notes").evaluate((e) => e.remove());
      await page.evaluate(() => {
        const field = document.createElement("div");
        field.id = "ux-editable";
        field.contentEditable = "true";
        field.textContent = "";
        document.querySelector("#assembly-workspace").append(field);
      });
      await page.locator("#ux-editable").focus();
      await page.keyboard.type("notes");
      await page.keyboard.press("Control+z");
      assert.equal(
        await count(),
        2,
        "Contenteditable must keep scene history alone",
      );
      await page.locator("#ux-editable").evaluate((e) => e.remove());
      await blur();
      await page.keyboard.press("Control+s");
      await page.waitForFunction(
        () =>
          document.querySelector("#workshop-message").textContent ===
          "草稿已保存",
      );
      assert.equal(
        (await scene()).instances.length,
        2,
        "Ctrl+S must persist current scene",
      );
      await go("module");
      assert.equal(
        await page.locator("#count").textContent(),
        cellCount,
        "Scene undo must not undo voxel strokes",
      );
      await page
        .locator("#editview")
        .click({ position: { x: 10, y: 10 }, button: "right" });
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() =>
        document.querySelector("#count").textContent.includes("体素 0"),
      );
      await go("assembly");
      assert.equal(
        await count(),
        2,
        "Module undo must not undo scene duplicate",
      );
      await go("module");
      await page
        .locator("#editview")
        .click({ position: { x: 10, y: 10 }, button: "right" });
      await page.keyboard.press("Control+y");
      await page.waitForFunction(
        () => !document.querySelector("#count").textContent.includes("体素 0"),
      );
      await save();
      await go("assembly");
      await page.locator("#assembly-tree [data-instance]").first().click();
      await page.locator("#assembly-copy").click();
      await go("project");
      await page.keyboard.press("Control+z");
      await go("assembly");
      assert.equal(
        await count(),
        3,
        "Project page must not undo a hidden editor",
      );
    }
    if (testCase === "library") {
      await go("assembly");
      assert.equal(
        await page.getByText("尚未选择公共库", { exact: true }).isVisible(),
        true,
        "No library needs explicit empty state",
      );
      assert.equal(
        await page.locator("#assembly-library-choose").isVisible(),
        true,
        "Select library must be on assembly page",
      );
      const library = path.join(root, "library");
      await fs.mkdir(library);
      const source = core.createAsset("public-ux-wall");
      source.name = "UX 墙段";
      source.cells = [{ x: 0, y: 0, z: 0, color: 0, owner: "volume" }];
      const file = path.join(library, "ux-wall.xhmodule.json"),
        bytes = Buffer.from(JSON.stringify(source));
      await fs.writeFile(file, bytes);
      await pick(library);
      await page.locator("#assembly-library-choose").click();
      await page.locator("[data-library-id]").waitFor();
      const viewport = await page.locator("#assembly-viewport").boundingBox(),
        browser = await page.locator("#assembly-browser").boundingBox();
      assert.ok(
        browser.x >= viewport.x + viewport.width - 1,
        "Placeable assets belong right of viewport",
      );
      await page.locator("#assembly-browser-search").fill("missing-term");
      assert.equal(await page.locator("[data-library-id]").count(), 0);
      await page.locator("#assembly-browser-search").fill("ux-wall");
      assert.equal(await page.locator("[data-library-id]").count(), 1);
      await page.locator("#assembly-library-reload").click();
      assert.equal(await page.locator("[data-library-id]").count(), 1);
      const item = page.locator("[data-library-id]").first();
      await item.dragTo(page.locator("#assembly-viewport"), {
        targetPosition: { x: viewport.width / 2, y: viewport.height / 2 },
      });
      await page.waitForFunction(
        () => document.querySelector("#assembly-tree").children.length === 1,
      );
      await page.locator("#assembly-save").click();
      await page.getByText("草稿已保存", { exact: true }).waitFor();
      const current = await scene(),
        row = current.assets.find(
          (a) => a.assetId === current.instances[0].assetId,
        );
      const clone = JSON.parse(
        await fs.readFile(
          path.join(path.dirname(sceneFile), row.source),
          "utf8",
        ),
      );
      assert.notEqual(clone.assetId, source.assetId);
      assert.notEqual(
        clone.materialProfile.paletteId,
        source.materialProfile.paletteId,
      );
      assert.deepEqual(await fs.readFile(file), bytes);
      await page.locator("#assembly-browser-search").fill("");
      await page.locator('[data-asset-scope="scene"]').click();
      assert.equal(
        await page.locator("#assembly-current-assets [data-asset-id]").count(),
        2,
      );
      await page.screenshot({ path: path.join(out, "library-local.png") });
      await page.locator('[data-asset-scope="library"]').click();
      await page.screenshot({ path: path.join(out, "library-public.png") });
    }
    if (testCase === "states") {
      for (const id of ["toggle-sidebar", "toggle-library", "palette-toggle"]) {
        await pressed(id);
        const expanded = await style(id);
        await page.locator("#" + id).click();
        assert.equal(
          await page.locator("#" + id).getAttribute("aria-pressed"),
          "false",
        );
        const collapsed = await style(id);
        assert.notDeepEqual(collapsed, expanded, id + " needs visible state");
        assert.match(await page.locator("#" + id).textContent(), /关闭/);
        await page.screenshot({ path: path.join(out, id + "-closed.png") });
        await page.locator("#" + id).click();
        await pressed(id);
      }
      await page.locator("#module-root-pick").click();
      await pressed("module-root-pick");
      await page.screenshot({ path: path.join(out, "module-root-active.png") });
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#module-root-pick").getAttribute("aria-pressed"),
        "false",
      );
      await page.locator('[data-mode="volume"]').click();
      assert.equal(
        await page.locator('[data-mode="volume"]').getAttribute("aria-pressed"),
        "true",
      );
      await page.locator('[data-tool="erase"]').click();
      assert.equal(
        await page.locator('[data-tool="erase"]').getAttribute("aria-pressed"),
        "true",
      );
      await page.locator("#palette button").nth(2).click();
      assert.equal(
        await page
          .locator("#palette button")
          .nth(2)
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.screenshot({ path: path.join(out, "module-states-open.png") });
      await go("assembly");
      await page.locator("[data-asset-scope=scene]").click();
      await page.locator("#assembly-add").click();
      assert.equal(
        await page.locator("#assembly-drag").getAttribute("aria-pressed"),
        "false",
      );
      await page.locator("#assembly-drag").click();
      await pressed("assembly-drag");
      assert.equal(
        await page
          .locator("#assembly-tree [data-instance]")
          .first()
          .getAttribute("aria-pressed"),
        "true",
      );
      assert.equal(
        await page
          .locator('[data-workspace="assembly"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.screenshot({ path: path.join(out, "assembly-states.png") });
    }
    if (testCase === "theme") {
      const luminance = async (locator) =>
        locator.evaluate((e) => {
          const c = getComputedStyle(e)
            .backgroundColor.match(/[\d.]+/g)
            .map(Number);
          return Math.max(...c.slice(0, 3));
        });
      for (const size of [
        [1440, 900],
        [1000, 700],
      ]) {
        await app.evaluate(
          ({ BrowserWindow }, size) =>
            BrowserWindow.getAllWindows()[0].setContentSize(...size),
          size,
        );
        for (const workspace of ["project", "module", "assembly", "publish"]) {
          await go(workspace);
          assert.ok(
            (await luminance(page.locator("body"))) < 75,
            "Dark app background",
          );
          const selectors = {
            project: [".module-card"],
            module: [
              ".module-context",
              "#app aside",
              "#color-panel",
              "#app input",
              "#app .library",
            ],
            assembly: [
              "#assembly-workspace aside",
              "#assembly-position",
              "#assembly-browser",
            ],
            publish: ["#publish-target", "#publish-commit"],
          };
          for (const selector of selectors[workspace]) {
            const target = page.locator(selector).first();
            if (await target.isVisible())
              assert.ok(
                (await luminance(target)) < 110,
                "Dark surface " + selector,
              );
          }
          const bar = await page.locator(".workshop-bar").boundingBox();
          assert.ok(bar.x + bar.width <= size[0] + 1);
          const overflow = await page
            .locator("body")
            .evaluate((e) => e.scrollWidth > innerWidth + 1);
          assert.equal(overflow, false, "No horizontal window overflow");
          await page.screenshot({
            path: path.join(out, `${workspace}-${size[0]}.png`),
          });
        }
        await go("module");
        const library = path.join(root, "theme-library");
        await fs.mkdir(library, { recursive: true });
        await fs.copyFile(
          "samples/m12-exchange/neutral-colors.png",
          path.join(library, "palette.png"),
        );
        await pick(library);
        await page.locator("#choose").click();
        await page.locator("#assets .asset").first().click();
        await page.locator("#batchrename").click();
        await page.locator("#batch-dialog").waitFor({ state: "visible" });
        assert.ok(
          (await luminance(page.locator("#batch-dialog"))) < 110,
          "Dark dialog",
        );
        await page.screenshot({
          path: path.join(out, `dialog-${size[0]}.png`),
        });
        await page.locator("#batch-close").click();
        await page.locator("#rename").click();
        await page.locator("#rename-dialog").waitFor({ state: "visible" });
        assert.ok((await luminance(page.locator("#rename-dialog"))) < 110, "Dark rename dialog");
        await page.locator('#rename-dialog button[value="cancel"]').click();
        await page.locator("#inspect").click();
        await page.locator("#asset-viewer img").waitFor({ state: "visible" });
        assert.ok((await luminance(page.locator("#asset-viewer"))) < 110, "Dark asset viewer dialog");
        await page.screenshot({ path: path.join(out, `asset-dialog-${size[0]}.png`) });
        await page.locator("#asset-viewer-close").click();
      }
    }
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(out, testCase + "-result.json"),
      JSON.stringify({ passed: true, testCase, errors }, null, 2),
    );
    console.log("WORKSHOP_UX_" + testCase.toUpperCase() + "_PASS");
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
  }
}
