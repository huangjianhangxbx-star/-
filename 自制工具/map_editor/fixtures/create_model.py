import bpy, os
out=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for pos,scale,color in [((0,0,.35),(.15,.15,.35),(.12,.4,.5,1)),((.2,0,.7),(.35,.1,.1),(.9,.5,.15,1))]:
    bpy.ops.mesh.primitive_cube_add(size=2,location=pos)
    obj=bpy.context.object;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mat=bpy.data.materials.new('DirectionColor');mat.diffuse_color=color;obj.data.materials.append(mat)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'direction.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'direction.glb'),export_format='GLB')
bpy.ops.export_scene.fbx(filepath=os.path.join(out,'direction.fbx'),axis_forward='-Z',axis_up='Y',add_leaf_bones=False)
