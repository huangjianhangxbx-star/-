"""Run with installed Blender --background --factory-startup --python this.py -- source.fbx report.json expected-palette.png.
Independent portable-output check; does not load Unity author code or modify the FBX.
"""
import bpy, sys, os, json, math, hashlib
from collections import defaultdict

source, destination, palette_file = sys.argv[sys.argv.index('--')+1:][:3]
source = os.path.abspath(source)
bpy.ops.wm.read_factory_settings(use_empty=True)
expected_image=bpy.data.images.load(os.path.abspath(palette_file),check_existing=False)
expected_pixels=list(expected_image.pixels[:])
palette_width=expected_image.size[0]
bpy.data.images.remove(expected_image)
bpy.ops.import_scene.fbx(filepath=source)
edges = defaultdict(lambda: [0, 0])
triangles = set()
duplicates = degenerates = bad_normals = off_grid = 0
total = 0
uv_errors = 0
uv_slots = set()
volume = max_error = 0.0
all_points = []

def edge(a, b):
    delta = tuple(b[i]-a[i] for i in range(3))
    n = math.gcd(math.gcd(abs(delta[0]), abs(delta[1])), abs(delta[2]))
    if n == 0:
        return
    step = tuple(d//n for d in delta)
    for i in range(n):
        u = tuple(a[j]+step[j]*i for j in range(3))
        v = tuple(u[j]+step[j] for j in range(3))
        forward = u < v
        value = edges[(u,v) if forward else (v,u)]
        value[0] += 1
        value[1] += 1 if forward else -1

for obj in bpy.context.scene.objects:
    if obj.type != 'MESH':
        continue
    mesh = obj.data
    mesh.calc_loop_triangles()
    if mesh.uv_layers.active is None:
        uv_errors += 1
    else:
        for uv in mesh.uv_layers.active.data:
            slot = round(float(uv.uv.x)*palette_width-.5)
            uv_slots.add(slot)
            uv_errors += slot < 0 or slot >= palette_width or abs(float(uv.uv.x)-(slot+.5)/palette_width)>1e-5 or abs(float(uv.uv.y)-.5)>1e-5
    world = [obj.matrix_world @ v.co for v in mesh.vertices]
    points = []
    for p in world:
        q = tuple(round(float(p[i])*16) for i in range(3))
        error = max(abs(float(p[i])-q[i]/16) for i in range(3))
        max_error = max(error, max_error)
        off_grid += error > 1e-4
        points.append(q)
        all_points.append(tuple(float(x) for x in p))
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    for tri in mesh.loop_triangles:
        total += 1
        a, b, c = [points[i] for i in tri.vertices]
        u = tuple(b[i]-a[i] for i in range(3))
        v = tuple(c[i]-a[i] for i in range(3))
        cross = (u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0])
        degenerates += cross == (0,0,0)
        key = tuple(sorted((a,b,c)))
        duplicates += key in triangles
        triangles.add(key)
        edge(a,b); edge(b,c); edge(c,a)
        volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/(6*16**3)
        length = math.sqrt(sum(x*x for x in cross))
        if length:
            face = tuple(x/length for x in cross)
            for loop_index in tri.loops:
                normal = (normal_matrix @ mesh.corner_normals[loop_index].vector).normalized()
                if sum(face[i]*normal[i] for i in range(3)) < .99:
                    bad_normals += 1

coverage = sum(value[0] != 2 for value in edges.values())
direction = sum(value[1] != 0 for value in edges.values())
images = []
for image in bpy.data.images:
    if image.name == 'Render Result':
        continue
    pixels=list(image.pixels[:])
    colors_ok = len(pixels)==len(expected_pixels) and max(abs(a-b) for a,b in zip(pixels,expected_pixels))<1e-4
    images.append(dict(name=image.name,size=list(image.size),packed=image.packed_file is not None,colorsMatch=colors_ok))
helpers = [dict(name=o.name,type=o.type) for o in bpy.context.scene.objects if o.type not in ('MESH','EMPTY')]
lo = [min(p[i] for p in all_points) for i in range(3)]
hi = [max(p[i] for p in all_points) for i in range(3)]
palette = any(i['size']==[palette_width,1] and i['packed'] and i['colorsMatch'] for i in images)
mesh_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
used_materials = sorted({slot.material for obj in mesh_objects for slot in obj.material_slots if slot.material is not None}, key=lambda m: m.name)
material_details = []
for material in used_materials:
    texture_nodes = []
    if material.use_nodes and material.node_tree:
        texture_nodes = [dict(name=node.image.name, packed=node.image.packed_file is not None, size=list(node.image.size)) for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image is not None]
    material_details.append(dict(name=material.name, useNodes=material.use_nodes, textures=texture_nodes))
report = dict(file=os.path.basename(source),sha256=hashlib.sha256(open(source,'rb').read()).hexdigest(),blenderVersion=bpy.app.version_string,
              meshObjects=len(mesh_objects),meshDatablocks=len({o.data for o in mesh_objects}),materialCount=len(used_materials),materials=material_details,
              meshes=[dict(name=o.name,vertices=len(o.data.vertices),triangles=len(o.data.loop_triangles)) for o in mesh_objects],
              coordinateNote='Blender world coordinates after normal FBX import (Z-up); compare Unity width/height/depth with the corresponding axis conversion, not component order alone.',
              triangles=total,duplicateTriangles=duplicates,degenerateTriangles=degenerates,atomicEdgeCoverageErrors=coverage,
              atomicEdgeDirectionErrors=direction,offLatticeVertices=off_grid,maxQuantizationError=max_error,
              badCornerNormals=bad_normals,signedVolume=volume,boundsMin=lo,boundsMax=hi,size=[hi[i]-lo[i] for i in range(3)],
              embeddedPalette=palette,expectedPalette=os.path.basename(palette_file),paletteWidth=palette_width,images=images,uvSlots=sorted(uv_slots),uvSlotErrors=uv_errors,unexpectedObjects=helpers)
report['pass'] = total>0 and all(x==0 for x in (duplicates,degenerates,coverage,direction,off_grid,bad_normals,uv_errors)) and volume>0 and palette and {0,1,2,3}.issubset(uv_slots) and not helpers
os.makedirs(os.path.dirname(os.path.abspath(destination)),exist_ok=True)
with open(destination,'w',encoding='utf-8') as f:
    json.dump(report,f,ensure_ascii=False,indent=2)
print('LE01_INDEPENDENT_FBX '+json.dumps(report,ensure_ascii=False))
if not report['pass']:
    raise RuntimeError('Independent FBX acceptance failed')
