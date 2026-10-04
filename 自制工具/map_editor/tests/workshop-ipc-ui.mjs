import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import * as core from "../dist/workshop.cjs";
const root = await fs.mkdtemp(path.resolve("validation/workshop-ipc-ui-"));
const app = await electron.launch({
  args: [".", "--test-hidden"],
  executablePath: "node_modules/electron/dist/electron.exe",
});
const results = [];
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => !!window.workbench?.workshop);
  await app.evaluate(({ dialog }, root) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [root],
    });
  }, root);
  const p = core.createProject("p"),
    s = core.createScene("s"),
    a = core.createAsset("a");
  const session = await page.evaluate(
    (p) => window.workbench.workshop.choose("create", p),
    p,
  );
  p.scenes.push({
    sceneId: "s",
    name: "",
    source: "scenes/s/scene.xhscene.json",
  });
  s.assets.push({
    kind: "voxel",
    assetId: "a",
    source: "assets/a.xhmodule.json",
  });
  const leases = await page.evaluate(
    async ({ token, p, s, a }) => {
      const api = window.workbench.workshop;
      const project = await api.load(
        token,
        "project.xhproject.json",
        "project",
        "p",
      );
      const scene = await api.stage(
        token,
        "scenes/s/scene.xhscene.json",
        "scene",
        "s",
      );
      const asset = await api.stage(
        token,
        "scenes/s/assets/a.xhmodule.json",
        "asset",
        "a",
      );
      await api.dirty(token, true);
      await api.commit(token, [
        { leaseId: project.leaseId, document: p },
        { leaseId: scene.leaseId, document: s },
        { leaseId: asset.leaseId, document: a },
      ]);
      await api.dirty(token, false);
      return { project, scene, asset };
    },
    { token: session.token, p, s, a },
  );
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, "scenes/s/assets/a.xhmodule.json"),
        "utf8",
      ),
    ),
    a,
  );
  results.push("真实IPC提交项目、场景、空模块三文件");
  const reopened = await page.evaluate(() =>
    window.workbench.workshop.choose("open"),
  );
  assert.equal(reopened.document.scenes.length, 1);
  results.push("真实IPC重开一致");
  await page.evaluate(
    (token) => window.workbench.workshop.dirty(token, true),
    reopened.token,
  );
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0 });
  });
  assert.equal(
    await page.evaluate(() => window.workbench.workshop.choose("open")),
    null,
  );
  // A second attempt must still ask about unsaved changes; count it in the main process.
  await app.evaluate(({ dialog }) => {
    globalThis.discardCalls = 0;
    dialog.showMessageBox = async () => {
      globalThis.discardCalls++;
      return { response: 0 };
    };
  });
  assert.equal(
    await page.evaluate(() => window.workbench.workshop.choose("create")),
    null,
  );
  assert.equal(await app.evaluate(() => globalThis.discardCalls), 1);
  results.push("取消项目切换保留dirty和原会话");
  const current = await page.evaluate(
    (token) =>
      window.workbench.workshop.load(
        token,
        "project.xhproject.json",
        "project",
        "p",
      ),
    reopened.token,
  );
  await fs.writeFile(path.join(root, "project.xhproject.json"), "external");
  await assert.rejects(() =>
    page.evaluate(
      ({ token, leaseId, p }) =>
        window.workbench.workshop.commit(token, [{ leaseId, document: p }]),
      { token: reopened.token, leaseId: current.leaseId, p },
    ),
  );
  assert.equal(
    await fs.readFile(path.join(root, "project.xhproject.json"), "utf8"),
    "external",
  );
  results.push("实际IPC冲突保留外部字节");
  await assert.rejects(() =>
    page.evaluate(
      (token) =>
        window.workbench.workshop.stage(token, "C:/escape.json", "asset", "a"),
      reopened.token,
    ),
  );
  results.push("实际IPC拒绝任意绝对目标");
  await fs.writeFile(
    "validation/workshop-task2/electron-ipc.json",
    JSON.stringify({ passed: results.length, results }, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await app.evaluate(({ app }) => app.exit(0));
  assert.ok(
    path
      .relative(path.resolve("validation"), root)
      .startsWith("workshop-ipc-ui-"),
  );
  await fs.rm(root, { recursive: true, force: true });
}
