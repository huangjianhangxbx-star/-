"""Isolated Blender GUI event-injection smoke; not a human usability review."""
import sys,json,traceback
from pathlib import Path
import bpy
from mathutils import Quaternion,Vector
from bpy_extras.view3d_utils import location_3d_to_region_2d
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
import addon
from addon import api
OUT=ROOT/'artifacts'/'gui';OUT.mkdir(parents=True,exist_ok=True)
addon.register()
bpy.context.preferences.view.show_splash=False
for obj in list(bpy.context.scene.objects): bpy.data.objects.remove(obj,do_unlink=True)
phase=0; result={}

def tick():
    global phase
    try:
        window=bpy.context.window
        area=next(a for a in window.screen.areas if a.type=='VIEW_3D')
        region=next(r for r in area.regions if r.type=='WINDOW')
        space=area.spaces.active
        with bpy.context.temp_override(window=window,area=area,region=region):
            if phase==0:
                window.event_simulate(type='ESC',value='PRESS')
                space.show_region_ui=True;space.region_3d.view_rotation=Quaternion((1,0,0,0))
                space.region_3d.view_perspective='ORTHO';space.region_3d.view_distance=12
                space.region_3d.view_location=Vector((2,0,0));bpy.ops.ed.undo_push(message='Before brush')
            elif phase==1:
                sidebar=next(r for r in area.regions if r.type=='UI')
                with bpy.context.temp_override(region=sidebar): bpy.ops.vw.brush('INVOKE_DEFAULT')
            elif phase in (2,3,4):
                p=location_3d_to_region_2d(region,space.region_3d,Vector((0 if phase==2 else 4,0,0)))
                window.event_simulate(type='LEFTMOUSE' if phase!=3 else 'MOUSEMOVE',value='PRESS' if phase==2 else 'RELEASE' if phase==4 else 'NOTHING',x=int(p.x+region.x),y=int(p.y+region.y))
            elif phase==5:
                result['after_stroke']=len(api.inspect_asset('draft.asset')['instances'])
                assert result['after_stroke']==5,result
                bpy.ops.screen.screenshot(filepath=str(OUT/'brush.png'))
                bpy.ops.ed.undo()
            elif phase==6:
                result['after_undo']=len(api.inspect_asset('draft.asset')['instances'])
                assert result['after_undo']==0,result
                bpy.ops.ed.redo()
            elif phase==7:
                result['after_redo']=len(api.inspect_asset('draft.asset')['instances'])
                assert result['after_redo']==5,result
                bpy.ops.vw.brush('INVOKE_DEFAULT')
            elif phase==8:
                p=location_3d_to_region_2d(region,space.region_3d,Vector((0,3,0)))
                window.event_simulate(type='LEFTMOUSE',value='PRESS',x=int(p.x+region.x),y=int(p.y+region.y))
            elif phase==9: window.event_simulate(type='ESC',value='PRESS')
            elif phase==10:
                result['after_cancel']=len(api.inspect_asset('draft.asset')['instances'])
                assert result['after_cancel']==5,result
                bpy.ops.screen.screenshot(filepath=str(OUT/'brush.png'))
                result['status']='PASS';(OUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
                bpy.ops.wm.quit_blender();return None
        phase+=1;return 1.0
    except Exception:
        result['error']=traceback.format_exc();(OUT/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        bpy.ops.wm.quit_blender();return None

bpy.app.timers.register(tick,first_interval=3)
