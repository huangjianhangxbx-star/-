import fs from "node:fs/promises";
import * as core from "../dist/workshop.cjs";
import * as mesh from "../core/mesher.ts";
const rows = [];
for (const count of [10000, 40000]) {
  const a = core.createAsset("perf");
  a.cells = Array.from({ length: count }, (_, i) => ({
    x: i % 100,
    y: Math.floor(i / 100) % 20,
    z: Math.floor(i / 2000),
    color: 0,
  }));
  const m = core.ensureModelObjects(a),
    c = m.canvases[0];
  m.objects = [
    {
      objectId: "body",
      name: "Body",
      canvasIds: [c.canvasId],
      originTicks: [0, 0, 0],
      cellKeys: c.cells.map((v) => `${v.x},${v.y},${v.z}`),
    },
  ];
  const keys = new Set(m.objects[0].cellKeys);
  for (const mode of ["brick", "patch", "objects", "tone"]) {
    const plan = core.planAppearance(
      m,
      c.canvasId,
      keys,
      mode === "tone"
        ? {
            kind: "tone",
            preset: "up-down",
            strength: 0.3,
            light: [1, -1, 2],
            bands: 3,
            affectPaint: false,
          }
        : { kind: "region", regional: { ...core.regionalDefaults(), mode } },
    );
    const start = performance.now(),
      doc = core.canvasAsset(plan.nextModel, c.canvasId),
      quads = mesh.meshMap(doc),
      meshMs = performance.now() - start;
    rows.push({
      cells: count,
      mode,
      planMs: Math.round(plan.computeMs),
      meshMs: Math.round(meshMs),
      quads: quads.length,
      materials: plan.nextModel.materialProfile.colors.length,
      toneFaces: Object.keys(plan.nextModel.canvases[0].faceTone?.faces ?? {})
        .length,
      nativeBytes: Buffer.byteLength(JSON.stringify(plan.nextModel)),
      glbBytes: core.exportAssetGlb(plan.nextModel).length,
    });
  }
}
await fs.writeFile(
  "../../docs/tasks/TOOL-013/evidence/performance.json",
  JSON.stringify(
    {
      node: process.version,
      note: "Finite local CPU samples; not frame-rate or worst-case GPU certification",
      rows,
    },
    null,
    2,
  ),
);
console.log(rows);
