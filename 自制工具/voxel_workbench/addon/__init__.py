bl_info = {'name':'星骸 · 体块工作台','author':'XingHaiHuiLang','version':(0,1,0),
           'blender':(5,1,0),'location':'3D View > Sidebar > 体块工作台','category':'Object'}

def register():
    from . import interaction
    interaction.register()

def unregister():
    from . import interaction
    interaction.unregister()
