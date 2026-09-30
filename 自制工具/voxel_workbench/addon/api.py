"""Persistent Blender data service; callers provide explicit asset IDs."""
import hashlib
import json
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector, Euler
from .model import Profile, identifier, expand_recipe, anchor_offset, srgb_to_linear, MAX_INSTANCES, boxes_overlap


def digest(data):
    return hashlib.sha256(json.dumps(data,sort_keys=True,allow_nan=False).encode()).hexdigest()


def root(asset_id):
    identifier(asset_id)
    return next((c for c in bpy.data.collections if c.get('vw_asset')==asset_id),None)


def objects(collection):
    return [o for o in collection.objects if o.type=='MESH' and 'vw_id' in o]


def get_object(asset_id, instance_id):
    collection=root(asset_id)
    return next((o for o in objects(collection) if o['vw_id']==instance_id),None) if collection else None


def get_profile(asset_id=None):
    collection=root(asset_id) if asset_id else None
    return json.loads(collection['vw_profile']) if collection else json.loads(bpy.context.scene.get('vw_default_profile',json.dumps(Profile().to_dict())))


def set_default_profile(data):
    profile=Profile(**data)
    bpy.context.scene['vw_default_profile']=json.dumps(profile.to_dict(),allow_nan=False)
    return profile.to_dict()


def save_template(template_id,size_cells,kind='box',anchor='bottom'):
    from .model import vector
    identifier(template_id); vector(size_cells,True)
    if kind not in ('box','plane') or min(size_cells[:2])<=0 or (kind=='box' and size_cells[2]<=0) or (kind=='plane' and size_cells[2]!=0): raise ValueError('Invalid template')
    anchor_offset(size_cells,anchor)
    profile=get_profile();profile['templates'][template_id]={'kind':kind,'size_cells':list(size_cells),'anchor':anchor}
    profile['revision']+=1
    return set_default_profile(profile)


def update_palette(asset_id,color_id,rgba,scope='asset'):
    if scope not in ('asset','project'): raise ValueError('Explicit asset/project scope required')
    target=root(asset_id)
    if target is None: raise ValueError('Asset not found')
    collections=[target] if scope=='asset' else [c for c in bpy.data.collections if c.get('vw_asset') and get_profile(c['vw_asset'])['id']==get_profile(asset_id)['id']]
    plans=[]
    for collection in collections:
        profile=Profile(**get_profile(collection['vw_asset']))
        if color_id not in profile.palette: continue
        profile.palette[color_id]['color']=list(rgba);profile.revision+=1;Profile(**profile.to_dict())
        plans.append((collection,profile))
    for collection,profile in plans:
        sync(collection)
        replacement=material(color_id,profile,collection['vw_asset'])
        for obj in objects(collection):
            if any(m and m.get('vw_color')==color_id for m in obj.data.materials):
                obj.data=obj.data.copy();obj.data.pop('vw_geometry',None)
                for i,mat in enumerate(obj.data.materials):
                    if mat and mat.get('vw_color')==color_id: obj.data.materials[i]=replacement
        collection['vw_profile']=json.dumps(profile.to_dict());collection['vw_revision']+=1
        collection['vw_fingerprint']=fingerprint(collection)
    return inspect_asset(asset_id)


def adopt_static(asset_id,obj,instance_id,color_id):
    identifier(instance_id);collection=root(asset_id)
    if collection is None or get_object(asset_id,instance_id): raise ValueError('Missing asset or duplicate ID')
    if obj.type!='MESH' or obj.modifiers or obj.animation_data or obj.constraints: raise ValueError('Only plain static meshes supported')
    if 'vw_id' in obj: raise ValueError('Object already managed')
    profile=Profile(**get_profile(asset_id))
    if color_id not in profile.palette: raise ValueError('Unknown color')
    sync(collection)
    obj.data=obj.data.copy();obj.data.materials.clear();obj.data.materials.append(material(color_id,profile,asset_id))
    for face in obj.data.polygons: face.material_index=0
    for old in list(obj.users_collection): old.objects.unlink(obj)
    collection.objects.link(obj);obj['vw_id']=instance_id;obj['vw_static']=True
    collection['vw_revision']+=1;collection['vw_fingerprint']=fingerprint(collection)
    return inspect_asset(asset_id)


def fingerprint(collection):
    bpy.context.view_layer.update()
    return digest([{'id':o['vw_id'],'matrix':[list(row) for row in o.matrix_local],
        'vertices':[list(v.co) for v in o.data.vertices],
        'polygons':[(list(p.vertices),p.material_index) for p in o.data.polygons],
        'materials':[(m.get('vw_color'),list(m.diffuse_color)) if m else None for m in o.data.materials]}
        for o in sorted(objects(collection),key=lambda o:o['vw_id'])])


def sync(collection):
    current=fingerprint(collection)
    if collection.get('vw_fingerprint')!=current:
        collection['vw_revision']=int(collection.get('vw_revision',0))+1
        collection['vw_fingerprint']=current
        collection['vw_native_modified']=True


