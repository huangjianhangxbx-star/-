"""Snapshot actual workbench default Profile and shader colors without changing its addon."""
import sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root.parent/'voxel_workbench'))
from addon.model import Profile
from addon import api
profile=Profile()
materials={}
for color_id in profile.palette:
    mat=api.material(color_id,profile,'exchange-proof')
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    materials[color_id]={'baseColor':list(bsdf.inputs['Base Color'].default_value),
                         'roughness':bsdf.inputs['Roughness'].default_value,
                         'emission':bsdf.inputs['Emission Strength'].default_value}
(root/'artifacts'/'exchange-proof'/'workbench-profile.json').write_text(json.dumps({'profile':profile.to_dict(),'materials':materials},indent=2),encoding='utf8')
print('WORKBENCH_PROFILE_SNAPSHOT_PASS')
