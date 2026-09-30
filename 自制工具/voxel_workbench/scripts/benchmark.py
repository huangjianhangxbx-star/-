import sys,json,time,platform
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from addon import api
results=[]
for n,counts in [(1000,[10,10,10]),(10000,[100,10,10])]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    recipe=dict(schema_version='0.1',request_id='bench',asset_id='bench',expected_revision=0,
        profile_id='project.demo',profile_revision=1,operations=[dict(op='place_array',id_prefix='b',
        template_id='base.cube',color_id='stone.base',count=counts,spacing_cells=[4,4,4])])
    start=time.perf_counter();api.apply_recipe(recipe);elapsed=time.perf_counter()-start
    results.append(dict(blocks=n,build_seconds=elapsed,mesh_datablocks=len(bpy.data.meshes),
                        inspection=api.validate_asset('bench')))
out=ROOT/'artifacts'/'performance.json'
out.write_text(json.dumps(dict(blender=bpy.app.version_string,platform=platform.platform(),
    processor=platform.processor(),mode='background; no FPS or brush-latency claim',measurements=results),indent=2),encoding='utf-8')
print(out.read_text())
