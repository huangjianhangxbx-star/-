"""Explicit immutable static-geometry presets, independent of addon installation."""
import json
import os
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from . import api
from .model import identifier, Profile


def atomic_json(path,data):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp')
    try:
        temp.write_text(json.dumps(data,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
        os.replace(temp,path)
    finally:
        if temp.exists(): temp.unlink()


def list_presets(library):
    result=[]
    for path in sorted(Path(library).glob('*/*.json')):
        data=json.loads(path.read_text(encoding='utf-8'))
        result.append({k:data[k] for k in ('id','version','name','tags','profile')})
    return result


def save_preset(asset_id, instance_ids, preset_id, name, library, tags=(), anchor=(0,0,0)):
    identifier(preset_id)
    if not instance_ids: raise ValueError('Explicit non-empty selection required')
    selected=[api.get_object(asset_id,i) for i in instance_ids]
    if any(o is None for o in selected): raise ValueError('Selection outside asset')
    if any(o.modifiers or o.animation_data or o.constraints for o in selected):
        raise ValueError('Apply modifiers and remove animation/constraints before saving static preset')
    bpy.context.view_layer.update()
    chunks=[]
    for obj in selected:
        if any(not m or not m.get('vw_color') for m in obj.data.materials): raise ValueError('Map materials to palette first')
        chunks.append({'vertices':[list(obj.matrix_world@v.co-Vector(anchor)) for v in obj.data.vertices],
                       'faces':[list(p.vertices) for p in obj.data.polygons],
                       'face_colors':[obj.data.materials[p.material_index]['vw_color'] for p in obj.data.polygons]})
    directory=Path(library)/preset_id
    versions=[int(p.stem) for p in directory.glob('*.json') if p.stem.isdigit()]
    version=max(versions,default=0)+1
    data={'id':preset_id,'version':version,'name':name,'tags':list(tags),'profile':api.get_profile(asset_id),
          'anchor':list(anchor),'chunks':chunks,'representation':'static mesh, conservative child bounds'}
    atomic_json(directory/f'{version:04}.json',data)
    return {'id':preset_id,'version':version,'path':str(directory/f'{version:04}.json')}


def place_preset(asset_id, instance_id, library, preset_id, version, position, rotation=0):
    identifier(asset_id); identifier(instance_id); identifier(preset_id)
    if type(version) is not int or version<1: raise ValueError('Invalid version')
    path=Path(library)/preset_id/f'{version:04}.json'
    data=json.loads(path.read_text(encoding='utf-8')); profile=Profile(**data['profile'])
    collection=api.root(asset_id)
    if collection and api.get_profile(asset_id)!=data['profile']: raise ValueError('Preset profile mismatch')
    if collection and any(o['vw_id'].startswith(instance_id+'.') for o in api.objects(collection)): raise ValueError('Instance exists')
    before={key:set(getattr(bpy.data,key).keys()) for key in ('meshes','materials')}
    staged=[]
    try:
        matrix=Matrix.Translation(Vector(position))@Matrix.Rotation(rotation,4,'Z')
        for index,chunk in enumerate(data['chunks']):
            mesh=bpy.data.meshes.new('VW.preset'); mesh.from_pydata(chunk['vertices'],[],chunk['faces']); mesh.update()
            colors=list(dict.fromkeys(chunk['face_colors']))
            for color in colors: mesh.materials.append(api.material(color,profile,asset_id))
            for face,color in zip(mesh.polygons,chunk['face_colors']): face.material_index=colors.index(color)
            obj=bpy.data.objects.new('VW.'+instance_id,mesh); obj.matrix_world=matrix
            obj['vw_id']=f'{instance_id}.{index}'; obj['vw_group']=instance_id
            obj['vw_preset']=f'{preset_id}@{version}'; staged.append(obj)
        if collection is None:
            collection=bpy.data.collections.new('VW.'+asset_id); bpy.context.scene.collection.children.link(collection)
            collection['vw_asset']=asset_id; collection['vw_profile']=json.dumps(profile.to_dict()); collection['vw_revision']=0
        else: api.sync(collection)
        for obj in staged: collection.objects.link(obj)
        collection['vw_revision']+=1; collection['vw_fingerprint']=api.fingerprint(collection)
        return api.inspect_asset(asset_id)
    except Exception:
        for obj in staged:
            if not obj.users_collection: bpy.data.objects.remove(obj,do_unlink=True)
        api.purge_orphans(before); raise
