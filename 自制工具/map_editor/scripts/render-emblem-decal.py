"""Rasterize the existing PT_EMBLEM_01 planar Blender asset as an honest PNG decal."""
import bpy
import pathlib
import sys
from mathutils import Vector

root = pathlib.Path(sys.argv[sys.argv.index("--") + 1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(root / "PT_EMBLEM_01.blend"), load_ui=False)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.render.film_transparent = True
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.world.color = (1, 1, 1)
camera_data = bpy.data.cameras.new("M11 Decal Orthographic")
camera = bpy.data.objects.new("M11 Decal Orthographic", camera_data)
scene.collection.objects.link(camera)
camera.location = (0, 0, 10)
target = Vector((0, 0, 0))
camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
camera_data.type = "ORTHO"
camera_data.ortho_scale = 3.75
scene.camera = camera
scene.render.filepath = str(root / "PT_EMBLEM_01.png")
bpy.ops.render.render(write_still=True)
print("XINGHAI_DECAL=" + scene.render.filepath)
