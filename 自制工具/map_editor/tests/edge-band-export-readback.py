"""Blender-only verification of author geometry and exact PNG bytes through imported UVs."""
import bpy, json, math, os, struct, sys, zlib
from mathutils import Vector


def png(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, payload = 8, b''
    while offset < len(data):
        length = struct.unpack_from('>I', data, offset)[0]
        kind, body = data[offset+4:offset+8], data[offset+8:offset+8+length]
        if kind == b'IHDR':
            width, height, depth, color, *_ = struct.unpack('>IIBBBBB', body)
            assert depth == 8 and color == 6, ('expected opaque RGBA8 PNG', depth, color)
        if kind == b'IDAT': payload += body
        offset += length + 12
    raw = zlib.decompress(payload)
    stride, rows, previous, offset = width * 4, [], bytearray(width * 4), 0
    for _ in range(height):
        filter_type, offset = raw[offset], offset + 1
        row = bytearray(raw[offset:offset+stride]); offset += stride
        for x in range(stride):
            left = row[x-4] if x >= 4 else 0
            up = previous[x]
            upper_left = previous[x-4] if x >= 4 else 0
            if filter_type == 1: row[x] = (row[x] + left) & 255
            elif filter_type == 2: row[x] = (row[x] + up) & 255
            elif filter_type == 3: row[x] = (row[x] + (left + up)//2) & 255
            elif filter_type == 4:
                p = left + up - upper_left
                a, b, c = abs(p-left), abs(p-up), abs(p-upper_left)
                row[x] = (row[x] + (left if a <= b and a <= c else up if b <= c else upper_left)) & 255
            else: assert filter_type == 0
        rows.append(row); previous = row
    return width, height, rows


def srgb(linear):
    return round(255 * (12.92 * linear if linear <= .0031308 else 1.055 * max(0, linear)**(1/2.4) - .055))


def barycentric(point, verts, axes):
    a, b, c = [[v[axes[0]], v[axes[1]]] for v in verts]
    p = [point[axes[0]], point[axes[1]]]
    denominator = (b[1]-c[1])*(a[0]-c[0]) + (c[0]-b[0])*(a[1]-c[1])
    if abs(denominator) < 1e-14: return None
    x = ((b[1]-c[1])*(p[0]-c[0]) + (c[0]-b[0])*(p[1]-c[1]))/denominator
    y = ((c[1]-a[1])*(p[0]-c[0]) + (a[0]-c[0])*(p[1]-c[1]))/denominator
    z = 1-x-y
    return (x, y, z) if min(x,y,z) >= -1e-6 else None


def verify(case, kind):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    if kind == 'glb': bpy.ops.import_scene.gltf(filepath=case[kind])
    else: bpy.ops.import_scene.fbx(filepath=case[kind])
    charts, images, vertices = {}, {}, []
    volume, area, uv_checks, triangles = 0.0, 0.0, 0, 0
    for obj in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        mesh = obj.data; mesh.calc_loop_triangles()
        verts = [obj.matrix_world @ v.co for v in mesh.vertices]; vertices += verts
        for tri in mesh.loop_triangles:
            points = [verts[i] for i in tri.vertices]
            cross = (points[1]-points[0]).cross(points[2]-points[0])
            area += cross.length/2
            volume += points[0].dot(points[1].cross(points[2]))/6
            normal = cross.normalized(); axis = max(range(3), key=lambda a: abs(normal[a]))
            assert abs(normal[axis]) > .99999, ('non-axis geometry', obj.name, list(normal))
            face = axis*2 + (0 if normal[axis] > 0 else 1)
            plane = points[0][axis]
            assert all(abs(v[axis]-plane) < 1e-6 for v in points)
            material = mesh.materials[tri.material_index]
            nodes = list(material.node_tree.nodes) if material and material.use_nodes else []
            textures = [node for node in nodes if node.type == 'TEX_IMAGE' and node.image]
            texture, uvs = None, None
            if textures:
                image = textures[0].image
                if image.name not in images:
                    file = bpy.path.abspath(image.filepath)
                    if image.packed_file: data = bytes(image.packed_file.data)
                    else:
                        assert os.path.isfile(file), ('missing PNG dependency', file)
                        with open(file,'rb') as stream: data=stream.read()
                    images[image.name] = png(data)
                texture = images[image.name]
                assert mesh.uv_layers.active is not None
                uvs = [mesh.uv_layers.active.data[li].uv.copy() for li in tri.loops]
                uv_checks += 1
                shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
                assert shader.inputs['Base Color'].is_linked
            else:
                shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
                color = [srgb(v) for v in shader.inputs['Base Color'].default_value[:3]]
            chart = (face, round(plane*64))
            charts.setdefault(chart, []).append((points, texture, uvs, color if not textures else None))
            triangles += 1
    bbox = [[min(v[a] for v in vertices) for a in range(3)], [max(v[a] for v in vertices) for a in range(3)]]
    assert all(abs(bbox[i][a]-case['bbox'][i][a]) < 1e-6 for i in range(2) for a in range(3)), ('bbox changed', bbox, case['bbox'])
    assert abs(abs(volume)-case['volume']) < 1e-6, ('volume changed', volume, case['volume'])
    assert abs(area-case['area']) < 1e-6, ('exposed surface area changed', area, case['area'])
    checked, colors, coverage = 0, set(), {}
    for sample in case['samples']:
        point, face = Vector(sample['point']), sample['face']
        axis, axes = face//2, [a for a in range(3) if a != face//2]
        chart = (face, round(point[axis]*64)); matches=[]
        for points, texture, uvs, color in charts.get(chart, []):
            weights = barycentric(point, points, axes)
            if weights is None: continue
            if texture:
                uv = sum((uvs[i]*weights[i] for i in range(3)), Vector((0,0)))
                width, height, rows = texture
                x = min(width-1,max(0,math.floor(uv.x*width)))
                y = min(height-1,max(0,height-1-math.floor(uv.y*height)))
                color = list(rows[y][x*4:x*4+3])
                assert rows[y][x*4+3] == 255
            matches.append(color)
        assert matches, ('missing author surface', kind, sample)
        assert all(color == sample['rgb'] for color in matches), ('wrong PNG/UV texel', case['name'], kind, sample, matches)
        checked += 1; colors.add(tuple(sample['rgb'])); coverage[face]=coverage.get(face,0)+1
    assert len(coverage) == 6 and uv_checks > 0
    return {'name':case['name'], 'kind':kind, 'checkedPixels':checked, 'uvChecks':uv_checks, 'triangles':triangles, 'volume':abs(volume), 'area':area, 'bbox':bbox, 'sourceColors':len(colors), 'sixFaceDirections':True}


file = sys.argv[sys.argv.index('--')+1]
with open(file,encoding='utf8') as stream: cases=json.load(stream)
report={'blender':bpy.app.version_string, 'cases':[verify(case,kind) for case in cases for kind in ['glb','fbx']]}
print('N3_EXPORT '+json.dumps(report))
