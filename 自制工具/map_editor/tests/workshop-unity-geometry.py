import bpy
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
result = {}
for name, package in [('a', root / 'validation/workshop-task7/real-project/releases/fbx-proof'), ('b', root / 'validation/workshop-task8/packages/releases/version-b')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(package / 'output/target.glb'))
    points = set()
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for vertex in obj.data.vertices:
                p = obj.matrix_world @ vertex.co
                points.add((round(p.x, 4), round(p.z, 4), round(p.y, 4)))
    result[name] = sorted(points)
(root / 'validation/workshop-task8/expected-unity-vertices.json').write_text(json.dumps(result), encoding='utf8')
print('WORKSHOP_UNITY_EXPECTED_GEOMETRY_PASS')
