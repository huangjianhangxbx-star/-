import sys, json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from addon import api

def request(rid, revision, operations):
    return dict(schema_version='0.1',request_id=rid,asset_id='test.wall',expected_revision=revision,
                profile_id='project.demo',profile_revision=1,operations=operations)

op=dict(op='place_array',id_prefix='wall',template_id='base.cube',origin_cells=[0,0,0],
        size_cells=[4,4,4],count=[3,1,1],spacing_cells=[4,4,4],color_id='stone.base')
r=request('first',0,[op])
assert api.apply_recipe(r)['revision']==1
assert api.apply_recipe(r)['revision']==1
assert len(api.inspect_asset('test.wall')['instances'])==3
try: api.apply_recipe(request('stale',0,[dict(op='delete',id='wall.0.0.0')]))
except ValueError: pass
else: raise AssertionError('Stale request accepted')
before=api.inspect_asset('test.wall')
try: api.apply_recipe(request('bad',1,[dict(op='delete',id='wall.0.0.0'),dict(op='delete',id='missing')]))
except ValueError: pass
else: raise AssertionError('Invalid transaction accepted')
assert api.inspect_asset('test.wall')==before
api.apply_recipe(request('paint',1,[dict(op='paint',id='wall.0.0.0',color_id='leaf.dry',faces=[0])]))
a=api.get_object('test.wall','wall.0.0.0'); b=api.get_object('test.wall','wall.1.0.0')
assert a.data != b.data
assert a.data.materials[a.data.polygons[0].material_index]['vw_color']=='leaf.dry'
assert b.data.materials[b.data.polygons[0].material_index]['vw_color']=='stone.base'
a.data.vertices[0].co.x+=.1
assert api.inspect_asset('test.wall')['revision']==3
try: api.apply_recipe(request('external-stale',2,[dict(op='delete',id='wall.0.0.0')]))
except ValueError: pass
else: raise AssertionError('Native edit not detected')
out=ROOT/'artifacts'/'tests'; out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'integration.blend'))
bpy.ops.wm.open_mainfile(filepath=str(out/'integration.blend'))
assert api.inspect_asset('test.wall')['revision']==3
print('INTEGRATION PASS: transaction, replay, native edit, copy-on-write, persistence')
