import sys, json, math
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'scripts'))
try:
    from glb_to_fbx import convert
except ImportError:
    convert=None
assert callable(convert), 'GLB to FBX converter is not implemented'
directory=root/'artifacts'/'exchange-proof'
report=convert(directory/'axis-color.glb',directory/'axis-color.fbx')
assert report['meshes']>0
sidecar=directory/'axis-color.xhmaterials.json'
assert sidecar.exists(), 'FBX material sidecar missing'
materials=json.loads(sidecar.read_text(encoding='utf8'))
assert materials['schema']=='xinghai-fbx-materials-1'
assert any(abs(c['baseColor_sRGB'][0]-128/255)<1e-5 for c in materials['colors'])
assert all(abs(a-b)<1e-5 for a,b in zip(report['bounds']['max'],[.75,.5,1.])), report
assert all(abs(a-b)<1e-5 for a,b in zip(report['bounds']['min'],[0,0,0])), report
assert any(abs(c[0]-.2158605)<1e-5 and abs(c[1]-.2158605)<1e-5 for c in report['base_colors']),report
valid=(directory/'axis-color.fbx').read_bytes()
valid_materials=sidecar.read_bytes()
import glb_to_fbx
original_replace=glb_to_fbx.os.replace
def reject_material_commit(source,target):
    if Path(target)==sidecar: raise OSError('injected sidecar commit failure')
    return original_replace(source,target)
glb_to_fbx.os.replace=reject_material_commit
try:
    try: convert(directory/'axis-color.glb',directory/'axis-color.fbx')
    except OSError: pass
    else: raise AssertionError('sidecar commit fault did not fail')
finally: glb_to_fbx.os.replace=original_replace
assert (directory/'axis-color.fbx').read_bytes()==valid
assert sidecar.read_bytes()==valid_materials
corrupt=directory/'corrupt.glb';corrupt.write_bytes(b'invalid')
try:
    convert(corrupt,directory/'axis-color.fbx')
except Exception: pass
else: raise AssertionError('Corrupt GLB accepted')
assert (directory/'axis-color.fbx').read_bytes()==valid, 'failed export replaced valid FBX'
(directory/'blender-validation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('EXCHANGE_VALIDATION_PASS',json.dumps(report))
# Neutral base-color evidence: no lights, exposure or tone mapping alters source values.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(directory/'axis-color.glb'))
for material in bpy.data.materials:
    if not material.use_nodes: continue
    shader=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    output=next((n for n in material.node_tree.nodes if n.type=='OUTPUT_MATERIAL'),None)
    if shader and output:
        emission=material.node_tree.nodes.new('ShaderNodeEmission')
        emission.inputs['Color'].default_value=shader.inputs['Base Color'].default_value
        material.node_tree.links.new(emission.outputs['Emission'],output.inputs['Surface'])
from mathutils import Vector
bpy.ops.object.camera_add(location=(2.5,-3.5,2.5))
camera=bpy.context.object
camera.rotation_euler=(Vector((.3,.2,.5))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=1.8
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='BLENDER_EEVEE'
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.resolution_x=600;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.filepath=str(directory/'neutral-colors.png')
bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(directory/'assembled.glb'))
assert len([o for o in bpy.data.objects if o.type=='MESH'])==6
assert all(abs(a-b)<1e-6 for a,b in zip(bpy.data.objects['rotated'].matrix_world.translation,[1,0,.25]))
assert all(abs(a-b)<1e-6 for a,b in zip(bpy.data.objects['third'].matrix_world.translation,[0,1,.25]))
assert len({o.data.as_pointer() for o in bpy.data.objects if o.type=='MESH'})==3
print('ASSEMBLED_GLB_VALIDATION_PASS: three placed instances share mesh, native placement preserved')

assert any(n.type=='TEX_IMAGE' and n.image and len(n.image.pixels)>0 for mat in bpy.data.materials if mat.node_tree for n in mat.node_tree.nodes)
assembled_report=convert(directory/'assembled.glb',directory/'assembled.fbx')
assembled_materials=json.loads((directory/'assembled.xhmaterials.json').read_text(encoding='utf8'))
assert any(c['baseColorTexture'] for c in assembled_materials['colors'])
for c in assembled_materials['colors']:
    if c['baseColorTexture']:
        assert c.get('baseColorTexturePath'), 'explicit texture dependency missing'
        assert (directory/c['baseColorTexturePath']).is_file()
assert all(all(abs(v-1)<1e-6 for v in c['baseColor_sRGB']) for c in assembled_materials['colors'] if c['baseColorTexture']), 'linked texture must not use inactive .8 BSDF default factor'
print('TEXTURED_EVENT_ASSEMBLY_FBX_PASS')

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(directory/'assembled.fbx'))
exported_names={c['colorId'] for c in assembled_materials['colors']}
assert all(mat.name in exported_names for mat in bpy.data.materials), ([mat.name for mat in bpy.data.materials],exported_names)
for obj in [o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('axis-color')]:
    assert len([m for m in obj.data.materials if m])==4, (obj.name,[m.name if m else None for m in obj.data.materials])
    assert len(set(p.material_index for p in obj.data.polygons))==4
print('FBX_REIMPORT_INSTANCE_MATERIALS_PASS')



# Texture extraction is part of the transaction: failed first save leaves no dependencies.
import tempfile
fault_dir=Path(tempfile.mkdtemp(prefix='transaction-fault-',dir=directory))
fault_output=fault_dir/'asset.fbx'
original_replace=glb_to_fbx.os.replace
def reject_new_materials(source,target):
    if Path(target)==fault_output.with_suffix('.xhmaterials.json'): raise OSError('injected commit failure')
    return original_replace(source,target)
glb_to_fbx.os.replace=reject_new_materials
try:
    try: convert(directory/'assembled.glb',fault_output)
    except OSError: pass
    else: raise AssertionError('expected failed commit')
finally: glb_to_fbx.os.replace=original_replace
assert not list(fault_dir.iterdir()), list(fault_dir.iterdir())
fault_dir.rmdir()
print('TEXTURE_TRANSACTION_ROLLBACK_PASS')
