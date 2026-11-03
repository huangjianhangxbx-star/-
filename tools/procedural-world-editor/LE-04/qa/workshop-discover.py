import sys,json
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root.parents[2]/'自制工具'/'voxel_workbench'))
from addon import api
bpy.ops.wm.read_factory_settings(use_empty=True)
data={'capabilities':api.capabilities(),'profile':api.get_profile(),'export_voxel_asset':hasattr(api,'export_voxel_asset')}
(root/'reports'/'workshop-discovery.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('LE04_WORKSHOP_DISCOVERED')
