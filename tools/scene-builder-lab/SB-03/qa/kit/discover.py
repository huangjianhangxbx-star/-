import sys, json
from pathlib import Path
import bpy
ROOT = Path(__file__).resolve().parents[5] / '自制工具' / 'voxel_workbench'
sys.path.insert(0, str(ROOT))
from addon import api
bpy.ops.wm.read_factory_settings(use_empty=True)
result = {'module': api.__file__, 'capabilities': api.capabilities(), 'profile': api.get_profile()}
(Path(__file__).resolve().parents[2] / 'kit' / 'discovery.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
