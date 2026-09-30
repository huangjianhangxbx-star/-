import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from addon import api
def req(rid,rev,pos):
    return dict(schema_version='0.1',request_id=rid,asset_id='collision',expected_revision=rev,
     profile_id='project.demo',profile_revision=1,operations=[dict(op='place',id=rid,template_id='base.cube',color_id='stone.base',origin_cells=pos)])
api.apply_recipe(req('a',0,[0,0,0]))
before=api.inspect_asset('collision')
try: api.apply_recipe(req('b',1,[1,0,0]))
except ValueError: pass
else: raise AssertionError('Overlapping solids accepted')
assert api.inspect_asset('collision')==before
api.apply_recipe(req('c',1,[4,0,0]))
assert len(api.inspect_asset('collision')['instances'])==2
print('COLLISION PASS')
