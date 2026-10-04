"""Read published GLB/FBX through isolated copies and prove Blender round-trip geometry."""
import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from glb_to_fbx import windows_path

parser = argparse.ArgumentParser()
parser.add_argument('--package', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
package = windows_path(args.package)
output = windows_path(args.output)
report_path = windows_path(args.report)
output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((package / 'manifest.json').read_text(encoding='utf8'))
checks = []

def points(filename, kind):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if kind == 'glb':
        bpy.ops.import_scene.gltf(filepath=str(filename))
    else:
        bpy.ops.import_scene.fbx(filepath=str(filename), use_image_search=False)
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    if not meshes:
        raise AssertionError('No imported geometry')
    return set(tuple(round(n, 4) for n in (obj.matrix_world @ vertex.co)) for obj in meshes for vertex in obj.data.vertices)

with tempfile.TemporaryDirectory(prefix='fbx-proof-', dir=str(output)) as temporary:
    copied = windows_path(temporary) / 'output'
    shutil.copytree(package / 'output', copied)
    pairs = [('output/target.glb', 'output/target.fbx')]
    pairs.extend((dep['glbPath'], dep['unity']['modelPath']) for dep in manifest['dependencies'] if dep['kind'] == 'external')
    for glb, fbx in pairs:
        original = points(copied / Path(glb).relative_to('output'), 'glb')
        received = points(copied / Path(fbx).relative_to('output'), 'fbx')
        if original != received:
            raise AssertionError('Geometry mismatch: ' + fbx + ' expected-only=' + str(list(original-received)[:5]) + ' actual-only=' + str(list(received-original)[:5]))
        checks.append({'model': fbx, 'worldVertexSetEqual': True, 'uniqueWorldVertices': len(original)})

sidecar = json.loads((package / 'output/target.xhmaterials.json').read_text(encoding='utf8'))
for wanted in [[128/255]*3, [1,0,0], [0,1,0], [0,0,1]]:
    if not any(all(abs(a-b) < 1e-6 for a,b in zip(color['baseColor_sRGB'], wanted)) for color in sidecar['colors']):
        raise AssertionError('Missing exact source RGB: ' + str(wanted))
if not any(color.get('alphaMode') == 'MASK' and abs(color.get('alpha', 0)-.5) < 1e-6 and color.get('doubleSided') for color in sidecar['colors']):
    raise AssertionError('MASK/alpha/double-sided source contract lost')
if not sidecar['textureDependencies']:
    raise AssertionError('PNG dependency missing')
result = {'passed': True, 'blender': bpy.app.version_string, 'geometry': checks, 'materialContract': ['exact gray/R/G/B', 'MASK alpha .5 double-sided', 'explicit PNG dependencies'], 'note': 'Blender round-trip and canonical sidecar verified; Unity rendering is a separate proof.'}
report_path.write_text(json.dumps(result, indent=2), encoding='utf8')
print('WORKSHOP_FBX_BLENDER_PROOF_PASS')
