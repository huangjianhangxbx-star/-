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
test("TOOL015 raster-generated six-face three-precision FBX PNG reimport retains pixel orientation", async () => {
  const root = await fs.mkdtemp(path.resolve("validation/paint-fbx-"));
  try {
    const {rasterBrush,rasterLine}=await import("../core/paint-raster.ts");
    const a = core.createAsset("paint-proof");
    a.cells = [{ x: 0, y: 0, z: 0, color: 0 }];
    a.sideColor = 1;
    const model = core.upgradeCanvases(a, "paint-proof-multi");
    for (let i = 0; i < 3; i++) {
      const step = [0.25, 0.125, 0.0625][i],
        n = step * 64,
        c = i ? structuredClone(model.canvases[0]) : model.canvases[0];
      c.canvasId = "paint" + i;
      c.name = "paint" + i;
      c.voxelStepM = step;
      c.originTicks = [i * 32, 0, 0];
      c.visible = i !== 1;
      c.paintSource = {
        schema: "xinghai-surface-paint-1",
        density: 64,
        faces: {},
      };
      for(let f=0;f<6;f++){const pixels={};for(const [u,v]of rasterBrush([0,0],1,'square'))pixels[v*n+u]='#ff0000';for(const [u,v]of rasterLine([n-1,n-1],[n-1,n-1]))pixels[v*n+u]='#00ff00';c.paintSource.faces['0,0,0,'+f]=pixels;}
      if (i) model.canvases.push(c);
    }
    // This fixture predates explicit ownership; exporter tests geometric data independently.
    delete model.objects;
    delete model.objectCollections;
    const out = await exportSavedAssetFbx(
      { document: model, hash: "0".repeat(64) },
      root,
      "painted",
      blender,
      core,
    );
    assert.equal(out.blenderVersion, "5.1.2");
    assert.ok(out.outputs.filter((o) => o.path.endsWith(".png")).length >= 3);
    const sidecar = JSON.parse(
      await fs.readFile(
        path.join(out.directory, "painted.xhmaterials.json"),
        "utf8",
      ),
    );
    for (const material of sidecar.colors.filter((c) => c.baseColorTexture))
      assert.ok(material.baseColor_sRGB.every((v) => Math.abs(v - 1) < 1e-8));
    const code = `
import bpy,json,os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=os.environ['XH_FILE'])
report=[]
for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
 verts=[obj.matrix_world@v.co for v in obj.data.vertices]
 lo=[min(v[a] for v in verts) for a in range(3)];hi=[max(v[a] for v in verts) for a in range(3)]
 step=hi[0]-lo[0];n=round(step*64);red=green=0
 assert n in [4,8,16],('size',obj.name,lo,hi)
 assert obj.data.uv_layers.active is not None
 for poly in obj.data.polygons:
  mat=obj.data.materials[poly.material_index]
  image_nodes=[node for node in mat.node_tree.nodes if node.type=='TEX_IMAGE']
  assert image_nodes,('missing texture',mat.name)
  image=image_nodes[0].image;assert image is not None and os.path.isfile(bpy.path.abspath(image.filepath))
  shader=next(node for node in mat.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
  assert shader.inputs['Base Color'].is_linked and shader.inputs['Base Color'].links[0].from_node.type=='TEX_IMAGE',('texture must directly drive base color',mat.name)
  axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=[a for a in range(3) if a!=axis]
  center=sum((obj.data.uv_layers.active.data[i].uv for i in poly.loop_indices),Vector((0,0)))/len(poly.loop_indices)
  for li in poly.loop_indices:
   uv=obj.data.uv_layers.active.data[li].uv
   uv=uv*(1-1/n)+center/n
   pos=verts[obj.data.loops[li].vertex_index]
   u=(pos[axes[0]]-lo[axes[0]])/step;v=(pos[axes[1]]-lo[axes[1]])/step
   x=min(image.size[0]-1,max(0,int(uv.x*image.size[0])));y=min(image.size[1]-1,max(0,int(uv.y*image.size[1])))
   k=(y*image.size[0]+x)*4;rgb=list(image.pixels[k:k+3])
   if u<.01 and v<.01:assert max(abs(rgb[a]-[1,0,0][a]) for a in range(3))<.01,('red orientation',obj.name,axis,u,v,list(uv),rgb);red+=1
   if u>.99 and v>.99:assert max(abs(rgb[a]-[0,1,0][a]) for a in range(3))<.01,('green orientation',obj.name,axis,u,v,list(uv),rgb);green+=1
 assert red>=6 and green>=6,(obj.name,red,green)
 report.append({'name':obj.name,'step':step,'redCorners':red,'greenCorners':green,'uvLoops':len(obj.data.uv_layers.active.data)})
assert len(report)==3,report
print('XH_PAINT '+json.dumps({'blender':bpy.app.version_string,'objects':report}))
`;
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
        env: { ...process.env, XH_FILE: out.file },
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    const report = JSON.parse(
      run.stdout
        .split(/\r?\n/)
        .find((l) => l.startsWith("XH_PAINT "))
        .slice(9),
    );
    assert.equal(report.objects.length, 3);
    assert.equal(report.blender, "5.1.2");
    console.log(JSON.stringify(report));
  } finally {
    console.log("TOOL015 FBX evidence",root);
  }
});
