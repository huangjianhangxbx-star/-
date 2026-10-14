"""Freeze 47 original replacement slots. Private source identity maps stay local."""
import argparse,json,hashlib,zipfile
from pathlib import Path
from PIL import Image,ImageDraw
from model import legal_masks,sha,safe_path,check_rect

def contract_for(family):
 entries=sorted([e for e in family['entries'] if e['mask'] is not None],key=lambda e:e['originalIndex'])
 if len(entries)!=47 or {e['mask'] for e in entries}!=set(legal_masks()) or [e['originalIndex'] for e in entries]!=list(range(1,48)):raise ValueError('Expected exactly the registered original indices 1..47')
 slots=[]
 for e in entries:
  if not(0<e['width']<=384 and 0<e['height']<=512 and e['ppu']>0):raise ValueError('Native dimensions do not fit fixed v1 cells')
  i=e['originalIndex']-1;slots.append({'slot':i+1,'originalIndex':e['originalIndex'],'mask':e['mask'],'cell':[i%8*384,i//8*512,384,512],'rect':[i%8*384,i//8*512,e['width'],e['height']],'ppu':e['ppu'],'pivot':e['pivot'],'source':e})
 c={'schema':'fixed-original-wall47/1','familyId':family['id'],'familyLabel':family['label'],'canvasSize':[3072,3072],'columns':8,'rows':6,'cellSize':[384,512],'unusedOriginalIndex':0,'slots':slots}
 c['contractSha256']=hashlib.sha256(json.dumps(c,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest();return c

def cut_fixed(png,contract):
 with Image.open(png) as source:
  if source.format!='PNG' or list(source.size)!=contract['canvasSize']:raise ValueError('PNG must match fixed template dimensions')
  im=source.convert('RGBA')
 return {s['originalIndex']:im.crop(check_rect(s['rect'],im.size)) for s in contract['slots']}

def build(data,library,dest,gallery):
 data=json.loads(Path(data).read_text(encoding='utf8'));family=data['families'][0];c=contract_for(family);dest=Path(dest);dest.mkdir(parents=True,exist_ok=True);p=dest/'contract-v1.json'
 if p.exists() and p.read_text(encoding='utf8')!=json.dumps(c,ensure_ascii=False,indent=2)+'\n':raise ValueError('Frozen v1 contract changed: do not overwrite; create a separately approved version')
 p.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 reference=Image.new('RGBA',c['canvasSize']);lines=Image.new('RGBA',reference.size);d=ImageDraw.Draw(lines)
 for s in c['slots']:
  source=safe_path(library,s['source']['sourcePng'])
  if sha(source)!=s['source']['sourceSha256']:raise ValueError('Original reference changed')
  with Image.open(source) as im:reference.paste(im.convert('RGBA'),tuple(s['rect'][:2]))
  x,y,w,h=s['rect'];d.rectangle((x,y,x+w-1,y+h-1),outline='#ffb65e',width=3);d.text((x+6,y+6),'S%02d / I%02d / M%d'%(s['slot'],s['originalIndex'],s['mask']),fill='#ffffff');cx,cy,cw,ch=s['cell'];d.rectangle((cx,cy,cx+cw-1,cy+ch-1),outline='#70c4c3',width=1)
 reference.save(dest/'original-reference-v1.png');lines.save(dest/'guides-v1.png');Image.new('RGBA',reference.size).save(dest/'blank-v1.png')
 guide='''# 固定47槽位规范 v1

本模板只绑定当前原墙族。画布3072×3072，8列6行，每槽384×512；第48槽无输出。固定第1..47槽分别替换原索引1..47，原索引0不在47态中。

每槽橙框为真实输出矩形，原图左上对齐，剩余部分为不输出的余量。不得拉伸、旋转、移动或调换槽位。多数输出341×512，两种方片按其384×384实际矩形输出；PPU/Pivot逐片继承源规范，不统一成100。

原作参照板与透明绘画底板完全同位置。以参照板/刀线为独立参考层，在底板绘制47片；隐藏参照与刀线后保存同尺寸PNG。点击格子看连接邻域要求。每格只对应同编号原片；不同格必须按实际共边协调，不由程序生成组合形状。

黑色、Alpha与前面板范围见实际原片，不能擅自认为黑色等于透明。全邻域状态可能无可见墙沿，不能因为看起来空就删除。保存后程序按冻结的rect直接裁47图，不拆部件、不重新组合。导出带原索引/状态/PPU/Pivot与源身份映射，便于后续接入；不会自动改Unity或原游戏。

本v1坐标/绑定由contractSha256冻结；同模板只适用于相同墙族规格。其他族不能强行套用相同PPU/尺寸，变更另立版本。含原素材/完整映射，只供本机研究，不上传GitHub。
'''
 (dest/'固定规矩-v1.md').write_text(guide,encoding='utf8')
 with zipfile.ZipFile(dest/'fixed47-v1-local.zip','w',zipfile.ZIP_DEFLATED) as z:
  for name in ['original-reference-v1.png','blank-v1.png','guides-v1.png','contract-v1.json','固定规矩-v1.md']:z.write(dest/name,name)
 c['root']='../masters/fixed47-v1';Path(gallery,'fixed47-data.js').write_text('window.FIXED47='+json.dumps(c,ensure_ascii=False)+';',encoding='utf8');return c

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--library',required=True);p.add_argument('--dest',required=True);p.add_argument('--gallery',required=True);a=p.parse_args();c=build(a.data,a.library,a.dest,a.gallery);print(json.dumps({'slots':47,'canvas':c['canvasSize'],'contractSha256':c['contractSha256']}))
