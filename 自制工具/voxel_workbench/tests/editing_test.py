import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from addon import api
for aid in ('a','b'):
    api.apply_recipe(dict(schema_version='0.1',request_id='make',asset_id=aid,expected_revision=0,
     profile_id='project.demo',profile_revision=1,operations=[dict(op='place',id='cube',template_id='base.cube',color_id='stone.base')]))
api.update_palette('a','stone.base',[1,0,0,1],scope='asset')
assert tuple(api.get_object('a','cube').data.materials[0].diffuse_color)==(1,0,0,1)
assert api.get_object('b','cube').data.materials[0].diffuse_color[1]>.1
api.save_template('custom.tile',[8,4,1],'box')
assert api.get_profile()['templates']['custom.tile']['size_cells']==[8,4,1]
bpy.ops.mesh.primitive_cube_add(location=(4,0,0))
native=bpy.context.object
api.adopt_static('a',native,'native','stone.dark')
assert api.get_object('a','native') is native
assert 'vw_parametric' not in native
print('EDITING PASS')
