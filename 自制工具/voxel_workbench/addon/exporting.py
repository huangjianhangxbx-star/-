"""Export only temporary mesh copies; palette sampling has explicit GLB sampler."""
import json
import os
import struct
from pathlib import Path
import bpy
from . import api


def nearest_glb(path):
    raw=Path(path).read_bytes(); n=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+n]); tail=raw[20+n:]
    for sampler in data.get('samplers',[]): sampler.update(magFilter=9728,minFilter=9728)
    payload=json.dumps(data,separators=(',',':')).encode(); payload+=b' '*((-len(payload))%4)
    Path(path).write_bytes(struct.pack('<4sII',b'glTF',2,20+len(payload)+len(tail))+struct.pack('<I4s',len(payload),b'JSON')+payload+tail)


def palette_materials(copies,directory,stem):
    source=list(dict.fromkeys(m for o in copies for m in o.data.materials if m))
    width=max(1,len(source))*16
    image=bpy.data.images.new('VW.export.palette',width=width,height=16,alpha=True)
    # Byte image buffers use their declared sRGB space, unlike shader colors.
    image.colorspace_settings.name='sRGB'
    pixels=[]
    for y in range(16):
        for mat in source:
            color=[12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055 for v in mat.diffuse_color[:3]]+[mat.diffuse_color[3]]
            pixels.extend(color*16)
    image.pixels=pixels
    image.filepath_raw=str(directory/(stem+'.png')); image.file_format='PNG'; image.save()
    families={}; slots={}
    for i,mat in enumerate(source):
        old=mat.node_tree.nodes.get('Principled BSDF')
        key=(old.inputs['Roughness'].default_value,old.inputs['Metallic'].default_value,
             old.inputs['Emission Strength'].default_value,tuple(old.inputs['Emission Color'].default_value) if old.inputs['Emission Strength'].default_value else None,mat.use_backface_culling)
        if key not in families:
            new=mat.copy(); new.name='VW.palette.family'
            bsdf=new.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=(1,1,1,1)
            node=new.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image; node.interpolation='Closest'
            new.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
            families[key]=new
        slots[mat]=(families[key],(i+.5)/len(source))
    for obj in copies:
        mesh=obj.data; old_slots=list(mesh.materials); uv=mesh.uv_layers.new(name='Palette')
        used=list(dict.fromkeys(slots[m][0] for m in old_slots)); mesh.materials.clear()
        for m in used: mesh.materials.append(m)
        for face in mesh.polygons:
            family,u=slots[old_slots[face.material_index]]
            face.material_index=used.index(family)
            for loop in face.loop_indices: uv.data[loop].uv=(u,.5)
    return image,list(families.values())


def export_asset(asset_id,output_dir,mode='material',format='GLB'):
    if mode not in ('material','palette') or format not in ('GLB','FBX'): raise ValueError('Unsupported export')
    validation=api.validate_asset(asset_id)
    if not validation['valid']: raise ValueError(str(validation['errors']))
    directory=Path(output_dir).resolve(); directory.mkdir(parents=True,exist_ok=True)
    stem=asset_id+'.'+mode; path=directory/(stem+'.'+format.lower())
    temp=directory/(stem+'.tmp.'+format.lower())
    selected=list(bpy.context.selected_objects); active=bpy.context.view_layer.objects.active
    collection=bpy.data.collections.new('VW.export.temporary'); bpy.context.scene.collection.children.link(collection)
    copies=[]; new_mats=[]; image=None
    try:
        for obj in list(bpy.context.selected_objects): obj.select_set(False)
        for src in api.objects(api.root(asset_id)):
            obj=src.copy(); obj.data=src.data.copy(); collection.objects.link(obj); copies.append(obj)
            obj.select_set(True)
        bpy.context.view_layer.update()
        if mode=='palette': image,new_mats=palette_materials(copies,directory,stem)
        if format=='GLB':
            bpy.ops.export_scene.gltf(filepath=str(temp),export_format='GLB',use_selection=True,export_yup=True)
            if mode=='palette': nearest_glb(temp)
        else:
            bpy.ops.export_scene.fbx(filepath=str(temp),use_selection=True,axis_forward='-Z',axis_up='Y',path_mode='COPY',embed_textures=True)
        os.replace(temp,path)
        return {'path':str(path),'bytes':path.stat().st_size,'mode':mode,**validation,
                'materials':len({m for o in copies for m in o.data.materials}),
                'texture':str(directory/(stem+'.png')) if image else None,
                'internal_faces':'retained; no shell extraction claimed'}
    finally:
        for obj in copies:
            mesh=obj.data; bpy.data.objects.remove(obj,do_unlink=True)
            if mesh.users==0: bpy.data.meshes.remove(mesh)
        bpy.data.collections.remove(collection)
        for mat in new_mats:
            if mat.users==0: bpy.data.materials.remove(mat)
        if image and image.users==0: bpy.data.images.remove(image)
        for obj in selected:
            if obj.name in bpy.context.view_layer.objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=active
        if temp.exists(): temp.unlink()
