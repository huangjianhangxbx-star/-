import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import * as core from '../dist/workshop.cjs';import exporter from '../desktop/workshop-v2-export.cjs';
const file=process.env.XH_TOOLKIT_ASSET;if(!file)throw Error('XH_TOOLKIT_ASSET required');const bytes=await fs.readFile(file),model=core.validateAsset(JSON.parse(bytes));const root=await fs.mkdtemp(path.resolve('validation/tool015-actual-export-'));const glb=path.join(root,'actual.glb');await fs.writeFile(glb,core.exportAssetGlb(model));const out=await exporter.exportSavedAssetFbx({document:model,hash:createHash('sha256').update(bytes).digest('hex')},root,'actual',process.env.XINGHAI_BLENDER??'D:/steam/steamapps/common/Blender/blender.exe',core);
const python=`import bpy,json,os
report={}
for kind in ['glb','fbx']:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 if kind=='glb':bpy.ops.import_scene.gltf(filepath=os.environ['XH_GLB'])
 else:bpy.ops.import_scene.fbx(filepath=os.environ['XH_FBX'])
 count=0;colors=set();uv=0
 for obj in [o for o in bpy.context.scene.objects if o.type=='MESH']:
  count+=1
  if obj.data.uv_layers.active:uv+=len(obj.data.uv_layers.active.data)
  for mat in obj.data.materials:
   if not mat or not mat.use_nodes:continue
   for node in mat.node_tree.nodes:
    if node.type=='TEX_IMAGE' and node.image:
     if kind=='fbx':assert os.path.isfile(bpy.path.abspath(node.image.filepath))
     pixels=list(node.image.pixels)
     for i in range(0,len(pixels),4):colors.add(tuple(round(v*255) for v in pixels[i:i+3]))
 assert count>=3 and uv>0,(kind,count,uv)
 assert (69,103,137) in colors,('actual polyline RGB missing',kind,colors)
 report[kind]={'meshes':count,'uvLoops':uv,'actualPolyline':True,'pngColorCount':len(colors)}
print('TOOL015_EXPORT '+json.dumps(report))`;
const run=await promisify(execFile)(process.env.XINGHAI_BLENDER??'D:/steam/steamapps/common/Blender/blender.exe',['--background','--factory-startup','--python-exit-code','1','--python-expr',python],{windowsHide:true,env:{...process.env,XH_GLB:glb,XH_FBX:out.file},maxBuffer:8*1024*1024});const line=run.stdout.split(/\r?\n/).find(l=>l.startsWith('TOOL015_EXPORT '));if(!line)throw Error(run.stdout);await fs.writeFile(path.join(root,'report.json'),line.slice(15));if((await fs.readFile(file)).compare(bytes))throw Error('export changed source');console.log(line,root);
