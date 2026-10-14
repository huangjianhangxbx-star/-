"""One original painting canvas with explicit cut windows and linked test maps."""
import argparse,json,zipfile
from pathlib import Path
from PIL import Image,ImageDraw
from templates import cut_tiles,save
from model import cases,mask_at

def read_artwork(path,size):
 with Image.open(path) as im:
  if im.format!='PNG' or im.size!=tuple(size):raise ValueError('Expected a PNG at the exact template dimensions')
  return im.convert('RGBA')

def build_single(source,dest):
 source=Path(source);dest=Path(dest);dest.mkdir(parents=True,exist_ok=True)
 mapping=json.loads((source/'cut-map.json').read_text(encoding='utf8'));c=mapping['c']
 with Image.open(source/'continuous-plan.png') as im:plan=im.convert('RGBA')
 with Image.open(source/'continuous-front.png') as im:front=im.convert('RGBA')
 canvas=Image.new('RGBA',(plan.width+front.width,max(plan.height,front.height)))
 canvas.paste(plan,(0,0));canvas.paste(front,(plan.width,0));canvas.save(dest/'single-master.png')
 Image.new('RGBA',canvas.size).save(dest/'blank-single-master.png')
 # Copies in the sketch are context only. Exactly these canonical windows produce tiles.
 for state in mapping['states']:
  for layer in state['layers']:
   if layer['board']=='continuous-front.png':layer['rect'][0]+=plan.width
   layer['board']='single-master.png'
 mapping['source']='original single-canvas production proposal; not original-game author master'
 mapping['editableLayers']=['blank-single-master.png'];mapping['canvasSize']=list(canvas.size)
 save(dest/'cut-map.json',mapping)
 annotation=Image.new('RGBA',canvas.size);draw=ImageDraw.Draw(annotation)
 for state in mapping['states']:
  for layer in state['layers']:
   x,y,w,h=layer['rect'];draw.rectangle((x,y,x+w-1,y+h-1),outline='#e5ab6b',width=2)
 annotation.save(dest/'cut-windows-overlay.png')
 tiles=cut_tiles(dest);(dest/'tiles').mkdir(exist_ok=True)
 for mask,im in tiles.items():im.save(dest/'tiles'/f'mask-{mask:03}.png')
 scenes=[];previews=cases()
 for region in mapping['regions']:
  previews['design-'+region['name']]={tuple(cell) for cell in region['cells']}
 for name,board in previews.items():
  xs=[x for x,y in board];ys=[y for x,y in board];cells=[];output=Image.new('RGBA',((max(xs)-min(xs)+1)*c,(max(ys)-min(ys)+1)*c+c//2))
  for x,y in sorted(board,key=lambda p:(-p[1],p[0])):
   mask=mask_at(board,x,y);px=(x-min(xs))*c;py=(max(ys)-y)*c;output.alpha_composite(tiles[mask],(px,py));cells.append({'cell':[x,y],'mask':mask,'pixelRect':[px,py,c,c+c//2]})
  output.save(dest/(name+'-reassembled.png'));scenes.append({'name':name,'cells':cells,'size':list(output.size)})
 guide='''# 单画布绘制操作

画布左半是墙沿/结构设计区，右半是前板设计区。请保持两半坐标、整体尺寸不变；透明blank是绘画底板，cut-windows-overlay是独立辅助层。示范图为原创结构草稿，不是最终美术。

在网页选H/T/孔洞等预览并点击墙片，查看两个区域的准确源窗和落格。橙框是实际输出窗；框外示范形状辅助构图，重复草稿不会自动同步。顶形先取，若有前板，再按标记位置覆盖合成。没有前板的状态明确显示无前板。

先参照single-master.png完成大形与连接线，再在blank上绘制；或以示范稿为底稿改画。隐藏辅助层，保存一张同尺寸PNG。网页载入该PNG后实际切47片并刷新所有预览，点出断线就返回对应源窗修画。下载当前47片ZIP与cut-map。不要只在单个回拼截图上修补。

技术切图通过不等于艺术接边通过。尤其转角、端头与前板压线需人工核对；本轮没有恢复原作者PSD，也没有接入正式工坊。
'''
 (dest/'绘制说明.md').write_text(guide,encoding='utf8')
 with zipfile.ZipFile(dest/'single-canvas-template.zip','w',zipfile.ZIP_DEFLATED) as z:
  for name in ['single-master.png','blank-single-master.png','cut-windows-overlay.png','cut-map.json','绘制说明.md']:z.write(dest/name,name)
 meta={'stateCount':len(tiles),'canvasSize':list(canvas.size),'planWidth':plan.width,'mapping':mapping,'scenes':scenes,'root':'../masters/single-canvas','paintingApproved':False}
 save(dest/'linked-data.json',meta);return meta

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--dest',required=True);p.add_argument('--gallery',required=True);a=p.parse_args()
 meta=build_single(a.source,a.dest);Path(a.gallery,'linked-data.js').write_text('window.LINKED_AUTHORING='+json.dumps(meta,ensure_ascii=False)+';',encoding='utf8');print(json.dumps({'canvasSize':meta['canvasSize'],'states':meta['stateCount'],'scenes':len(meta['scenes'])}))
