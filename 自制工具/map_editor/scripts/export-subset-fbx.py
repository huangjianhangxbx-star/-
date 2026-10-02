"""Export only the verified M1.1 asset copies, leaving art originals untouched."""
import bpy
import json
import pathlib
import sys

args = sys.argv[sys.argv.index("--") + 1:]
root = pathlib.Path(args[0]).resolve()
keys = ["AR_COLUMN_02", "AR_FRAME_01", "EX_ROCK_01", "IT_LIGHT_01", "EX_LANDMARK_01", "PT_EMBLEM_01"]
results = []
for key in keys:
    source = root / f"{key}.blend"
    target = root / f"{key}.fbx"
    if target.exists():
        results.append({"id": key, "status": "existing", "bytes": target.stat().st_size})
        continue
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError(f"{key}: no mesh objects")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.fbx(filepath=str(target), use_selection=True,
        object_types={"MESH"}, axis_forward="-Z", axis_up="Y",
        apply_unit_scale=True, add_leaf_bones=False,
        path_mode="COPY", embed_textures=True)
    results.append({"id": key, "status": "exported", "meshes": len(meshes),
                    "bytes": target.stat().st_size})
print("XINGHAI_FBX_REPORT=" + json.dumps(results, ensure_ascii=False))
