const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto"),
  { execFile } = require("node:child_process"),
  { promisify } = require("node:util");
const core = require("../dist/workshop.cjs"),
  { exportSavedAssetFbx } = require("../desktop/workshop-v2-export.cjs"),
  codec = require("../desktop/portable-asset.cjs");
const blender = "D:/steam/steamapps/common/Blender/blender.exe";
function chunk(type, data) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  data.copy(b, 8);
  let c = 0xffffffff;
  for (let i = 4; i < b.length - 4; i++) {
    c ^= b[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  b.writeUInt32BE((c ^ 0xffffffff) >>> 0, b.length - 4);
  return b;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(1);
header.writeUInt32BE(1, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk(
    "IDAT",
    require("node:zlib").deflateSync(Buffer.from([0, 255, 0, 0, 255])),
  ),
  chunk("IEND", Buffer.alloc(0)),
]).toString("base64");

const readback = `
import bpy,os,json
report={}
for kind in ['glb','fbx']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 filename=os.environ['XH_'+kind.upper()]
 if kind=='glb':bpy.ops.import_scene.gltf(filepath=filename)
 else:bpy.ops.import_scene.fbx(filepath=filename)
 points=[];normals=set();plain=set();pixels=set();textured=0;triangles=0
 for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  points.extend(obj.matrix_world@v.co for v in obj.data.vertices);obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
  for poly in obj.data.polygons:
   normals.add(tuple(round(v) for v in (obj.matrix_world.to_3x3()@poly.normal).normalized()))
   mat=obj.data.materials[poly.material_index];assert mat.use_nodes
   bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');tex=[n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE']
   if tex:
    textured+=1;assert obj.data.uv_layers.active
    for node in tex:
     image=node.image;assert image
     if kind=='fbx':assert os.path.isfile(bpy.path.abspath(image.filepath))
     data=list(image.pixels)
     for i in range(0,len(data),4):pixels.add(tuple(round(v*255) for v in data[i:i+3]))
   else:plain.add(round(bsdf.inputs['Base Color'].default_value[0],5))
 report[kind]={'triangles':triangles,'normals':list(normals),'plain':list(plain),'pixels':list(pixels),'textured':textured,'lo':[min(v[i] for v in points) for i in range(3)],'hi':[max(v[i] for v in points) for i in range(3)]}
print('XH_APPEARANCE '+json.dumps(report))
`;
test("real saved/portable appearance asset -> GLB/FBX -> independent Blender geometry, material and PNG readback", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/appearance-export-"));
  const a = core.createAsset("appearance-export");
  a.schema = "xinghai-workshop-asset-2";
  a.rootMode = "free";
  a.anchorM = [0.125, -0.25, 0.0625];
  a.palette[0] = "#808080";
  a.materialProfile.colors[0].baseColor_sRGB = [
    128 / 255,
    128 / 255,
    128 / 255,
  ];
  a.materialProfile.colors[0].roughness = 0.37;
  a.cells = [];
  a.canvases = [0.25, 0.125, 0.0625].map((step, i) => ({
    canvasId: "c" + i,
    name: "precision" + i,
    visible: true,
    locked: false,
    voxelStepM: step,
    originTicks: [i * 32, 0, 0],
    cells: [{ x: -1, y: 0, z: 1, color: 0 }],
    protectedColumns: [],
    paintSource: {
      schema: "xinghai-surface-paint-1",
      density: 64,
      faces: { "-1,0,1,0": { 0: "#ffffff" } },
    },
  }));
  a.objects = a.canvases.map((c) => ({
    objectId: c.canvasId,
    name: c.name,
    canvasIds: [c.canvasId],
    originTicks: c.originTicks,
    cellKeys: ["-1,0,1"],
  }));
  let model = core.validateAsset(a);
  for (const c of a.canvases)
    model = core.planAppearance(model, c.canvasId, new Set(["-1,0,1"]), {
      kind: "tone",
      preset: "up-down",
      strength: 0.4,
      light: [0, 0, 1],
      bands: 3,
      affectPaint: c.canvasId === "c2",
    }).nextModel;
  const source = JSON.stringify(model);
  await fs.writeFile(path.join(root, "source.json"), source);
  const reopened = core.validateAsset(
    JSON.parse(await fs.readFile(path.join(root, "source.json"), "utf8")),
  );
  const glbFile = path.join(root, "appearance.glb");
  await fs.writeFile(glbFile, core.exportAssetGlb(reopened));
  const out = await exportSavedAssetFbx(
    {
      document: reopened,
      hash: createHash("sha256").update(source).digest("hex"),
    },
    root,
    "appearance",
    blender,
    core,
  );
  assert(out.outputs.some((o) => o.path.endsWith(".png")));
  const run = await promisify(execFile)(
    blender,
    [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python-expr",
      readback,
    ],
    {
      env: { ...process.env, XH_GLB: glbFile, XH_FBX: out.file },
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  const line = run.stdout
    .split(/\r?\n/)
    .find((l) => l.startsWith("XH_APPEARANCE "));
  assert(line, run.stdout);
  const report = JSON.parse(line.slice(14));
  for (const kind of ["glb", "fbx"]) {
    const r = report[kind];
    assert.equal(r.normals.length, 6);
    assert(r.textured > 0);
    assert.equal(r.triangles, 36);
    assert(r.plain.length >= 3);
    assert(r.pixels.some((p) => p[0] === 255 && p[1] === 255 && p[2] === 255));
    assert(r.pixels.some((p) => p[0] === 115 && p[1] === 115 && p[2] === 115));
  }
  for (const bound of ["lo", "hi"])
    for (let i = 0; i < 3; i++)
      assert(Math.abs(report.glb[bound][i] - report.fbx[bound][i]) < 1e-5);
  const decoded = codec.decode(codec.encode(reopened, png, core), core);
  assert.deepEqual(decoded.document.canvases, reopened.canvases);
  await fs.writeFile(
    path.join(root, "readback.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ root, report }));
});
