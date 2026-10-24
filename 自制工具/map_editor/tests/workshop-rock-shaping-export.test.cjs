const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createHash } = require('node:crypto');
const core = require('../dist/workshop.cjs');
const codec = require('../desktop/portable-asset.cjs');
const { exportSavedAssetFbx } = require('../desktop/workshop-v2-export.cjs');
const blender = process.env.XINGHAI_BLENDER ?? 'D:/steam/steamapps/common/Blender/blender.exe';
const key = c => `${c.x},${c.y},${c.z}`;
const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];

function fixture(preset) {
  const base = core.createAsset(`rock-export-${preset}`);
  const width = 24, depth = 18, height = 30;
  base.cells = Array.from({length:width * depth * height}, (_, i) => ({
    x:i % width - 4, y:Math.floor(i / width) % depth + 3,
    z:Math.floor(i / width / depth) - 2, color:0,
  }));
  base.anchorM = [0.375, -0.25, 0.125];
  base.rootMode = 'free';
  const model = core.upgradeCanvases(base, `rock-shaped-${preset}`);
  const canvas = model.canvases[0];
  canvas.name = preset;
  canvas.originTicks = [16, -8, 24];
  canvas.voxelStepM = preset === 'columnar-wall' ? 0.125 : 0.0625;
  model.objects = [{objectId:'rock-owner',name:'Rock',canvasIds:[canvas.canvasId],
    originTicks:[16,-8,24],cellKeys:canvas.cells.map(key)}];
  return model;
}

function expectedGeometry(model) {
  const canvas = model.canvases[0], cells = canvas.cells;
  const occupied = new Set(cells.map(key));
  let exposed = 0;
  for (const cell of cells) for (const d of directions)
    if (!occupied.has(`${cell.x+d[0]},${cell.y+d[1]},${cell.z+d[2]}`)) exposed++;
  const step = canvas.voxelStepM;
  return {
    lo:[0,1,2].map((axis) => Math.min(...cells.map(c=>[c.x,c.y,c.z][axis]))*step+canvas.originTicks[axis]/32-model.anchorM[axis]),
    hi:[0,1,2].map((axis) => (Math.max(...cells.map(c=>[c.x,c.y,c.z][axis]))+1)*step+canvas.originTicks[axis]/32-model.anchorM[axis]),
    volume:cells.length*step**3, area:exposed*step**2,
  };
}

function paintNewlyExposed(session, original) {
  const before = new Set(original.canvases[0].cells.map(key));
  const after = new Set(session.active.cells.map(key));
  for (const c of session.active.cells) for (const [face,d] of directions.entries()) {
    const neighbor = `${c.x+d[0]},${c.y+d[1]},${c.z+d[2]}`;
    if (after.has(neighbor) || (before.has(key(c))&&!before.has(neighbor))) continue;
    const n = session.active.voxelStepM*64;
    const pixels = Object.fromEntries(Array.from({length:n*n},(_,i)=>[i,'#ff0000']));
    session.setEditObject('rock-owner');
    session.paint({schema:'xinghai-surface-paint-1',density:64,faces:{[`${key(c)},${face}`]:pixels}});
    return `${key(c)},${face}`;
  }
  assert.fail('The shaped asset must expose a new paintable interior face');
}

