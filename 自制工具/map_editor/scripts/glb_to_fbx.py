"""Run in isolated Blender --background --factory-startup; never edits input files."""
import argparse
import json
import os
import sys
import struct
import hashlib
import base64
import tempfile
from pathlib import Path
import bpy
from mathutils import Vector


def windows_path(value):
    resolved = str(Path(value).resolve())
    if os.name == 'nt' and not resolved.startswith('\\\\?\\'):
        resolved = '\\\\?\\UNC\\' + resolved[2:] if resolved.startswith('\\\\') else '\\\\?\\' + resolved
    return Path(resolved)


def convert(source, destination):
    source, destination = windows_path(source), windows_path(destination)
    if source == destination or source.suffix.lower() != '.glb' or destination.suffix.lower() != '.fbx':
        raise ValueError('Expected separate GLB source and FBX destination')
    if source.read_bytes()[:4] != b'glTF':
        raise ValueError('Invalid GLB header')
    previous_selection = list(bpy.context.selected_objects)
    previous_active = bpy.context.view_layer.objects.active
    before = set(bpy.data.objects)
    before_images=set(bpy.data.images)
    before_materials=set(bpy.data.materials)
    imported = []
    temporary = None
    material_temp = None
    import_temp = None
    created_textures=[]
    texture_dir=destination.with_suffix(".xhtextures")
    texture_dir_created=False
    committed=False
    try:
        bpy.ops.object.select_all(action='DESELECT')
        # Tag a temporary copy so Blender-renamed materials retain the exact glTF
        # factor, including linked textures whose inactive BSDF defaults are .8.
        raw=source.read_bytes()
        json_length=struct.unpack_from('<I',raw,12)[0]
        gltf=json.loads(raw[20:20+json_length])
        source_materials=gltf.get('materials',[])
        for index,spec in enumerate(source_materials):
            if not isinstance(spec.get('extras'),dict): spec['extras']={}
            spec['extras']['xh_exchange_index']=index
        image_paths={}
        for index,image in enumerate(gltf.get('images',[])):
            mime=image.get('mimeType')
            if 'bufferView' in image:
                view=gltf['bufferViews'][image['bufferView']]
                if view.get('buffer',0)!=0: raise ValueError('External image buffers unsupported')
                offset=28+json_length+view.get('byteOffset',0)
                content=raw[offset:offset+view['byteLength']]
            elif image.get('uri','').startswith('data:'):
                header,data=image['uri'].split(',',1);mime=header[5:].split(';')[0]
                content=base64.b64decode(data,validate=True)
            else: raise ValueError('GLB images must be embedded')
            if mime not in ('image/png','image/jpeg'): raise ValueError('Only PNG/JPEG FBX textures supported')
            suffix='.png' if mime=='image/png' else '.jpg'
            target=texture_dir/(hashlib.sha256(content).hexdigest()+suffix)
            if not texture_dir.exists(): texture_dir.mkdir(parents=True);texture_dir_created=True
            if target.exists():
                if target.read_bytes()!=content: raise ValueError('Texture dependency hash conflict')
            else:
                with target.open('xb') as output: output.write(content)
                created_textures.append(target)
            image_paths[index]=target
            image['name']='XH_EXCHANGE_IMAGE_'+str(index)
        payload=json.dumps(gltf,separators=(',',':')).encode('utf8')
        payload+=b' '*((-len(payload))%4)
        tail=raw[20+json_length:]
        tagged=struct.pack('<4sII',b'glTF',2,20+len(payload)+len(tail))+struct.pack('<I4s',len(payload),b'JSON')+payload+tail
        destination.parent.mkdir(parents=True,exist_ok=True)
        fd,import_temp=tempfile.mkstemp(prefix=destination.stem+'.',suffix='.glb',dir=destination.parent)
        os.close(fd);Path(import_temp).write_bytes(tagged)
        bpy.ops.import_scene.gltf(filepath=import_temp)
        imported = list(set(bpy.data.objects) - before)
        for image in set(bpy.data.images)-before_images:
            if image.name.startswith('XH_EXCHANGE_IMAGE_'):
                index=int(image.name[len('XH_EXCHANGE_IMAGE_'):].split('.')[0])
                image.filepath_raw=str(image_paths[index])
        meshes = [o for o in imported if o.type == 'MESH']
        if not meshes:
            raise ValueError('GLB has no meshes')
        # FBX's shared-mesh material indexing can disagree with glTF object slots.
        # Realize only the temporary export meshes; native source/GLB remain shared.
        for obj in meshes:
            slots=[slot.material for slot in obj.material_slots]
            old_mesh=obj.data;obj.data=old_mesh.copy()
            for slot,material in zip(obj.material_slots,slots):
                slot.link='DATA';slot.material=material
            if old_mesh.users==0: bpy.data.meshes.remove(old_mesh)
        points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
        colors = []
        material_specs = {}
        for o in meshes:
            for material in o.data.materials:
                if material and material.use_nodes:
                    shader = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
                    if shader:
                        index=material.get('xh_exchange_index')
                        if index is None: raise ValueError('Imported material lost source identity')
                        spec=source_materials[int(index)];pbr=spec.get('pbrMetallicRoughness',{})
                        rgba=pbr.get('baseColorFactor',[1,1,1,1]);colors.append(list(shader.inputs['Base Color'].default_value))
                        material_specs[material.name]={'colorId':material.name,
                            'baseColor_sRGB':[12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in rgba[:3]],
                            'alpha':rgba[3],'roughness':pbr.get('roughnessFactor',1),
                            'metallic':pbr.get('metallicFactor',1),
                            'emissive':spec.get('emissiveFactor',[0,0,0]),
                            'emissiveStrength':spec.get('extensions',{}).get('KHR_materials_emissive_strength',{}).get('emissiveStrength',1),
                            'alphaMode':spec.get('alphaMode','OPAQUE'),'alphaCutoff':spec.get('alphaCutoff',.5),
                            'doubleSided':spec.get('doubleSided',False),
                            'baseColorTexture':'baseColorTexture' in pbr}
                        if 'baseColorTexture' in pbr:
                            image_index=gltf['textures'][pbr['baseColorTexture']['index']]['source']
                            material_specs[material.name]['baseColorTexturePath']=image_paths[image_index].relative_to(destination.parent).as_posix()
        report = {'blender': bpy.app.version_string, 'source':str(source),'destination':str(destination),
                  'meshes': len(meshes), 'bounds': {'min':[min(p[i] for p in points) for i in range(3)],
                  'max':[max(p[i] for p in points) for i in range(3)]}, 'base_colors': colors,
                  'axes': {'source':'GLB RH Y-up meters','blender':'RH Z-up meters','fbx_forward':'-Z','fbx_up':'Y'},
                  'receiver_validation':'required separately; no automatic additional 180 degree correction'}
        destination.parent.mkdir(parents=True, exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=destination.stem+'.', suffix='.fbx', dir=destination.parent)
        os.close(fd)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in imported: obj.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.export_scene.fbx(filepath=temporary, use_selection=True, object_types={'MESH','EMPTY'},
                                 axis_forward='-Z', axis_up='Y', add_leaf_bones=False,
                                 path_mode='COPY', embed_textures=True)
        if Path(temporary).stat().st_size < 27:
            raise RuntimeError('FBX exporter produced empty output')
        sidecar=destination.with_suffix('.xhmaterials.json')
        material_data={'schema':'xinghai-fbx-materials-1','colors':list(material_specs.values()),
                       'axes':report['axes'],'textures':'Explicit immutable dependencies plus FBX embedded copy', 'textureDependencies':[p.relative_to(destination.parent).as_posix() for p in image_paths.values()],
                       'unsupported':['arbitrary Blender shader graphs','runtime behaviors']}
        fd,material_temp=tempfile.mkstemp(prefix=destination.stem+'.',suffix='.xhmaterials.json',dir=destination.parent)
        os.close(fd)
        Path(material_temp).write_text(json.dumps(material_data,indent=2),encoding='utf8')
        previous_fbx=destination.read_bytes() if destination.exists() else None
        previous_materials=sidecar.read_bytes() if sidecar.exists() else None
        try:
            os.replace(temporary,destination)
            os.replace(material_temp,sidecar)
        except Exception:
            if previous_fbx is None:
                if destination.exists(): destination.unlink()
            else: destination.write_bytes(previous_fbx)
            if previous_materials is None:
                if sidecar.exists(): sidecar.unlink()
            else: sidecar.write_bytes(previous_materials)
            raise
        committed=True
        report['material_sidecar']=str(sidecar)
        report['materials']=material_data['colors']
        return report
    finally:
        for obj in set(bpy.data.objects)-before:
            mesh = obj.data if obj.type == 'MESH' else None
            bpy.data.objects.remove(obj, do_unlink=True)
            if mesh and mesh.users == 0: bpy.data.meshes.remove(mesh)
        for material in set(bpy.data.materials)-before_materials:
            if material.users==0: bpy.data.materials.remove(material)
        for image in set(bpy.data.images)-before_images:
            if image.users==0: bpy.data.images.remove(image)
        if not committed:
            for texture in created_textures:
                if texture.exists(): texture.unlink()
            if texture_dir_created:
                try: texture_dir.rmdir()
                except OSError: pass
        for obj in previous_selection:
            if obj.name in bpy.context.view_layer.objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = previous_active
        if temporary and Path(temporary).exists(): Path(temporary).unlink()
        if material_temp and Path(material_temp).exists(): Path(material_temp).unlink()
        if import_temp and Path(import_temp).exists(): Path(import_temp).unlink()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--report')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    result=convert(args.input,args.output)
    if args.report: Path(args.report).write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result))