def inspect_asset(asset_id):
    collection=root(asset_id)
    if collection is None: return {'asset_id':asset_id,'revision':0,'instances':[]}
    sync(collection)
    return {'asset_id':asset_id,'revision':collection['vw_revision'],
        'fingerprint':collection['vw_fingerprint'],
        'warnings':['Native changes detected; current mesh is authoritative'] if collection.get('vw_native_modified') else [],
        'instances':[{'id':o['vw_id'],'position':list(o.location),'dimensions':list(o.dimensions),
                      'colors':[m.get('vw_color','unmanaged') for m in o.data.materials if m],
                      'preset':o.get('vw_preset','')} for o in objects(collection)]}


def material(color_id,profile,scope):
    spec=profile.palette[color_id]; key=digest([profile.id,profile.revision,scope,color_id,spec])
    existing=next((m for m in bpy.data.materials if m.get('vw_key')==key),None)
    if existing: return existing
    mat=bpy.data.materials.new(f'VW.{scope}.{color_id}'); mat.use_nodes=True
    rgba=[srgb_to_linear(v) for v in spec['color'][:3]]+[spec['color'][3]]
    mat.diffuse_color=rgba; mat['vw_key']=key; mat['vw_color']=color_id
    bsdf=mat.node_tree.nodes.get('Principled BSDF'); bsdf.inputs['Base Color'].default_value=rgba
    bsdf.inputs['Roughness'].default_value=spec.get('roughness',.8)
    bsdf.inputs['Metallic'].default_value=spec.get('metallic',0)
    bsdf.inputs['Emission Color'].default_value=rgba
    bsdf.inputs['Emission Strength'].default_value=spec.get('emission',0)
    mat.use_backface_culling=not spec.get('double_sided',True)
    return mat


