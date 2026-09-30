import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from addon import api,presets
library=ROOT/'artifacts'/'test-library'
api.apply_recipe(dict(schema_version='0.1',request_id='p',asset_id='a',expected_revision=0,
 profile_id='project.demo',profile_revision=1,operations=[dict(op='place',id='cube',template_id='base.cube',color_id='stone.base')]))
result=presets.save_preset('a',['cube'],'test.cube','Test cube',library)
assert result['version']>=1
assert len(presets.list_presets(library))>=1
presets.place_preset('b','copy',library,'test.cube',result['version'],[2,0,0])
assert len(api.inspect_asset('b')['instances'])==1
assert api.get_object('b','copy.0').location.x==2
try: presets.save_preset('a',['cube'],'../escape','bad',library)
except ValueError: pass
else: raise AssertionError('Path traversal accepted')
print('PRESETS PASS')
