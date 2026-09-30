"""Viewport input adapters. A stroke changes data only once, on release."""
import math
import uuid
import bpy
from bpy.props import StringProperty,FloatProperty,IntProperty,EnumProperty,FloatVectorProperty,PointerProperty
from bpy_extras import view3d_utils
from mathutils import Vector
from . import api,presets,exporting
from .model import Profile,snap,stroke_cells,spaced_cells

DEFAULT_LIBRARY=r'E:\WORLDCREATOR\XingHaiHuiLang\Origin\tool_data\voxel_workbench'
ACTIVE=set()


def colors(self,context):
    return [(key,key,'') for key in Profile().palette]


class VWSettings(bpy.types.PropertyGroup):
    asset_id:StringProperty(name='资产 ID',default='draft.asset')
    grid_step:FloatProperty(name='吸附步长（米）',default=.25,min=.001)
    template:EnumProperty(name='基板',items=[('base.cube','方体',''),('base.panel','薄板',''),('base.plane','零厚面片','')])
    size:FloatVectorProperty(name='尺寸（米）',size=3,default=(1,1,1),min=.25)
    color:EnumProperty(name='色板',items=colors)
    plane:EnumProperty(name='工作平面',items=[('XY','XY 地面',''),('XZ','XZ 墙面',''),('YZ','YZ 墙面',''),('FACE','轴向表面','')])
    layer:FloatProperty(name='平面高度/深度',default=0,step=25)
    brush:EnumProperty(name='工具',items=[('DRAW','连续铺放',''),('POINT','单点',''),('LINE','线段',''),('RECT','矩形',''),('ERASE','橡皮擦','')])
    rotation:IntProperty(name='旋转（90°倍数）',default=0,min=0,max=3)
    library:StringProperty(name='预设库',subtype='DIR_PATH',default=DEFAULT_LIBRARY)
    preset_id:StringProperty(name='预设 ID',default='ruin.wall')
    preset_version:IntProperty(name='预设版本',default=1,min=1)
    export_dir:StringProperty(name='输出目录',subtype='DIR_PATH',default=DEFAULT_LIBRARY+'\\exports')
    export_mode:EnumProperty(name='颜色输出',items=[('material','标准材质',''),('palette','自动色板贴图','')])
    export_format:EnumProperty(name='格式',items=[('GLB','GLB',''),('FBX','FBX','')])


def recipe(settings,operations):
    profile=api.get_profile(settings.asset_id)
    return dict(schema_version='0.1',request_id=uuid.uuid4().hex,asset_id=settings.asset_id,
        expected_revision=api.inspect_asset(settings.asset_id)['revision'],profile_id=profile['id'],
        profile_revision=profile['revision'],operations=operations)


def place_op(settings,cell):
    step=api.get_profile(settings.asset_id)['grid_step']
    size=[max(1,snap(v,step)) for v in settings.size]
    if settings.template=='base.panel': size[2]=1
    if settings.template=='base.plane': size[2]=0
    return dict(op='place',id='b'+uuid.uuid4().hex[:16],template_id=settings.template,
                origin_cells=list(cell),size_cells=size,color_id=settings.color,rotation=[0,0,settings.rotation*90])


class VWPlace(bpy.types.Operator):
    bl_idname='vw.place_cursor'; bl_label='在游标放置'; bl_options={'REGISTER','UNDO'}
    def execute(self,context):
        s=context.scene.vw_settings; step=api.get_profile(s.asset_id)['grid_step']
        try: api.apply_recipe(recipe(s,[place_op(s,[snap(v,step) for v in context.scene.cursor.location])]))
        except ValueError as error: self.report({'ERROR'},str(error)); return {'CANCELLED'}
        return {'FINISHED'}


class VWPaint(bpy.types.Operator):
    bl_idname='vw.paint'; bl_label='给选中块 / 面上色'; bl_options={'REGISTER','UNDO'}
    def execute(self,context):
        s=context.scene.vw_settings; operations=[]
        edit=context.mode=='EDIT_MESH'
        if edit:
            import bmesh
            obj=context.edit_object
            faces=[f.index for f in bmesh.from_edit_mesh(obj.data).faces if f.select]
            if api.get_object(s.asset_id,obj.get('vw_id','')) is obj:
                operations=[dict(op='paint',id=obj['vw_id'],color_id=s.color,faces=faces)]
            bpy.ops.object.mode_set(mode='OBJECT')
        else:
            for obj in context.selected_objects:
                if api.get_object(s.asset_id,obj.get('vw_id','')) is obj:
                    operations.append(dict(op='paint',id=obj['vw_id'],color_id=s.color))
        if not operations: self.report({'WARNING'},'请选当前资产中的块或面'); return {'CANCELLED'}
        try: api.apply_recipe(recipe(s,operations))
        except ValueError as error: self.report({'ERROR'},str(error)); return {'CANCELLED'}
        return {'FINISHED'}


