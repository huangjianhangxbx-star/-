import sys,json,struct
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from addon import api,exporting
api.apply_recipe(dict(schema_version='0.1',request_id='e',asset_id='export',expected_revision=0,
 profile_id='project.demo',profile_revision=1,operations=[dict(op='place',id='red',template_id='base.cube',color_id='leaf.dry'),
 dict(op='place',id='blue',template_id='base.plane',color_id='signal',origin_cells=[6,0,0])]))
before=api.inspect_asset('export'); out=ROOT/'artifacts'/'export-test'
for mode in ('material','palette'):
    result=exporting.export_asset('export',out,mode,'GLB')
    raw=Path(result['path']).read_bytes(); size=struct.unpack_from('<I',raw,12)[0]; gltf=json.loads(raw[20:20+size])
    assert gltf['meshes'] and gltf['materials']
    if mode=='palette':
        assert gltf['textures']
        assert all(s.get('magFilter')==9728 and s.get('minFilter')==9728 for s in gltf['samplers'])
        png=bpy.data.images.load(result['texture'],check_existing=False)
        assert abs(png.pixels[0]-.72)<.01, f'Palette sRGB mismatch: {png.pixels[0]}'
        bpy.data.images.remove(png)
    assert api.inspect_asset('export')==before
result=exporting.export_asset('export',out,'palette','FBX')
assert Path(result['path']).exists()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=result['path'])
assert len([o for o in bpy.context.scene.objects if o.type=='MESH'])==2
assert any(m.use_nodes and any(n.type=='TEX_IMAGE' and n.image for n in m.node_tree.nodes) for m in bpy.data.materials)
print('EXPORT PASS: GLB numeric check, sampler, source preserved, FBX texture reimport')
