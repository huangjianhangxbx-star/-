const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path");
const { execFile } = require("node:child_process"),
  { promisify } = require("node:util");
const core = require("../dist/workshop.cjs");
const { exportSavedAssetFbx } = require("../desktop/workshop-v2-export.cjs");
const blender =
  process.env.XINGHAI_BLENDER ??
  "D:/steam/steamapps/common/Blender/blender.exe";
test("multi canvas true Blender FBX roundtrip preserves three resolutions and offset", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/canvas-fbx-"));
  try {
    const old = core.createAsset("base");
    old.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
    old.anchorM = [0.25, 0, 0];
    const a = core.upgradeCanvases(old, "multi");
    a.canvases[0].name = "Body";
    for (const [i, step] of [0.125, 0.0625].entries())
      a.canvases.push({
        ...structuredClone(a.canvases[0]),
        canvasId: "detail" + i,
        name: "Detail" + i,
        voxelStepM: step,
        originTicks: [16 * (i + 1), 0, 0],
      });
    const result = await exportSavedAssetFbx(
      { document: a, hash: "0".repeat(64) },
      root,
      "combined",
      blender,
      core,
    );
    const code =
      "import bpy,os,json; from mathutils import Vector; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False); bpy.ops.import_scene.fbx(filepath=os.environ['XH_FILE']); meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']; print('XH_CANVAS '+json.dumps([{'name':o.name,'dimensions':list(o.dimensions),'minX':min((o.matrix_world@Vector(p)).x for p in o.bound_box)} for o in meshes]))";
    const run = await promisify(execFile)(
      blender,
      [
        "--background",
        "--factory-startup",
        "--python-exit-code",
        "1",
        "--python-expr",
        code,
      ],
      {
        env: { ...process.env, XH_FILE: result.file },
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const report = JSON.parse(
      run.stdout
        .split(/\r?\n/)
        .find((s) => s.startsWith("XH_CANVAS "))
        .slice(10),
    );
    assert.equal(report.length, 3);
    const sizes = report.map((o) => o.dimensions[0]).sort((a, b) => b - a);
    for (const [i, size] of [0.25, 0.125, 0.0625].entries())
      assert.ok(Math.abs(sizes[i] - size) < 1e-5);
    const offsets = report.map((o) => o.minX).sort((a, b) => a - b);
    for (const [i, x] of [-0.25, 0.25, 0.75].entries())
      assert.ok(Math.abs(offsets[i] - x) < 1e-5);
    console.log(JSON.stringify(report));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
