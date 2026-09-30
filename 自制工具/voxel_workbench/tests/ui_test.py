import sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
import addon
addon.register()
s=bpy.context.scene.vw_settings
assert s.grid_step==.25
assert bpy.ops.vw.place_cursor()=={'FINISHED'}
from addon import api
assert len(api.inspect_asset(s.asset_id)['instances'])==1
addon.unregister()
assert not hasattr(bpy.types.Scene,'vw_settings')
addon.register(); addon.unregister()
print('UI REGISTER PASS (not interactive brush acceptance)')