const blenderReadback = `
import bpy,os,json
from mathutils import Vector
def inspect(filename):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 if filename.endswith('.glb'):bpy.ops.import_scene.gltf(filepath=filename)
 else:bpy.ops.import_scene.fbx(filepath=filename)
 points=[];textured_points=[];area=0.;signed_volume=0.;triangles=0;images={};textured_faces=0
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 assert meshes,('no geometry',filename)
 for obj in meshes:
  verts=[obj.matrix_world@v.co for v in obj.data.vertices];points.extend(verts)
  obj.data.calc_loop_triangles()
  for tri in obj.data.loop_triangles:
   a,b,c=[verts[i] for i in tri.vertices]
   area+=(b-a).cross(c-a).length/2
   signed_volume+=a.dot(b.cross(c))/6
   triangles+=1
  for poly in obj.data.polygons:
   mat=obj.data.materials[poly.material_index]
   if not mat or not mat.use_nodes:continue
   textures=[n for n in mat.node_tree.nodes if n.type=='TEX_IMAGE']
   if not textures:continue
   textured_faces+=1
   textured_points.extend(verts[i] for i in poly.vertices)
   assert obj.data.uv_layers.active is not None,('missing UV',obj.name)
   shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
   assert shader.inputs['Base Color'].is_linked
   assert shader.inputs['Base Color'].links[0].from_node.type=='TEX_IMAGE'
   for node in textures:
    image=node.image;assert image is not None
    if filename.endswith('.fbx'):assert os.path.isfile(bpy.path.abspath(image.filepath)),('missing PNG',image.filepath)
    if image.name not in images:
     red=sum(1 for i in range(0,len(image.pixels),4) if image.pixels[i]>.99 and image.pixels[i+1]<.01 and image.pixels[i+2]<.01)
     images[image.name]={'size':list(image.size),'redPixels':red}
 return {'meshes':len(meshes),'triangles':triangles,'lo':[min(v[i] for v in points) for i in range(3)],'hi':[max(v[i] for v in points) for i in range(3)],'area':area,'volume':abs(signed_volume),'texturedFaces':textured_faces,'textureLo':[min(v[i] for v in textured_points) for i in range(3)] if textured_points else None,'textureHi':[max(v[i] for v in textured_points) for i in range(3)] if textured_points else None,'images':list(images.values())}
report={kind:inspect(os.environ['XH_'+kind.upper()]) for kind in ['glb','fbx']}
print('XH_ROCK '+json.dumps({'blender':bpy.app.version_string,**report}))
`;

