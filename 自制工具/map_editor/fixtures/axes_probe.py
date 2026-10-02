import bpy, os
bpy.ops.wm.read_factory_settings(use_empty=True)
for name,loc in [('Origin',(0,0,0)),('SourceX',(1,0,0)),('SourceY',(0,1,0)),('SourceZ',(0,0,1))]:
 bpy.ops.mesh.primitive_cube_add(size=.1,location=loc)
 bpy.context.object.name=name
bpy.ops.export_scene.fbx(filepath=os.path.join(os.path.dirname(__file__),'axes.fbx'),axis_forward='-Z',axis_up='Y',add_leaf_bones=False)
