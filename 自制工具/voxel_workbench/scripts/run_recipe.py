"""Blender --background --factory-startup --python-exit-code 1 --python this.py -- ..."""
import argparse
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from addon import api,exporting

parser=argparse.ArgumentParser()
parser.add_argument('--recipe',required=True)
parser.add_argument('--output-dir',required=True)
parser.add_argument('--input')
parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
directory=Path(args.output_dir).resolve()
# Entrypoint accepts a caller-approved output directory, never paths from recipes.
directory.mkdir(parents=True,exist_ok=True)
try:
    if args.input:
        bpy.ops.wm.open_mainfile(filepath=str(Path(args.input).resolve()),use_scripts=False)
    request=json.loads(Path(args.recipe).read_text(encoding='utf-8-sig'))
    result=api.apply_recipe(request)
    file=directory/(request['asset_id']+'.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(file),relative_remap=False)
    result['blend']=str(file)
    result['exports']=[exporting.export_asset(request['asset_id'],directory,mode,format)
        for mode,format in [('material','GLB'),('palette','GLB'),('palette','FBX')]]
    if args.render:
        from addon.preview import render_preview
        result['preview']=render_preview(request['asset_id'],directory/'preview.png')
    (directory/'result.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
    print('WORKBENCH_RESULT='+json.dumps(result,ensure_ascii=False))
except Exception as error:
    (directory/'error.json').write_text(json.dumps({'error':type(error).__name__,'message':str(error)},ensure_ascii=False),encoding='utf-8')
    raise
