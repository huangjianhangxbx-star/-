import { _electron as electron } from "playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "xh-tool015-sample-"));
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE
    ? ["--workspace=workshop", "--test-hidden"]
    : [".", "--workspace=workshop", "--test-hidden"],
  executablePath:
    process.env.XH_ELECTRON_EXECUTABLE ??
    "node_modules/electron/dist/electron.exe",
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
});
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(10000);
  const root = path.resolve("samples/PaintToolkit-TOOL015/project");
  await app.evaluate(
    ({ dialog }, root) =>
      (dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [root],
      })),
    root,
  );
  await page.getByRole("button", { name: "打开项目", exact: true }).click();
  await page
    .getByText("项目级资产库已打开", { exact: true })
    .waitFor()
    .catch(async (e) => {
      console.log(
        "SAMPLE ERROR",
        await page.locator("#workshop-message").textContent(),
      );
      throw e;
    });
  await page.locator("[data-workspace=assembly]").click();
  await page.locator('[data-instance="practice-0"]').click();
  await page.locator("#assembly-edit").click();
  assert.match(await page.locator("#module-name").inputValue(), /门洞/);
  console.log("PASS TOOL015 original practice project opens through formal UI");
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
}
