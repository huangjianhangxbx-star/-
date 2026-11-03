"""Read native sources and independently re-import FBX in a fresh process."""
import sys, json, hashlib, math
from pathlib import Path
import bpy

DELIVERY=Path(__file__).resolve().parents[2]
KIT=DELIVERY/'kit'
sys.path.insert(0,str(Path(__file__).resolve().parents[5]/'自制工具'/'voxel_workbench'))
from addon import api


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def bounds(objects):
    points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
    # Blender's independent FBX import restores native Blender axes. This maps
    # those actual world vertices to our declared Unity author convention.
    points=[(p.x,p.z,-p.y) for p in points]
    return {'min':[min(p[i] for p in points) for i in range(3)],
            'max':[max(p[i] for p in points) for i in range(3)]}


def measure(objects):
    for o in objects:o.data.calc_loop_triangles()
    return {'bounds':bounds(objects),'meshObjects':len(objects),
            'triangles':sum(len(o.data.loop_triangles) for o in objects),
            'uvMeshes':sum(bool(o.data.uv_layers) for o in objects),
            'allFinite':all(math.isfinite(v) for o in objects for p in o.data.vertices for v in p.co),
            'allUVInPalette':all(0<=v<=1 for o in objects for layer in o.data.uv_layers for item in layer.data for v in item.uv)}


manifest=json.loads((KIT/'contracts.json').read_text(encoding='utf-8'))
report={'status':'RUNNING','engine':bpy.app.version_string,
        'scope':'Independent Blender process native reopen plus FBX import; Unity FBX importer transform validation belongs to Engine QA. Sources never modified.',
        'assets':[]}
for item in manifest['assets']:
    source=KIT/item['source'];fbx=KIT/item['fbx'];palette=KIT/item['palette']
    assert sha(source)==item['sourceSha256']
    assert sha(fbx)==item['fbxSha256']
    assert sha(palette)==item['paletteSha256']
    bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
    actual=api.inspect_asset(item['id'])
    assert actual['fingerprint']==item['sourceFingerprint']
    assert actual['revision']==1
    profile=api.get_profile(item['id'])
    assert profile['id']=='sb03.bridge.v1' and profile['grid_step']==.125
    native=measure(api.objects(api.root(item['id'])))
    assert api.validate_asset(item['id'])['valid']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(fbx),use_anim=False)
    meshes=[o for o in bpy.data.objects if o.type=='MESH']
    imported=measure(meshes)
    assert imported['meshObjects']==native['meshObjects']
    assert imported['triangles']==native['triangles']
    assert imported['allFinite'] and imported['allUVInPalette']
    assert imported['uvMeshes']==imported['meshObjects']
    assert all(abs(native['bounds'][side][i]-imported['bounds'][side][i])<1e-5
               for side in ('min','max') for i in range(3))
    textures=[node.image for mat in bpy.data.materials if mat.use_nodes
              for node in mat.node_tree.nodes if node.type=='TEX_IMAGE' and node.image]
    assert textures
    assert sha(source)==item['sourceSha256'] and sha(fbx)==item['fbxSha256']
    report['assets'].append({'id':item['id'],'status':'PASS','native':native,
        'fbx':imported,'hasPaletteTexture':True,'sourceUnchanged':True,
        'fbxImportedWorldTransforms':[
            {'name':o.name,'matrix':[list(row) for row in o.matrix_world]} for o in meshes]})
    print('SB03_KIT_ROUNDTRIP_PASS '+item['id'],flush=True)
report['status']='PASS'
(KIT/'roundtrip-validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
