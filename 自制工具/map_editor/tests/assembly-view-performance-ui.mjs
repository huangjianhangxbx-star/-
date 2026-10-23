import { launchWorkshop } from "./workshop-launch.mjs";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const dir = await fs.mkdtemp(path.resolve("validation/assembly-view-perf-"));
await build({
  stdin: {
    contents: `import {AssemblyView} from './desktop/assembly-view.ts'; import {createAsset,createScene} from './core/workshop-documents.ts'; window.harness={AssemblyView,createAsset,createScene};`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: "iife",
  outfile: path.join(dir, "test.js"),
});
await fs.writeFile(
  path.join(dir, "index.html"),
  '<html><body style="margin:0"><div id="view" style="width:800px;height:600px"></div><script src="test.js"></script></body></html>',
);
const app = await launchWorkshop();
try {
  const page = await app.firstWindow();
  await page.goto(
    "file:///" + path.join(dir, "index.html").replaceAll("\\", "/"),
  );
  const result = await page.evaluate(() => {
    const { AssemblyView, createAsset, createScene } = window.harness;
    const view = new AssemblyView(document.querySelector("#view")),
      asset = createAsset("a"),
      doc = createScene("s");
    // Repeated dense models approximate scene assembly with 130 independent instances.
    asset.cells = [];
    for (let x = 0; x < 64; x++)
      for (let y = 0; y < 32; y++)
        for (let z = 0; z < 24; z++)
          asset.cells.push({ x, y, z, color: (x + y) % 2 });
    doc.assets = [{ kind: "voxel", assetId: "a", source: "a.json" }];
    for (let i = 0; i < 130; i++)
      doc.instances.push({
        instanceId: "i" + i,
        assetId: "a",
        positionM: [(i % 13) * 14, Math.floor(i / 13) * 8, 0],
        rotationDeg: 0,
        groupId: "base",
      });
    let start = performance.now();
    view.update(doc, new Map([["a", asset]]), []);
    const initial = performance.now() - start;
    const first = view.objects.children[0];
    doc.instances.push({
      ...doc.instances[0],
      instanceId: "copy",
      positionM: [0, 0, 5],
    });
    start = performance.now();
    view.update(doc, new Map([["a", structuredClone(asset)]]), ["copy"]);
    const copy = performance.now() - start;
    const stable = view.objects.children[0] === first;
    view.setModelEdges(true);
    const edgeLines = view.objects.children.map((o) =>
      o.children[0].children.find((c) => c.userData.modelEdge),
    );
    const outlines = edgeLines.every(
      (line) =>
        line?.visible &&
        line.geometry.getAttribute("position").count === 24 &&
        line.material.color.getHex() === 0,
    );
    const edgesShared = edgeLines.every(
      (line) => line.geometry === edgeLines[0].geometry,
    );
    view.setModelEdges(false);
    const edgesOff = edgeLines.every((line) => !line.visible);
    const selectedCopy = view.transform.object?.userData.instanceId === "copy";
    // Editing the source without incrementing persisted revision must invalidate all instances.
    const oldGeometry = view.objects.children[0].children[0].geometry;
    asset.cells.push({ x: 80, y: 0, z: 0, color: 0 });
    view.update(doc, new Map([["a", asset]]), ["copy"]);
    const sourceUpdated =
      view.objects.children[0].children[0].geometry !== oldGeometry;
    const updatedGeometry = view.objects.children[0].children[0].geometry;
    const geometryShared = view.objects.children.every(
      (o) => o.children[0].geometry === updatedGeometry,
    );
    const cameraBefore = view.camera.position.toArray();
    doc.instances = doc.instances.filter((p) => p.instanceId !== "copy");
    view.update(doc, new Map([["a", asset]]), []);
    const removedCopy =
      view.objects.children.length === 130 && !view.transform.object;
    doc.groups.find((g) => g.groupId === "base").visible = false;
    view.update(doc, new Map([["a", asset]]), []);
    const hidden = view.objects.children.length === 0;
    doc.groups.find((g) => g.groupId === "base").visible = true;
    view.update(doc, new Map([["a", asset]]), []);
    const restored =
      view.objects.children.length === 130 &&
      view.objects.children.every(
        (o) => o.children[0].geometry === updatedGeometry,
      );
    const cameraPreserved =
      JSON.stringify(cameraBefore) ===
      JSON.stringify(view.camera.position.toArray());
    const outcome = {
      initialMs: initial,
      copyMs: copy,
      stable,
      sourceUpdated,
      geometryShared,
      outlines,
      edgesShared,
      edgesOff,
      selectedCopy,
      removedCopy,
      hidden,
      restored,
      cameraPreserved,
    };
    view.dispose();
    return outcome;
  });
  console.log(JSON.stringify(result));
  assert.ok(
    result.copyMs < 100,
    "copy of a shared model should update in under 100 ms",
  );
  assert.ok(result.stable, "copy must preserve unchanged scene objects");
  assert.ok(
    result.sourceUpdated,
    "unsaved geometry edits must invalidate source cache",
  );
  assert.ok(result.geometryShared, "duplicates must share source geometry");
  for (const key of [
    "outlines",
    "edgesShared",
    "edgesOff",
    "selectedCopy",
    "removedCopy",
    "hidden",
    "restored",
    "cameraPreserved",
  ])
    assert.ok(result[key], key);

  const visual = await page.evaluate(() => {
    const { AssemblyView, createAsset, createScene } = window.harness;
    const view = new AssemblyView(document.querySelector("#view")),
      asset = createAsset("outline"),
      doc = createScene("outline");
    asset.cells = [];
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++) asset.cells.push({ x, y, z: 0, color: 0 });
    doc.assets = [
      { kind: "voxel", assetId: "outline", source: "outline.json" },
    ];
    doc.instances = [0, 1].map((i) => ({
      instanceId: "tile" + i,
      assetId: "outline",
      positionM: [i * 0.5, 0, 0],
      rotationDeg: 0,
      groupId: "base",
    }));
    view.update(doc, new Map([["outline", asset]]), []);
    view.camera.position.set(0.5, 3, -0.25);
    view.controls.target.set(0.5, 0, -0.25);
    view.controls.update();
    const sample = () => {
      view.renderer.render(view.scene, view.camera);
      const canvas = document.createElement("canvas");
      canvas.width = view.renderer.domElement.width;
      canvas.height = view.renderer.domElement.height;
      const context = canvas.getContext("2d");
      context.drawImage(view.renderer.domElement, 0, 0);
      const pixels = context.getImageData(
        canvas.width / 2 - 2,
        canvas.height / 2 - 2,
        4,
        4,
      ).data;
      return Math.min(...Array.from(pixels).filter((_, i) => i % 4 !== 3));
    };
    const before = sample();
    view.setModelEdges(true);
    const after = sample();
    window.outlineView = view;
    return { before, after };
  });
  assert.ok(
    visual.before > 20 && visual.after < visual.before / 2,
    "black boundary is visible between adjacent coplanar model tiles",
  );
  await page
    .locator("#view canvas")
    .screenshot({ path: "validation/assembly-model-edges.png" });
  await page.evaluate(() => window.outlineView.dispose());
  console.log("model boundary pixels", visual);
  console.log("assembly view performance passed");
} finally {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
}