class VWPresetSave(bpy.types.Operator):
    bl_idname='vw.preset_save'; bl_label='选中块保存为新版本'
    def execute(self,context):
        s=context.scene.vw_settings
        ids=[o['vw_id'] for o in context.selected_objects if 'vw_id' in o and api.get_object(s.asset_id,o['vw_id']) is o]
        try:
            result=presets.save_preset(s.asset_id,ids,s.preset_id,s.preset_id,s.library,anchor=context.scene.cursor.location)
            s.preset_version=result['version']; self.report({'INFO'},f"已保存版本 {result['version']}；磁盘保存不随撤销删除")
        except (ValueError,OSError) as error: self.report({'ERROR'},str(error)); return {'CANCELLED'}
        return {'FINISHED'}


class VWPresetPlace(bpy.types.Operator):
    bl_idname='vw.preset_place'; bl_label='在游标放置预设'; bl_options={'REGISTER','UNDO'}
    def execute(self,context):
        s=context.scene.vw_settings
        try: presets.place_preset(s.asset_id,'p'+uuid.uuid4().hex[:12],s.library,s.preset_id,s.preset_version,list(context.scene.cursor.location),s.rotation*math.pi/2)
        except (ValueError,OSError) as error: self.report({'ERROR'},str(error)); return {'CANCELLED'}
        return {'FINISHED'}


class VWExport(bpy.types.Operator):
    bl_idname='vw.export'; bl_label='导出当前资产'
    def execute(self,context):
        s=context.scene.vw_settings
        try:
            result=exporting.export_asset(s.asset_id,s.export_dir,s.export_mode,s.export_format)
            self.report({'INFO'},result['path'])
        except Exception as error: self.report({'ERROR'},str(error)); return {'CANCELLED'}
        return {'FINISHED'}


