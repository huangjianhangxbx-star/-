"""Independent kit B: geometry authored only through the shared workbench API."""
import copy, json, sys, hashlib, traceback
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path('E:/WORLDCREATOR/XingHaiHuiLang/Origin')
BASE = ROOT / 'work/scene-builder-lab/asset-usage-replica'
KIT = BASE / 'kits/B'
QA = BASE / 'qa/kit-B'
sys.path.insert(0, str(ROOT / '自制工具/voxel_workbench'))
from addon import api

PROFILE = json.loads((QA / 'workbench-discovery.json').read_text(encoding='utf-8'))['profile']
PROFILE.update(id='workshop.bridge.B.detail125', revision=1, grid_step=0.125, size_step=0.125)
PROFILE['palette'] = {
    'stone.base': {'color':[0.63,0.44,0.28,1], 'roughness':0.94},
    'stone.light': {'color':[0.82,0.66,0.45,1], 'roughness':0.92},
    'stone.dark': {'color':[0.42,0.30,0.22,1], 'roughness':0.96},
    'cap.turquoise': {'color':[0.22,0.53,0.52,1], 'roughness':0.83},
    'cap.slate': {'color':[0.30,0.42,0.45,1], 'roughness':0.87},
    'wood.light': {'color':[0.76,0.60,0.37,1], 'roughness':0.92},
    'wood.honey': {'color':[0.61,0.43,0.24,1], 'roughness':0.94},
}

def box(name, low, high, color):
    """Meters to API bottom-center cell data; no direct mesh construction."""
    x,y,z=low; xx,yy,zz=high
    return {'op':'place','id':name,'template_id':'base.cube',
            'origin_cells':[0,0,0], 'anchor':'custom',
            'custom_anchor':[-(x+xx)/2,-(y+yy)/2,-(z+zz)/2],
            'size_cells':[(xx-x)*8,(yy-y)*8,(zz-z)*8], 'color_id':color}

def cap_tiles(prefix, z, color_a, color_b):
    return [box(f'{prefix}.{ix}.{iy}',(x,y,z),(x+.25,y+.25,z+.125),color_a if ix==iy else color_b)
            for ix,x in enumerate([-.25,0]) for iy,y in enumerate([-.25,0])]

ASSETS = [
 ('tread','潮石挑鼻踏步',[.5,.25,.5],
  [box('recessed.heel',(-.125,-.125,0),(.25,.125,.125),'stone.dark')]
  +cap_tiles('walk.stone',.125,'stone.light','stone.base')),
 ('deck','四拼悬边平台板',[.5,.25,.5],
  [box('inset.plinth',(-.125,-.125,0),(.125,.125,.125),'stone.base')]
  +cap_tiles('walk.quarter',.125,'cap.slate','stone.light')),
 ('coping','青釉双层压顶',[.5,.25,.25],
  [box('recessed.course',(-.25,-.0625,0),(.25,.0625,.125),'stone.base'),
   box('overhanging.cap',(-.25,-.125,.125),(.25,.125,.25),'cap.turquoise')]),
 ('rail','浅木双窗格栏',[.5,1,.125],
  [box('sill',(-.25,-.0625,0),(.25,.0625,.125),'wood.honey'),
   box('crossbar',(-.25,-.0625,.375),(.25,.0625,.5),'wood.light'),
   box('top.rail',(-.25,-.0625,.875),(.25,.0625,1),'wood.light')]
  +[box(f'stile.{side}.{level}',(x,-.0625,z),(x+.125,.0625,zz),'wood.light')
    for side,x in enumerate([-.25,.125]) for level,(z,zz) in enumerate([(.125,.375),(.5,.875)])]),
 ('post','束腰青帽石柱',[.25,1.25,.25],
  [box('foot',(-.125,-.125,0),(.125,.125,.125),'stone.base'),
   box('lower.shaft',(-.0625,-.0625,.125),(.0625,.0625,.5),'stone.light'),
   box('belt',(-.125,-.125,.5),(.125,.125,.625),'cap.slate'),
   box('upper.shaft',(-.0625,-.0625,.625),(.0625,.0625,1.125),'stone.light'),
   box('capital',(-.125,-.125,1.125),(.125,.125,1.25),'cap.turquoise')]),
 ('arch-stone','退面叠层拱石',[.25,.25,.25],
  [box('recessed.lower',(-.125,-.0625,0),(.125,.0625,.125),'stone.base'),
   box('bearing.upper',(-.125,-.125,.125),(.125,.125,.25),'stone.light')]),
 ('arch-foot','双檐起拱座',[.5,.5,.25],
  [box('footing',(-.25,-.125,0),(.25,.125,.125),'stone.dark'),
   box('inset.core',(-.125,-.0625,.125),(.125,.0625,.375),'stone.base'),
   box('bearing.cap',(-.25,-.125,.375),(.25,.125,.5),'cap.slate')]),
 ('keystone','阶肩青帽锁石',[.5,.5,.25],
  [box('lower.tooth',(-.125,-.0625,0),(.125,.0625,.125),'stone.dark'),
   box('middle.body',(-.125,-.125,.125),(.125,.125,.375),'stone.light'),
   box('upper.shoulders',(-.25,-.125,.375),(.25,.125,.5),'cap.turquoise')]),
 ('abutment-cap','四角铺面支承帽',[.5,.25,.5],
  [box('recessed.bearing',(-.125,-.125,0),(.125,.125,.125),'stone.dark')]
  +cap_tiles('overhanging.tile',.125,'cap.turquoise','cap.slate')),
]

