import bpy,sys
source,glb,fbx=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=source,load_ui=False)
obj=max((o for o in bpy.context.scene.objects if o.type=='MESH'),key=lambda o:o.location.z)
obj.location.y+=.2
for mat in bpy.data.materials:
 mat.use_nodes=True
 mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color
 mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=1
bpy.ops.wm.save_as_mainfile(filepath=source)
bpy.ops.export_scene.gltf(filepath=glb,export_format='GLB')
bpy.ops.export_scene.fbx(filepath=fbx,axis_forward='-Z',axis_up='Y',add_leaf_bones=False)
