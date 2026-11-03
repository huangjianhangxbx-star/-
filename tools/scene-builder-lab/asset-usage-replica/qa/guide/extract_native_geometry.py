"""Read original workshop B meshes for precise documentation. Never save inputs."""
import bpy, hashlib, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'kits/B/kit-manifest.json').read_text(encoding='utf8'))
assets=[]
for item in manifest['assets']:
    source=ROOT/'kits/B'/item['source']
    before=hashlib.sha256(source.read_bytes()).hexdigest().upper()
    bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
    pieces=[]
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH':
            continue
        # The family adapter maps the native source (X,Y,Z) to author (X,Z,Y).
        # It is only a documentation frame; original vertices are never modified.
        vertices=[]
        for v in obj.data.vertices:
            p=obj.matrix_world @ v.co
            vertices.append([float(p.x),float(p.z),float(p.y)])
        faces=[]
        for face in obj.data.polygons:
            rgba=[.40,.53,.58,1]
            if face.material_index<len(obj.data.materials):
                mat=obj.data.materials[face.material_index]
                if mat:
                    rgba=list(mat.diffuse_color)
            faces.append({'indices':list(face.vertices),'linearRgba':rgba})
        pieces.append({'name':obj.name,'vertices':vertices,'faces':faces})
    assert pieces, 'No actual native mesh for '+item['role']
    vertices=[v for p in pieces for v in p['vertices']]
    low=[min(v[i] for v in vertices) for i in range(3)]
    high=[max(v[i] for v in vertices) for i in range(3)]
    expected_low=[-item['logicalSizeMeters'][0]/2,0,-item['logicalSizeMeters'][2]/2]
    expected_high=[item['logicalSizeMeters'][0]/2,item['logicalSizeMeters'][1],item['logicalSizeMeters'][2]/2]
    assert max(abs(low[i]-expected_low[i]) for i in range(3))<1e-5, (item['role'],low,expected_low)
    assert max(abs(high[i]-expected_high[i]) for i in range(3))<1e-5, (item['role'],high,expected_high)
    after=hashlib.sha256(source.read_bytes()).hexdigest().upper()
    assert before==after, 'Input source changed'
    assets.append({**item,'sourceSha256':before,'sourceVertices':len(vertices),'meshObjects':len(pieces),'bounds':{'min':low,'max':high},'pieces':pieces})
out=ROOT/'qa/guide/native-geometry.json'
out.write_text(json.dumps({'status':'PASS','kitId':manifest['id'],'kitVersion':manifest['version'],'scope':'Actual original B .blend vertices projected for public documentation. No Tiny Glade geometry. Inputs not modified.','assets':assets},indent=2),encoding='utf8')
print('GUIDE_NATIVE_GEOMETRY_PASS',len(assets))
