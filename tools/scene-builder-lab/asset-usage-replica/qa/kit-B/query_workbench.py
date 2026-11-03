import json, sys
from pathlib import Path
ROOT = Path('E:/WORLDCREATOR/XingHaiHuiLang/Origin')
sys.path.insert(0, str(ROOT / '自制工具/voxel_workbench'))
from addon import api
data = {'api': api.__file__, 'capabilities': api.capabilities(), 'profile': api.get_profile()}
out = ROOT / 'work/scene-builder-lab/asset-usage-replica/qa/kit-B/workbench-discovery.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(data, indent=2, ensure_ascii=False))
