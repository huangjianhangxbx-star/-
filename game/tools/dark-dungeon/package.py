import json,pathlib,shutil,hashlib
ROOT=pathlib.Path(r'E:\WORLDCREATOR\XingHaiHuiLang\Origin')
OUT=pathlib.Path(__file__).resolve().parents[3]/'work/T-018/map'
OUT.mkdir(parents=True,exist_ok=True)
ASSETS=ROOT/'game/public/assets/dark-dungeon'
ART=ROOT/'art/体素渲染验证/暗牢材质家族-v1/exports/assets'
m=json.loads((OUT/'map.json').read_text(encoding='utf8'))
walk={tuple(p) for p in m['walkable']}
pos=lambda p:{'x':p[0],'y':p[1],'layer':0}
core={'source':'SC_DarkDungeon_Exploration','sourceSha256':m['sceneSha256'],'width':m['width'],'height':m['height'],'origin':m['origin'],'entry':pos(m['entry']),'exit':pos(m['rooms'][19]['nearest']),'campfires':[{'id':'campfire-'+str(i+1),'pos':pos(m['rooms'][r]['nearest']),'room':r} for i,r in enumerate([0,9,14])],'rooms':[{'name':r['name'],'pos':pos(r['nearest'])} for r in m['rooms']],'tiles':[{'x':x,'y':y,'layer':0,'obstacle':(x,y) not in walk} for y in range(m['height']) for x in range(m['width'])],'navigationMethod':m['navigationMethod']}
(OUT/'core-map.json').write_text(json.dumps(core,ensure_ascii=False,separators=(',',':')),encoding='utf8')
ASSETS.mkdir(parents=True,exist_ok=True)
assets=[]
for p in sorted(ART.glob('*.glb')):
 shutil.copy2(p,ASSETS/p.name);assets.append({'id':p.stem,'url':'/assets/dark-dungeon/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
geometry={'version':1,'source':m['scene'],'sourceSha256':m['sceneSha256'],'origin':m['origin'],'width':m['width'],'height':m['height'],'matrixConvention':'column-major GLB local to Unity world (metres), includes reflection X. Subtract origin and game map centre for Three scene. InstancedMesh requires baking reflection into vertices/normals and reversing winding, then remove it from instance matrix.','instances':m['instances']}
(ASSETS/'geometry.json').write_text(json.dumps(geometry,ensure_ascii=False,separators=(',',':')),encoding='utf8')
(ASSETS/'manifest.json').write_text(json.dumps({'version':1,'sourceScene':'SC_DarkDungeon_Exploration','sourceSha256':m['sceneSha256'],'assets':assets,'textures':'All images are embedded in each source GLB; no external texture files.','geometry':'/assets/dark-dungeon/geometry.json','instances':len(m['instances']),'usedAssets':len({i['asset'] for i in m['instances']})},ensure_ascii=False,indent=2),encoding='utf8')
print('core-map.json:',len(core['tiles']),'tiles;',len(walk),'connected walkable; 20 rooms; 3 campfires; entry',core['entry'],'exit',core['exit'])
print('public:',len(assets),'GLBs;',sum(a['bytes'] for a in assets),'bytes; geometry',len(m['instances']),'instances')

shutil.copy2(OUT/'core-map.json',ROOT/'game/src/core/dark-dungeon-map.json')
