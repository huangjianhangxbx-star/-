"""Neutral inspection render in a disposable scene."""
from pathlib import Path
import bpy
from mathutils import Vector
from . import api


def render_preview(asset_id,path,resolution=900):
    source=api.root(asset_id)
    if not source or not api.objects(source): raise ValueError('Empty asset')
    output=Path(path).resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    original=bpy.context.window.scene
    scene=bpy.data.scenes.new('VW.preview'); scene.collection.children.link(source)
    created=[]; datablocks=[]
    try:
        bpy.context.window.scene=scene
        bounds=[api.object_bounds(o) for o in api.objects(source)]
        low=Vector([min(b[0][i] for b in bounds) for i in range(3)])
        high=Vector([max(b[1][i] for b in bounds) for i in range(3)])
        center=(low+high)/2; size=max(high-low)*1.8+1
        camera=bpy.data.cameras.new('VW.preview.camera'); datablocks.append((bpy.data.cameras,camera))
        cam=bpy.data.objects.new('VW.preview.camera',camera); scene.collection.objects.link(cam); created.append(cam)
        cam.location=center+Vector((1,-1.5,1.2))*size
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        camera.type='ORTHO'; camera.ortho_scale=size; scene.camera=cam
        for name,offset,power,color in [('key',(-1,-2,3),1600,(1,.87,.7)),('fill',(2,1,2),1000,(.65,.8,1))]:
            light=bpy.data.lights.new('VW.'+name,'AREA'); datablocks.append((bpy.data.lights,light))
            light.energy=power*size*size/30; light.shape='DISK'; light.size=size
            light.color=color
            obj=bpy.data.objects.new('VW.'+name,light); created.append(obj); scene.collection.objects.link(obj)
            obj.location=center+Vector(offset)*size/2
            obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
        world=bpy.data.worlds.new('VW.preview.world'); datablocks.append((bpy.data.worlds,world))
        world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.055,.065,.08,1)
        world.node_tree.nodes['Background'].inputs[1].default_value=.5; scene.world=world
        scene.render.engine='CYCLES'; scene.cycles.samples=24
        scene.render.resolution_x=resolution; scene.render.resolution_y=resolution
        scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'
        scene.render.filepath=str(output); scene.view_settings.view_transform='AgX'
        bpy.ops.render.render(write_still=True)
        return str(output)
    finally:
        bpy.context.window.scene=original
        bpy.data.scenes.remove(scene)
        for obj in created:
            if obj.name in bpy.data.objects: bpy.data.objects.remove(obj,do_unlink=True)
        for container,item in datablocks:
            if item.users==0: container.remove(item)
