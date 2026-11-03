"""Read actual saved sources and FBX exports; never replay the recipes."""
import json, math, hashlib, sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path('E:/WORLDCREATOR/XingHaiHuiLang/Origin')
BASE=ROOT/'work/scene-builder-lab/asset-usage-replica'
KIT=BASE/'kits/B'; QA=BASE/'qa/kit-B'
sys.path.insert(0,str(ROOT/'自制工具/voxel_workbench'))
from addon import api
manifest=json.loads((KIT/'kit-manifest.json').read_text(encoding='utf-8'))

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def meshes(): return [o for o in bpy.data.objects if o.type=='MESH']
def points(objects): return [o.matrix_world@v.co for o in objects for v in o.data.vertices]
def bounds(objects):
    p=points(objects)
    return {'min':[min(v[i] for v in p) for i in range(3)],'max':[max(v[i] for v in p) for i in range(3)]}
def geometry_signature(objects):
    solids=[]
    for o in objects:
        solids.append(sorted(tuple(0.0 if abs(v)<.0000005 else round(v,6) for v in (o.matrix_world@p.co)) for p in o.data.vertices))
    return hashlib.sha256(json.dumps(sorted(solids),separators=(',',':')).encode()).hexdigest()
def occupied(p, boxes):
    return any(all(b['min'][i]+1e-7 < p[i] < b['max'][i]-1e-7 for i in range(3)) for b in boxes)

def orthographic(asset_id,role,logical):
    source_hash=api.fingerprint(api.root(asset_id))
    scene=bpy.context.scene
    scene.render.engine='BLENDER_EEVEE'
    scene.render.resolution_x=480; scene.render.resolution_y=480
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='Standard'
    scene.world=bpy.data.worlds.new('QA neutral world')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.065,.075,.085,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
    center=Vector((0,0,logical[1]/2))
    for name,location,power,size in [('Key',(2,-3,4),350,4),('Fill',(-3,-1,2),180,4),('Rim',(1,3,4),250,3)]:
        light=bpy.data.lights.new(name,'AREA'); light.energy=power; light.shape='DISK'; light.size=size
        obj=bpy.data.objects.new(name,light); scene.collection.objects.link(obj);obj.location=location
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    folder=QA/'orthographic'/role;folder.mkdir(parents=True,exist_ok=True)
    for name,location,target,ortho in [
      ('front',(0,-4,logical[1]/2),center,max(logical[0],logical[1])*1.35),
      ('side',(-4,0,logical[1]/2),center,max(logical[2],logical[1])*1.35),
      ('top',(0,0,4),(0,0,0),max(logical[0],logical[2])*1.35)]:
        camera=bpy.data.cameras.new(name);camera.type='ORTHO';camera.ortho_scale=ortho
        obj=bpy.data.objects.new(name,camera);scene.collection.objects.link(obj);obj.location=location
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
        scene.camera=obj;scene.render.filepath=str(folder/(name+'.png'));bpy.ops.render.render(write_still=True)
    assert source_hash==api.fingerprint(api.root(asset_id))

report={'status':'PASS','method':'Saved native meshes reopened with scripts disabled; independent FBX import into empty factory scene; no recipe replay',
 'axes':{'native':'Blender X length, Y width symmetric, Z up','logical':'X length, Y height, Z width','unityAdapterYaw':180},'assets':[]}