def actual_bounds(objects):
    vs=[o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    return {'min':[min(v[i] for v in vs) for i in range(3)],
            'max':[max(v[i] for v in vs) for i in range(3)]}

KIT.mkdir(parents=True,exist_ok=True); QA.mkdir(parents=True,exist_ok=True)
manifest={'id':'workshop.bridge.B','version':'1','family':'bridge-orthogonal-v1','assets':[]}
evidence=[]
for role,title,logical,ops in ASSETS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    api.set_default_profile(copy.deepcopy(PROFILE))
    asset_id='workshop.bridge.B.'+role
    folder=KIT/role; folder.mkdir(parents=True,exist_ok=True)
    recipe={'schema_version':'0.1','request_id':f'bridge-B-v1-{role}-original',
            'asset_id':asset_id,'expected_revision':0,
            'profile_id':PROFILE['id'],'profile_revision':1,'operations':ops}
    (folder/'recipe.json').write_text(json.dumps(recipe,ensure_ascii=False,indent=2),encoding='utf-8')
    api.validate_recipe(recipe)
    applied=api.apply_recipe(recipe)
    validated=api.validate_asset(asset_id)
    inspected=api.inspect_asset(asset_id)
    before=api.fingerprint(api.root(asset_id))
    bpy.ops.wm.save_as_mainfile(filepath=str(folder/(role+'.blend')))
    exported_fbx=api.export_asset(asset_id,str(folder),mode='palette',format='FBX')
    exported_glb=api.export_asset(asset_id,str(folder),mode='palette',format='GLB')
    api.render_preview(asset_id,str(folder/'preview.png'),resolution=720)
    after=api.fingerprint(api.root(asset_id))
    assert before==after, f'{role}: export/render changed source'
    meshes=[o for o in bpy.data.objects if o.type=='MESH']
    bounds=actual_bounds(meshes)
    expected_blender=[logical[0],logical[2],logical[1]]
    for i in range(3):
        lo=0 if i==2 else -expected_blender[i]/2
        hi=expected_blender[i] if i==2 else expected_blender[i]/2
        assert abs(bounds['min'][i]-lo)<1e-6 and abs(bounds['max'][i]-hi)<1e-6,(role,bounds)
    files=list(folder.iterdir())
    fbx=next(p for p in files if p.suffix.lower()=='.fbx')
    palette=next(p for p in files if p.suffix.lower()=='.png' and p.name!='preview.png')
    manifest['assets'].append({'role':role,'id':asset_id,'title':title,'logicalSizeMeters':logical,
        'fbx':str(fbx.relative_to(KIT)).replace('\\','/'),
        'palette':str(palette.relative_to(KIT)).replace('\\','/'),
        'source':f'{role}/{role}.blend','preview':f'{role}/preview.png','unityAdapterYaw':180})
    evidence.append({'role':role,'sourceFingerprint':before,'boundsBlender':bounds,
      'apiValidation':validated,'apiInspection':inspected,'fbxExport':exported_fbx,
      'glbExport':exported_glb,'profile':api.get_profile(asset_id),
      'meshCount':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),
      'polygons':sum(len(o.data.polygons) for o in meshes),
      'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}})
    print('BUILT',role,len(meshes),bounds,flush=True)
    (KIT/'kit-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (QA/'build-validation.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
print('KIT_B_COMPLETE',flush=True)
