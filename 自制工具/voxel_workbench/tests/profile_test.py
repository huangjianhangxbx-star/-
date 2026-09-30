import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from addon import api
profile=api.get_profile(); api.set_default_profile(profile)
api.apply_recipe(dict(schema_version='0.1',request_id='a',asset_id='old',expected_revision=0,
 profile_id=profile['id'],profile_revision=1,operations=[]))
profile['grid_step']=.5; profile['size_step']=.5;profile['revision']=2
api.set_default_profile(profile)
assert api.get_profile()['grid_step']==.5
assert api.get_profile('old')['grid_step']==.25
try: api.set_default_profile({**profile,'grid_step':0})
except ValueError: pass
else: raise AssertionError('Zero step accepted')
print('PROFILE PASS')