def make_object(op,profile,asset_id):
    size=op['size']; offset=anchor_offset(size,op['anchor'],op['custom_anchor'])
    if op['kind']=='plane':
        verts=[(-.5,-.5,0),(.5,-.5,0),(.5,.5,0),(-.5,.5,0)]; faces=[(0,1,2,3)]
    else:
        verts=[(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
        faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    signs=[-1 if m else 1 for m in op['mirror']]
    verts=[tuple((v[i]*size[i]+offset[i])*signs[i] for i in range(3)) for v in verts]
    if math.prod(signs)<0: faces=[tuple(reversed(f)) for f in faces]
    mat=material(op['color_id'],profile,asset_id)
    key=digest([verts,faces,mat.name])
    mesh=next((m for m in bpy.data.meshes if m.get('vw_geometry')==key),None)
    if mesh is None:
        mesh=bpy.data.meshes.new('VW.block'); mesh.from_pydata(verts,[],faces); mesh.update()
        mesh.materials.append(mat); mesh['vw_geometry']=key
    obj=bpy.data.objects.new('VW.'+op['id'],mesh)
    obj.location=op['position']; obj.rotation_euler=[math.radians(v) for v in op['rotation']]
    obj['vw_id']=op['id']; obj['vw_parametric']=json.dumps(op)
    return obj


def purge_orphans(before):
    for name in ('meshes','materials'):
        container=getattr(bpy.data,name)
        for value in list(container):
            if value.name not in before[name] and value.users==0: container.remove(value)


def object_bounds(obj):
    matrix=Matrix.LocRotScale(obj.location,obj.rotation_euler.to_quaternion(),obj.scale)
    points=[matrix@v.co for v in obj.data.vertices]
    return (tuple(min(v[i] for v in points) for i in range(3)),tuple(max(v[i] for v in points) for i in range(3)))


def check_collisions(items):
    active=[]
    for low,high,iid in sorted(((*object_bounds(o),o['vw_id']) for o in items),key=lambda t:t[0][0]):
        active=[entry for entry in active if entry[1][0]>low[0]+1e-5]
        for a,b,other in active:
            if boxes_overlap((low,high),(a,b)): raise ValueError(f'Occupied volume: {iid} overlaps {other}')
        active.append((low,high,iid))


def validate_recipe(recipe):
    collection=root(recipe.get('asset_id','invalid'))
    profile=Profile(**get_profile(recipe.get('asset_id','invalid')))
    expanded=expand_recipe(recipe,profile)
    state=inspect_asset(recipe['asset_id'])
    history=json.loads(collection.get('vw_requests','{}')) if collection else {}
    prior=history.get(recipe['request_id'])
    if prior:
        if prior['hash']!=digest(recipe): raise ValueError('Request ID reused with different content')
        return {'replay':True,'revision':state['revision'],'operations':expanded}
    if state['revision']!=recipe['expected_revision']: raise ValueError(f"Revision conflict: current {state['revision']}")
    ids={i['id'] for i in state['instances']}
    for op in expanded:
        if op['op']=='place':
            if op['id'] in ids: raise ValueError('Duplicate instance ID: '+op['id'])
            ids.add(op['id'])
        else:
            if op['id'] not in ids: raise ValueError('Unknown instance ID: '+op['id'])
            if op['op']=='delete': ids.remove(op['id'])
    if len(ids)>MAX_INSTANCES: raise ValueError('Asset instance limit exceeded')
    return {'replay':False,'revision':state['revision'],'operations':expanded}


def apply_recipe(recipe):
    check=validate_recipe(recipe)
    if check['replay']: return {'asset_id':recipe['asset_id'],'revision':check['revision'],'replayed':True}
    aid=recipe['asset_id']; collection=root(aid); profile=Profile(**get_profile(aid))
    before={name:set(getattr(bpy.data,name).keys()) for name in ('meshes','materials')}
    staged={o['vw_id']:o.copy() for o in objects(collection)} if collection else {}
    try:
        for op in check['operations']:
            iid=op['id']; kind=op['op']
            if kind=='place': staged[iid]=make_object(op,profile,aid)
            elif kind=='delete': bpy.data.objects.remove(staged.pop(iid),do_unlink=True)
            elif kind=='paint':
                obj=staged[iid]; obj.data=obj.data.copy()
                obj.data.pop('vw_geometry',None)
                faces=op.get('faces',list(range(len(obj.data.polygons))))
                if any(f>=len(obj.data.polygons) for f in faces): raise ValueError('Face index out of range')
                mat=material(op['color_id'],profile,aid)
                if mat.name not in obj.data.materials: obj.data.materials.append(mat)
                slot=obj.data.materials.find(mat.name)
                for f in faces: obj.data.polygons[f].material_index=slot
            elif kind=='transform':
                obj=staged[iid]
                if 'position_cells' in op: obj.location=[v*profile.grid_step+profile.grid_origin[i] for i,v in enumerate(op['position_cells'])]
                if 'rotation' in op: obj.rotation_euler=[math.radians(v) for v in op['rotation']]
                if 'mirror' in op:
                    obj.data=obj.data.copy(); obj.data.pop('vw_geometry',None)
                    signs=[-1 if x else 1 for x in op['mirror']]
                    obj.data.transform(Matrix.Diagonal((*signs,1)))
                    if math.prod(signs)<0: obj.data.flip_normals()
        check_collisions(staged.values())
        if collection is None:
            collection=bpy.data.collections.new('VW.'+aid); bpy.context.scene.collection.children.link(collection)
            collection['vw_asset']=aid; collection['vw_profile']=json.dumps(profile.to_dict())
        originals={o['vw_id']:o for o in objects(collection)}
        for iid,obj in staged.items():
            if iid in originals:
                target=originals.pop(iid); old=target.data
                target.data=obj.data; target.location=obj.location; target.rotation_euler=obj.rotation_euler; target.scale=obj.scale
                bpy.data.objects.remove(obj,do_unlink=True)
                if old.users==0: bpy.data.meshes.remove(old)
            else: collection.objects.link(obj)
        for obj in originals.values(): bpy.data.objects.remove(obj,do_unlink=True)
        collection['vw_revision']=check['revision']+1
        history=json.loads(collection.get('vw_requests','{}'))
        history[recipe['request_id']]={'hash':digest(recipe),'revision':collection['vw_revision']}
        collection['vw_requests']=json.dumps(history)
        collection['vw_fingerprint']=fingerprint(collection)
        purge_orphans(before)
        return {'asset_id':aid,'revision':collection['vw_revision'],'replayed':False}
    except Exception:
        for obj in staged.values():
            if obj.name in bpy.data.objects and not obj.users_collection: bpy.data.objects.remove(obj,do_unlink=True)
        purge_orphans(before)
        raise


def capabilities():
    return {'api_version':'0.1','blender':bpy.app.version_string,'operations':['place','place_array','paint','transform','delete'],
            'max_instances':MAX_INSTANCES,'execution':'in-process Python or isolated CLI',
            'templates':list(Profile().templates)}


def list_presets(library):
    from .presets import list_presets as run
    return run(library)


def save_preset(*args,**kwargs):
    from .presets import save_preset as run
    return run(*args,**kwargs)


def export_asset(*args,**kwargs):
    from .exporting import export_asset as run
    return run(*args,**kwargs)


def render_preview(*args,**kwargs):
    from .preview import render_preview as run
    return run(*args,**kwargs)


def validate_asset(asset_id):
    state=inspect_asset(asset_id); collection=root(asset_id)
    if not collection: raise ValueError('Asset not found')
    errors=[]
    for obj in objects(collection):
        if obj.modifiers or obj.animation_data: errors.append(obj['vw_id']+': modifiers/animation unsupported')
        if not obj.data.polygons: errors.append(obj['vw_id']+': no faces')
    return {'valid':not errors,'errors':errors,'instances':len(state['instances']),
            'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects(collection))}
