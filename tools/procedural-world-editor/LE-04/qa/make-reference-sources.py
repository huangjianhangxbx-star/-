import sys,json,hashlib
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root.parents[2]/'自制工具'/'voxel_workbench'))
from addon import api
def block(id,origin,size,color):
    return dict(op='place',id=id,template_id='base.cube',origin_cells=origin,size_cells=size,color_id=color)
sources=[('le04.reference.ridge',[
 block('foot',[0,0,0],[12,6,2],'stone.dark'),
 block('body',[-1,0,2],[8,6,2],'stone.base'),
 block('crest',[-2,-1,4],[4,4,2],'stone.light')]),
 ('le04.reference.notched-terrace',[
 block('foot',[0,0,0],[12,10,2],'stone.dark'),
 block('left',[-4,0,2],[4,10,2],'leaf.dry'),
 block('right',[2,2,2],[8,6,2],'stone.base'),
 block('cap',[-4,-2,4],[4,4,2],'stone.light')])]
manifest=[]
for asset,ops in sources:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    profile=api.get_profile()
    recipe=dict(schema_version='0.1',request_id=asset+'.initial.v1',asset_id=asset,expected_revision=0,profile_id=profile['id'],profile_revision=profile['revision'],operations=ops)
    directory=root/'references'/asset.rsplit('.',1)[1]
    directory.mkdir(parents=True,exist_ok=True)
    (directory/'recipe.json').write_text(json.dumps(recipe,ensure_ascii=False,indent=2),encoding='utf-8')
    api.apply_recipe(recipe)
    inspection=api.inspect_asset(asset)
    before=api.fingerprint(api.root(asset))
    blend=directory/'source.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),relative_remap=False)
    native_hash=hashlib.sha256(blend.read_bytes()).hexdigest()
    voxel=api.export_voxel_asset(asset,directory/'source.voxel.json')
    fbx=api.export_asset(asset,directory,mode='palette',format='FBX')
    glb=api.export_asset(asset,directory,mode='palette',format='GLB')
    api.render_preview(asset,str(directory/'preview.png'),resolution=700)
    after=api.fingerprint(api.root(asset))
    assert before==after,'Preview/export changed actual source'
    assert hashlib.sha256(blend.read_bytes()).hexdigest()==native_hash
    report=dict(asset=asset,inspection=inspection,fingerprint=before,blendSha256=native_hash,voxel=voxel,fbx=fbx,glb=glb,roles='all solid; generic colors, no terrain semantics',nativeUnchanged=True)
    (directory/'source-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    manifest.append(report)
(root/'references'/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('LE04_REFERENCES_COMPLETE')
