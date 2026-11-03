"""Create the original SB-03 kit through the shared workbench API only.

Run in a new factory Blender background process. This script never opens or
overwrites another source and never installs the addon or changes user prefs.
"""
import sys, json, hashlib, copy, math
from pathlib import Path
import bpy
from mathutils import Vector

DELIVERY = Path(__file__).resolve().parents[2]
KIT = DELIVERY / 'kit'
TOOL = Path(__file__).resolve().parents[5] / '自制工具' / 'voxel_workbench'
sys.path.insert(0, str(TOOL))
from addon import api


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest().upper()


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')


def block(name, x, y, z, sx, sy, sz, color):
    """Arguments in Unity metres; workbench Blender axes are (X,-Z,Y)."""
    values = [x, -z, y, sx, sz, sy]
    cells = [v / .125 for v in values]
    if any(abs(v-round(v)) > 1e-6 for v in cells):
        raise ValueError('Recipe needs integer source-cell coordinates')
    return dict(op='place', id=name, template_id='base.cube',
                origin_cells=[round(v) for v in cells[:3]],
                size_cells=[round(v) for v in cells[3:]],
                color_id=color, anchor='bottom')


SPECS = [
    ('tread', '踏步与鼻口', 'stairs.tread', [.5,.25,.5], [
        block('riser.heel', .125,0,0, .25,.125,.5, 'stone.base'),
        block('tread.nose', 0,.125,0, .5,.125,.5, 'stone.light')],
     '-X nose; top covers full logical tile, heel is recessed by .25m.'),
    ('deck', '桥面铺石', 'deck.surface', [.5,.25,.5], [
        block('bed', 0,0,0,.5,.125,.5,'stone.base'),
        block('surface', 0,.125,0,.5,.125,.5,'stone.light')],
     'Two horizontal courses; repeat in X and Z at .5m without scaling.'),
    ('coping', '侧缘压顶', 'edge.coping', [.5,.25,.25], [
        block('neck',0,0,0,.5,.125,.125,'stone.dark'),
        block('cap',0,.125,0,.5,.125,.25,'stone.light')],
     'Stepped edge course; narrow underside, full upper cap.'),
    ('rail', '木栏直段', 'rail.segment', [.5,1,.125], [
        block('lower',0,0,0,.5,.125,.125,'wood'),
        block('slat.left',-.125,.125,0,.125,.75,.125,'wood'),
        block('slat.right',.125,.125,0,.125,.75,.125,'wood'),
        block('upper',0,.875,0,.5,.125,.125,'wood.light')],
     'X-aligned .5m rail segment; true empty apertures between slats.'),
    ('post', '栏杆端柱', 'rail.post', [.25,1.25,.25], [
        block('foot',0,0,0,.25,.25,.25,'stone.dark'),
        block('shaft',0,.25,0,.125,.75,.125,'wood'),
        block('capital',0,1,0,.25,.25,.25,'stone.light')],
     'Square base and capital, timber shaft. No source scaling.'),
    ('arch-stone', '阶梯拱圈石', 'arch.course', [.25,.25,.25], [
        block('body',0,0,0,.25,.125,.25,'stone.base'),
        block('light.course',0,.125,0,.25,.125,.25,'stone.light')],
     'Two-tone grid course; solver arranges repeated true source meshes.'),
    ('arch-foot', '拱脚', 'arch.springing', [.5,.5,.25], [
        block('plinth',0,0,0,.5,.25,.25,'stone.dark'),
        block('springer',0,.25,0,.25,.25,.25,'stone.base')],
     'Stepped springing profile, both sides use documented rotations.'),
    ('keystone', '拱顶节点', 'arch.crown', [.5,.5,.25], [
        block('key.tip',0,0,0,.25,.25,.25,'stone.light'),
        block('key.head',0,.25,0,.5,.25,.25,'stone.light')],
     'Broad head and narrow tip, protected silhouette at arch crown.'),
    ('abutment-cap', '桥台压顶', 'abutment.cap', [.5,.25,.5], [
        block('seat',0,0,0,.25,.125,.25,'stone.dark'),
        block('cap',0,.125,0,.5,.125,.5,'stone.base')],
     'Stepped stone abutment cap; narrower recessed seat.')
]


def unity_bounds(objects):
    points = []
    for obj in objects:
        for v in obj.data.vertices:
            p = obj.matrix_world @ v.co
            points.append((p.x,p.z,-p.y))
    return {'min':[min(p[i] for p in points) for i in range(3)],
            'max':[max(p[i] for p in points) for i in range(3)]}


def inspect_meshes(objects):
    triangles = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    return dict(meshObjects=len(objects), triangles=triangles,
                uvMeshes=sum(bool(o.data.uv_layers) for o in objects),
                materials=len({m.name for o in objects for m in o.data.materials if m}),
                unityBounds=unity_bounds(objects))