for entry in manifest['assets']:
    role=entry['role'];asset_id=entry['id'];source=KIT/entry['source'];fbx=KIT/entry['fbx']
    disk_before=sha(source)
    bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
    objs=meshes();native_bounds=bounds(objs);signature=geometry_signature(objs)
    profile=api.get_profile(asset_id)
    assert profile['grid_step']==.125 and profile['size_step']==.125
    assert profile['id']=='workshop.bridge.B.detail125'
    assert len([c for c in bpy.data.collections if c.get('vw_asset_id')])<=1
    logical=entry['logicalSizeMeters'];expected=[logical[0],logical[2],logical[1]]
    for i,size in enumerate(expected):
        assert abs(native_bounds['min'][i]-(0 if i==2 else -size/2))<1e-6
        assert abs(native_bounds['max'][i]-(size if i==2 else size/2))<1e-6
    raw_boxes=[bounds([o]) for o in objs]
    mirror=sorted((tuple(round(v[0],6) for v in b.values())) for b in [])
    bboxset={tuple(round(n,6) for n in b['min']+b['max']) for b in raw_boxes}
    for b in raw_boxes:
        reflected=[b['min'][0],-b['max'][1],b['min'][2],b['max'][0],-b['min'][1],b['max'][2]]
        assert tuple(round(n,6) for n in reflected) in bboxset, f'{role} not symmetric across native Y'
    semantics={}
    if role in ('deck','tread'):
        assert all(occupied((x,y,.2499),raw_boxes) for x in [-.249,-.125,.001,.125,.249] for y in [-.249,-.125,.001,.125,.249])
        semantics['continuousWalkableTopAt025']=True
    if role=='tread':
        assert not occupied((-.1875,.01,.0625),raw_boxes)
        assert occupied((.1875,.01,.0625),raw_boxes)
        assert occupied((-.1875,.01,.1875),raw_boxes)
        semantics['noseOnNegativeX']=True
    if role=='rail':
        assert not occupied((0,0,.25),raw_boxes) and not occupied((0,0,.75),raw_boxes)
        assert occupied((0,0,.4375),raw_boxes)
        semantics['twoActualOpenWindows']=True
    saved_fingerprint=api.fingerprint(api.root(asset_id))
    assert all(tuple(round(x,6) for x in o.location)==(0,0,0) for o in objs)
    if role in ('tread','deck','post','rail'):
        orthographic(asset_id,role,logical)
    assert sha(source)==disk_before
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(fbx),use_anim=False)
    imported=meshes();export_bounds=bounds(imported)
    for key in ('min','max'):
        assert all(abs(a-b)<1e-5 for a,b in zip(export_bounds[key],native_bounds[key])),(role,export_bounds,native_bounds)
    assert geometry_signature(imported)==signature, f'{role}: FBX changed actual solid geometry'
    uvloops=0;images=set();matrixes=[]
    for o in imported:
        assert len(o.data.uv_layers)>0
        uv=o.data.uv_layers.active.data
        assert len(uv)==len(o.data.loops)>0
        assert all(math.isfinite(c) and 0<=c<=1 for value in uv for c in value.uv)
        uvloops+=len(uv)
        for mat in o.data.materials:
            assert mat and mat.use_nodes
            for node in mat.node_tree.nodes:
                if node.type=='TEX_IMAGE' and node.image:
                    images.add(Path(node.image.filepath).name)
        matrixes.append({'name':o.name,'matrixWorld':[list(row) for row in o.matrix_world]})
    assert Path(entry['palette']).name in images,(role,images)
    palette=KIT/entry['palette'];image=bpy.data.images.load(str(palette),check_existing=False)
    assert image.size[0]>0 and image.size[1]>0
    report['assets'].append({'role':role,'sourceReopened':True,'scriptsDisabled':True,'nativeBounds':native_bounds,
      'fbxWorldBoundsAfterImport':export_bounds,'exactGeometryRoundtrip':True,'geometrySignatureSha256':signature,
      'profileId':profile['id'],'detailUnitMeters':profile['grid_step'],'nativeFingerprint':saved_fingerprint,
      'sourceSha256':disk_before,'fbxSha256':sha(fbx),'paletteSha256':sha(palette),
      'paletteDimensions':list(image.size),'uvLoops':uvloops,'textureReferences':sorted(images),
      'meshCount':len(imported),'nativeBoxesForMeasuredDiagrams':raw_boxes,'semantics':semantics,
      'fbxImportedObjectMatrices':matrixes})
    (QA/'independent-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('PASS',role,flush=True)
print('ALL_NINE_NATIVE_AND_FBX_PASS',flush=True)
