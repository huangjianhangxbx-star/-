import json,zipfile
from pathlib import Path
from PIL import Image,ImageDraw
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from templates import caption,font
out=Path(sys.argv[1]);proposal=out/'masters/original-authoring-proposal'
for name in ['A','B','C']:
 folder=proposal/name;guide=Image.new('RGB',(1440,860),'#18222e');d=ImageDraw.Draw(guide);caption(d,(25,18),'候选'+name+'｜画板、图层和刀线',30)
 src=Image.open(folder/('H-reassembled.png' if name=='A' else 'plan-parts.png' if name=='B' else 'controlled-state-sheet.png')).convert('RGBA');scale=min(680/src.width,600/src.height);src=src.resize((round(src.width*scale),round(src.height*scale)),Image.Resampling.NEAREST);guide.paste(src,(35,90),src)
 labels=['1 先画一段H/T的整体墙沿和大色块','2 单独画前面板：把竖缝的落点一次确定','3 补外角/内凹/交汇，检查双墨线','4 辅助层打开核刀线；导出时隐藏','5 按整数窗口切片，再看H/T/孔洞','6 独特裂纹和端头在C表中独立修正']
 for i,label in enumerate(labels):caption(d,(745,110+i*82),label,24)
 caption(d,(30,795),'原创简化笔画教学；共边一致不等于成熟美术。原作作者的PSD未知。',22);guide.save(folder/'paint-guide.png')
 im=Image.open(folder/('continuous-plan.png' if name=='A' else 'plan-parts.png' if name=='B' else 'controlled-state-sheet.png')).convert('RGBA');steps=folder/'steps';steps.mkdir(exist_ok=True)
 body=Image.new('RGBA',im.size);body.paste((65,88,92,255),(0,0,im.width,im.height),im.getchannel('A'));body.save(steps/'01-body.png');im.save(steps/'02-lines.png');guide.save(steps/'03-corrections.png')
 overlay=Image.open(folder/('annotation-plan-parts.png' if name=='B' else 'annotation-cuts.png')).convert('RGBA');annotated=im.copy();annotated.alpha_composite(overlay);annotated.save(steps/'04-cuts.png');Image.open(folder/'H-reassembled.png').save(steps/'05-reassembled.png')
 with zipfile.ZipFile(folder/'original-editable-template.zip','w',zipfile.ZIP_DEFLATED) as z:
  for p in folder.rglob('*'):
   if p.is_file() and p.suffix in ['.png','.json','.md'] and 'tiles' not in p.parts and p!=folder/'original-editable-template.zip':z.write(p,p.relative_to(folder).as_posix())
print('3 editable packages and 5 stage images per proposal')