class VWBrush(bpy.types.Operator):
    bl_idname='vw.brush'; bl_label='开始笔刷'; bl_options={'REGISTER','UNDO','BLOCKING'}
    def cleanup(self,context=None):
        if getattr(self,'handle',None):
            bpy.types.SpaceView3D.draw_handler_remove(self.handle,'WINDOW'); self.handle=None
        ACTIVE.discard(self)
        if context and context.area: context.area.header_text_set(None); context.area.tag_redraw()

    def draw_preview(self):
        if not self.cells: return
        import gpu
        from gpu_extras.batch import batch_for_shader
        shader=gpu.shader.from_builtin('UNIFORM_COLOR')
        points=[tuple(v*self.step for v in c) for c in self.cells]
        gpu.state.point_size_set(8)
        shader.bind(); shader.uniform_float('color',(1,.68,.22,1))
        batch_for_shader(shader,'POINTS',{'pos':points}).draw(shader)
        gpu.state.point_size_set(1)

    def invoke(self,context,event):
        if context.area.type!='VIEW_3D': return {'CANCELLED'}
        self.cells=[]; self.drawing=False; self.last=None; self.start=None; self.deletes=set()
        self.view_region=next(r for r in context.area.regions if r.type=='WINDOW')
        self.view_data=context.area.spaces.active.region_3d
        self.step=api.get_profile(context.scene.vw_settings.asset_id)['grid_step']
        self.handle=bpy.types.SpaceView3D.draw_handler_add(self.draw_preview,(),'WINDOW','POST_VIEW')
        ACTIVE.add(self); context.window_manager.modal_handler_add(self)
        context.area.header_text_set('体块笔刷：左键按住绘制、松开提交整笔；Esc / 右键取消；中键可旋转')
        return {'RUNNING_MODAL'}

    def ray(self,context,event):
        xy=(event.mouse_x-self.view_region.x,event.mouse_y-self.view_region.y)
        return (view3d_utils.region_2d_to_origin_3d(self.view_region,self.view_data,xy),
                view3d_utils.region_2d_to_vector_3d(self.view_region,self.view_data,xy))

    def point(self,context,event):
        origin,direction=self.ray(context,event); denominator=direction[self.axis]
        if abs(denominator)<1e-6: return None
        t=(self.depth-origin[self.axis])/denominator
        if t<0: return None
        return tuple(snap(v,self.step) for v in origin+direction*t)

    def modal(self,context,event):
        try:
            if event.type in {'ESC','RIGHTMOUSE','WINDOW_DEACTIVATE'}:
                self.cleanup(context); return {'CANCELLED'}
            if event.type in {'MIDDLEMOUSE','WHEELUPMOUSE','WHEELDOWNMOUSE'}: return {'PASS_THROUGH'}
            s=context.scene.vw_settings
            if event.type=='LEFTMOUSE' and event.value=='PRESS':
                self.axis={'XY':2,'XZ':1,'YZ':0,'FACE':2}[s.plane]; self.depth=s.layer
                if s.plane=='FACE':
                    origin,direction=self.ray(context,event)
                    hit,location,normal,_,_,_=context.scene.ray_cast(context.evaluated_depsgraph_get(),origin,direction)
                    if not hit: return {'RUNNING_MODAL'}
                    self.axis=max(range(3),key=lambda i:abs(normal[i]))
                    if abs(normal[self.axis])<.999: self.report({'WARNING'},'请选择轴对齐平面'); return {'RUNNING_MODAL'}
                    self.depth=location[self.axis]
                self.drawing=True; self.start=self.point(context,event); self.last=self.start
            if self.drawing and event.type in {'MOUSEMOVE','LEFTMOUSE'}:
                cell=self.point(context,event)
                if cell is not None:
                    if s.brush=='ERASE':
                        origin,direction=self.ray(context,event)
                        hit,_,_,_,obj,_=context.scene.ray_cast(context.evaluated_depsgraph_get(),origin,direction)
                        if hit and obj and api.get_object(s.asset_id,obj.get('vw_id','')) is obj:
                            group=obj.get('vw_group')
                            self.deletes.update(o['vw_id'] for o in api.objects(api.root(s.asset_id)) if o is obj or (group and o.get('vw_group')==group))
                    elif s.brush=='POINT': self.cells=[self.start]
                    elif s.brush=='LINE': self.cells=stroke_cells(self.start,cell)
                    elif s.brush=='RECT':
                        axes=[i for i in range(3) if i!=self.axis]
                        a,b=axes
                        if (abs(cell[a]-self.start[a])+1)*(abs(cell[b]-self.start[b])+1)>20000: raise ValueError('矩形超过20000格限制')
                        self.cells=[]
                        for x in range(min(cell[a],self.start[a]),max(cell[a],self.start[a])+1):
                            for y in range(min(cell[b],self.start[b]),max(cell[b],self.start[b])+1):
                                p=list(cell); p[a]=x; p[b]=y; self.cells.append(tuple(p))
                    else: self.cells=list(dict.fromkeys(self.cells+stroke_cells(self.last or cell,cell)))
                    self.last=cell
                context.area.tag_redraw()
            if event.type=='LEFTMOUSE' and event.value=='RELEASE' and self.drawing:
                footprint=place_op(s,(0,0,0))['size_cells']
                if s.rotation%2: footprint[0],footprint[1]=footprint[1],footprint[0]
                cells=spaced_cells(self.cells,footprint,self.start) if self.start else []
                ops=[dict(op='delete',id=i) for i in self.deletes] if s.brush=='ERASE' else [place_op(s,c) for c in cells]
                if ops: api.apply_recipe(recipe(s,ops))
                self.cleanup(context); return {'FINISHED'}
            return {'RUNNING_MODAL'}
        except Exception as error:
            self.report({'ERROR'},str(error)); self.cleanup(context); return {'CANCELLED'}


class VWPanel(bpy.types.Panel):
    bl_label='星骸 · 体块工作台'; bl_idname='VW_PT_panel'
    bl_space_type='VIEW_3D'; bl_region_type='UI'; bl_category='体块工作台'
    def draw(self,context):
        layout=self.layout; s=context.scene.vw_settings
        layout.prop(s,'asset_id'); layout.label(text='米制 · 0.25米格 · Z向上')
        box=layout.box(); box.label(text='搭建与配色')
        for prop in ('template','size','color','rotation'): box.prop(s,prop)
        box.operator('vw.place_cursor'); box.operator('vw.paint')
        box=layout.box(); box.label(text='笔刷：每笔松手提交 / Esc取消')
        for prop in ('plane','layer','brush'): box.prop(s,prop)
        box.operator('vw.brush',icon='BRUSH_DATA')
        box=layout.box(); box.label(text='预设（3D游标作为保存锚点）')
        for prop in ('library','preset_id','preset_version'): box.prop(s,prop)
        box.operator('vw.preset_save'); box.operator('vw.preset_place')
        box=layout.box(); box.label(text='导出副本，保留源模型')
        for prop in ('export_dir','export_mode','export_format'): box.prop(s,prop)
        box.operator('vw.export',icon='EXPORT')


CLASSES=(VWSettings,VWPlace,VWPaint,VWPresetSave,VWPresetPlace,VWExport,VWBrush,VWPanel)

def register():
    for cls in CLASSES: bpy.utils.register_class(cls)
    bpy.types.Scene.vw_settings=PointerProperty(type=VWSettings)

def unregister():
    for brush in list(ACTIVE): brush.cleanup()
    if hasattr(bpy.types.Scene,'vw_settings'): del bpy.types.Scene.vw_settings
    for cls in reversed(CLASSES): bpy.utils.unregister_class(cls)
