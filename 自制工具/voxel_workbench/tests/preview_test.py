import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from addon import api
from addon.preview import render_preview
api.apply_recipe(dict(schema_version='0.1',request_id='v',asset_id='view',expected_revision=0,
 profile_id='project.demo',profile_revision=1,operations=[dict(op='place',id='b',template_id='base.cube',color_id='leaf.dry')]))
before=api.inspect_asset('view'); scene=bpy.context.scene
path=ROOT/'artifacts'/'preview-test.png'
render_preview('view',path,resolution=256)
assert path.exists() and path.stat().st_size>1000
assert bpy.context.scene is scene and api.inspect_asset('view')==before
print('PREVIEW PASS')