def bounds_match(actual, size):
    expected = {'min':[-size[0]/2,0,-size[2]/2],
                'max':[size[0]/2,size[1],size[2]/2]}
    return all(abs(actual[side][i]-expected[side][i]) < 1e-5
               for side in ('min','max') for i in range(3))


def main():
    discovery = json.loads((KIT/'discovery.json').read_text(encoding='utf-8'))
    profile = copy.deepcopy(discovery['profile'])
    profile.update(id='sb03.bridge.v1', revision=1, grid_step=.125, size_step=.125)
    profile['palette'] = {
        'stone.base': {'color':[.43,.52,.56,1], 'roughness':.9},
        'stone.light': {'color':[.76,.76,.67,1], 'roughness':.9},
        'stone.dark': {'color':[.27,.35,.39,1], 'roughness':.9},
        'wood': {'color':[.39,.31,.22,1], 'roughness':.92},
        'wood.light': {'color':[.55,.44,.31,1], 'roughness':.9},
    }
    write(KIT/'profile.json', profile)
    entries = []
    validations = []
    for number,(name,title,role,size,operations,notes) in enumerate(SPECS,1):
        asset = 'sb03.'+name
        directory = KIT / 'v1' / name
        directory.mkdir(parents=True, exist_ok=True)
        source = directory/(asset+'.blend')
        if source.exists():
            raise RuntimeError('Immutable original source already exists: '+str(source))
        bpy.ops.wm.read_factory_settings(use_empty=True)
        api.set_default_profile(profile)
        recipe = dict(schema_version='0.1', request_id='sb03.original.'+name+'.v1',
                      asset_id=asset, expected_revision=0, profile_id=profile['id'],
                      profile_revision=1, operations=operations)
        write(directory/'recipe.json',recipe)
        result = api.apply_recipe(recipe)
        validation = api.validate_asset(asset)
        assert validation['valid'], validation
        fingerprint = api.inspect_asset(asset)['fingerprint']
        native_stats = inspect_meshes(api.objects(api.root(asset)))
        assert bounds_match(native_stats['unityBounds'],size), (asset,native_stats,size)
        bpy.context.scene.unit_settings.system='METRIC'
        bpy.context.scene.unit_settings.scale_length=1
        bpy.ops.wm.save_as_mainfile(filepath=str(source), relative_remap=False)
        source_sha = sha(source)
        exports = [api.export_asset(asset,directory,mode='palette',format=fmt)
                   for fmt in ('FBX','GLB')]
        api.render_preview(asset,directory/'preview.png',resolution=512)
        assert api.inspect_asset(asset)['fingerprint']==fingerprint
        assert sha(source)==source_sha
        fbx = directory/(asset+'.palette.fbx')
        palette = directory/(asset+'.palette.png')
        write(directory/'native-validation.json',dict(status='PASS',
            assetId=asset,sharedApi=str(api.__file__),fingerprint=fingerprint,
            native=native_stats,validation=validation,sourceUnchangedByExports=True,
            previewUnchanged=True,exports=exports))
        entries.append(dict(id=asset,number=number,title=title,role=role,
            logicalSizeMeters=size,fbx=str(fbx.relative_to(KIT)).replace('\\','/'),
            palette=str(palette.relative_to(KIT)).replace('\\','/'),
            source=str(source.relative_to(KIT)).replace('\\','/'),
            preview=str((directory/'preview.png').relative_to(KIT)).replace('\\','/'),
            sourceSha256=source_sha,fbxSha256=sha(fbx),paletteSha256=sha(palette),
            sourceFingerprint=fingerprint,sourceVoxelMeters=.125,
            sourceAxis='Blender X=length,Y=-width,Z=up',
            logicalAxis='Unity X=length,Y=up,Z=width',
            pivot='bottom-center',allowScale=False,allowMirror=False,
            allowedYaw=[0,90,180,270],artOverhangMeters=[0,0,0],
            generatedZones=[],protectedDesign=notes,native=native_stats))
        validations.append(dict(id=asset,status='PASS',phase='native/export/preview'))
        print('SB03_KIT_BUILT '+asset,flush=True)
    manifest=dict(schemaVersion=1,kitId='sb03.bridge',version='v1',
        sourceVoxelMeters=.125,structureGridMeters=.25,
        logicalAxis='Unity X=bridge length,Y up,Z width',pivot='bottom-center',
        source='Original authored workbench recipes; no Tiny Glade geometry used',
        modelConsumption='Actual FBX meshes and palette UVs; no revoxelization',
        assets=entries)
    write(KIT/'contracts.json',manifest)
    write(KIT/'native-validation.json',dict(status='PASS',assets=validations))


if __name__=='__main__':
    main()
