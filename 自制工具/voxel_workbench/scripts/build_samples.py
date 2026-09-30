import sys,json
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from addon import api,presets
LIBRARY=ROOT.parents[1]/'tool_data'/'voxel_workbench'

def block(i,p,s,c='stone.base',template='base.cube'):
    return dict(op='place',id=i,origin_cells=p,size_cells=s,color_id=c,template_id=template)

samples={
 'stairs':[block('step'+str(i),[0,i*2,0],[8,2,(i+1)*1]) for i in range(6)],
 'pillar':[block('base',[0,0,0],[6,6,1],'stone.dark'),block('shaft',[0,0,1],[4,4,10]),block('capital',[0,0,11],[6,6,2],'stone.light')],
 'arch':[block('left',[-6,0,0],[4,4,12]),block('right',[6,0,0],[4,4,12]),block('lintel',[0,0,12],[16,4,3],'stone.light')],
 'tree':[block('trunk',[0,0,0],[2,2,12],'wood'),block('crown',[0,0,12],[10,8,4],'leaf.green'),block('top',[0,0,16],[6,6,3],'leaf.dry')],
 'plane':[block('plane',[0,0,0],[8,8,0],'leaf.dry','base.plane')],
}
for name,operations in samples.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    request=dict(schema_version='0.1',request_id=name+'-001',asset_id='example.'+name,expected_revision=0,
     profile_id='project.demo',profile_revision=1,operations=operations)
    (ROOT/'recipes'/f'{name}.json').write_text(json.dumps(request,indent=2),encoding='utf-8')
    api.apply_recipe(request); out=ROOT/'artifacts'/name;out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{name}.blend'))
    api.export_asset(request['asset_id'],out,'palette','GLB')
    api.render_preview(request['asset_id'],out/'preview.png',resolution=600)
    preset=presets.save_preset(request['asset_id'],[op['id'] for op in operations],'sample.'+name,name,LIBRARY)
    import shutil
    shutil.copyfile(out/'preview.png',Path(preset['path']).with_suffix('.png'))
print('SAMPLES GENERATED; static sample library:',LIBRARY)
