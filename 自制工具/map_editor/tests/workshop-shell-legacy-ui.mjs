import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
const profile = await fs.mkdtemp(path.resolve("validation/legacy-u14-"));
const app = await electron.launch({
  args: process.env.XH_ELECTRON_EXECUTABLE
    ? ["--workspace=legacy", "--test-hidden"]
    : [".", "--workspace=legacy", "--test-hidden"],
  executablePath:
    process.env.XH_ELECTRON_EXECUTABLE ??
    "node_modules/electron/dist/electron.exe",
  env: { ...process.env, XINGHAI_TEST_PROFILE: profile },
});
try {
  const page = await app.firstWindow(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#editview canvas").waitFor();
  assert.equal(await page.locator("body.tool014").count(), 0);
  assert(await page.locator("#save").isVisible());
  await page.locator("#home").click();
  assert.deepEqual(errors, []);
  console.log("PASS Legacy remains separate", profile);
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  await app.close().catch(() => {});
}