for (const preset of ['columnar-wall','terraced-rim']) for(const operation of ['subtract','grow','both']) {
  test(`Workshop ${preset}/${operation}: real sculpt transaction -> native/portable -> GLB/FBX Blender readback${preset==='columnar-wall'?' with new-face paint and PNG':''}`, async () => {
    // This intentionally fails before the integration is built; no mocked sculpt or exporter.
    assert.equal(typeof core.planRockAsset,'function','Build the actual rock asset integration first');
    const parent = path.resolve(__dirname,'../validation');
    await fs.mkdir(parent,{recursive:true});
    const root = await fs.mkdtemp(path.join(parent,'rock-export-'));
    try {
      const source = fixture(preset), frozen = JSON.stringify(source);
      const session = new core.CanvasSession(source);
      const plan = core.planRockAsset(session.model,'rock-owner',{
        ...core.DEFAULT_ROCK_OPTIONS,preset,operation,maxOutward:4,seed:17,maxDepth:3,bandWidth:7,
      });
      assert.ok(plan.result.removedCellKeys.length+plan.result.addedCells.length>100,'real nonempty structural sculpt');
      if(operation!=='grow')assert.ok(plan.result.removedCellKeys.length>0);
      if(operation!=='subtract')assert.ok(plan.result.addedCells.length>0);
      const history = session.past.length;
      session.applyRock(plan);
      assert.equal(session.past.length,history+1,'one sculpt history transaction');
      assert.equal(JSON.stringify(source),frozen,'original source is immutable');
      assert.equal(session.active.cells.length,source.canvases[0].cells.length+plan.result.addedCells.length-plan.result.removedCellKeys.length);
      let paintedFace;
      if (preset==='columnar-wall') paintedFace=paintNewlyExposed(session,source);
      const saved = core.validateAsset(JSON.parse(JSON.stringify(session.sync())));
      assert.equal(saved.assetId,source.assetId);
      assert.deepEqual(saved.anchorM,source.anchorM);
      assert.deepEqual(saved.objects[0].originTicks,source.objects[0].originTicks);
      const nativeFile=path.join(root,'asset.xhmodule.json');
      await fs.writeFile(nativeFile,JSON.stringify(saved));
      const reopened=core.validateAsset(JSON.parse(await fs.readFile(nativeFile,'utf8')));
      assert.deepEqual(reopened,saved,'saved native geometry/ownership/paint survives readback');
      const preview=(await fs.readFile(path.resolve(__dirname,'../samples/SurfacePaint-B2/preview.png'))).toString('base64');
      const portable=codec.encode(saved,preview,core), imported=codec.decode(portable,core).document;
      assert.notEqual(imported.assetId,saved.assetId);
      assert.deepEqual(imported.canvases,saved.canvases);
      assert.deepEqual(imported.objects,saved.objects);
      const tampered=JSON.parse(portable);tampered.source+=' ';
      assert.throws(()=>codec.decode(Buffer.from(JSON.stringify(tampered)),core),/校验/);
      const glb=Buffer.from(core.exportAssetGlb(reopened));
      core.validatePublishGlb(glb);
      const glbFile=path.join(root,'rock.glb');await fs.writeFile(glbFile,glb);
      const sourceHash=createHash('sha256').update(JSON.stringify(reopened)).digest('hex');
      const out=await exportSavedAssetFbx({document:reopened,hash:sourceHash},root,'rock',blender,core);
      assert.equal(out.blenderVersion,'5.1.2');
      const materials=JSON.parse(await fs.readFile(path.join(out.directory,'rock.xhmaterials.json'),'utf8'));
      if (paintedFace) {
        assert.ok(out.outputs.some(o=>o.path.endsWith('.png')));
        const textured=materials.colors.filter(c=>c.baseColorTexture);
        assert.ok(textured.length>0);
        for(const material of textured)assert.ok(material.baseColor_sRGB.every(v=>Math.abs(v-1)<1e-8));
        assert.deepEqual(reopened.canvases[0].paintSource.faces[paintedFace],saved.canvases[0].paintSource.faces[paintedFace]);
      }
      const run=await promisify(execFile)(blender,['--background','--factory-startup','--python-exit-code','1','--python-expr',blenderReadback],{
        env:{...process.env,XH_GLB:glbFile,XH_FBX:out.file},windowsHide:true,maxBuffer:4*1024*1024,
      });
      const line=run.stdout.split(/\r?\n/).find(l=>l.startsWith('XH_ROCK '));
      assert.ok(line,run.stdout);
      const report=JSON.parse(line.slice(8)), expected=expectedGeometry(reopened);
      assert.equal(report.blender,'5.1.2');
      for(const kind of ['glb','fbx']) {
        const actual=report[kind];assert.ok(actual.triangles>12);
        for(const edge of ['lo','hi'])for(let i=0;i<3;i++)
          assert.ok(Math.abs(actual[edge][i]-expected[edge][i])<1e-5,`${kind} ${edge} axis ${i}: ${JSON.stringify(actual)}`);
        for(const measure of ['area','volume'])
          assert.ok(Math.abs(actual[measure]-expected[measure])<1e-5,`${kind} ${measure}: ${actual[measure]} != ${expected[measure]}`);
        if(paintedFace) {
          assert.ok(actual.texturedFaces>0,`${kind}: real textured geometry`);
          assert.ok(actual.images.some(image=>image.redPixels>0),`${kind}: painted color in real atlas`);
          const [x,y,z,face]=paintedFace.split(',').map(Number), position=[x,y,z];
          const canvas=reopened.canvases[0], step=canvas.voxelStepM, axis=Math.floor(face/2);
          for(let i=0;i<3;i++)for(const [edge,delta] of [['textureLo',0],['textureHi',1]]) {
            const faceDelta=i===axis?(face%2===0?1:0):delta;
            const world=(position[i]+faceDelta)*step+canvas.originTicks[i]/32-reopened.anchorM[i];
            assert.ok(Math.abs(actual[edge][i]-world)<1e-5,`${kind}: texture must lie on the newly exposed local face, ${edge} axis ${i}`);
          }
        }
      }
      const evidence={preset,operation,cells:reopened.canvases[0].cells.length,added:plan.result.addedCells.length,removed:plan.result.removedCellKeys.length,paintedFace,...report};
      if(process.env.XH_KEEP_ROCK_EXPORTS)await fs.writeFile(path.join(root,'blender-readback.json'),JSON.stringify(evidence,null,2));
      console.log(JSON.stringify({...evidence,...(process.env.XH_KEEP_ROCK_EXPORTS?{artifacts:root}:{})}));
    } finally {
      // root is a freshly generated exact child of the verified validation directory.
      assert.equal(path.dirname(root),parent);
      if(!process.env.XH_KEEP_ROCK_EXPORTS)await fs.rm(root,{recursive:true,force:true});
    }
  });
}
