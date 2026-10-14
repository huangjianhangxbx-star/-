"""Original editable A/B boards. No game pixels, indices or traced contours."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw
from model import legal_masks,cases,mask_at,check_rect,safe_path

def save(p,v):p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def font(n=18):
 from PIL import ImageFont
 return ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
def caption(draw,xy,text,size=18,fill='#e7e2d7'):draw.text(xy,text,font=font(size),fill=fill)

def part(q,state,h):
 im=Image.new('RGBA',(h,h));d=ImageDraw.Draw(im);t=max(6,h//3)
 # Each quadrant independently authored in its natural orientation; no source mirroring.
 left=q in (0,2);top=q in (0,1);x=0 if left else h-t;y=0 if top else h-t
 if state in (0,1):d.rectangle((x,0,x+t-1,h-1),fill='#50696c',outline='#172b30',width=2)
 if state in (0,2):d.rectangle((0,y,h-1,y+t-1),fill='#70888a',outline='#172b30',width=2)
 if state==3:d.rectangle((x,y,x+t-1,y+t-1),fill='#536d71',outline='#172b30',width=2)
 if state!=4:
  if state in (0,1):d.line((x+t//2,3,x+t//2,h-4),fill='#9eb1ad',width=2)
  if state in (0,2):d.line((3,y+t//2,h-4,y+t//2),fill='#b8c1b1',width=2)
 return im

def component_state(m,q):
 a,b,diag=((8,2,1),(16,2,4),(8,64,32),(16,64,128))[q]
 if not m&a and not m&b:return 0
 if not m&a:return 1
 if not m&b:return 2
 return 3 if not m&diag else 4

def front(c):
 im=Image.new('RGBA',(c,c));d=ImageDraw.Draw(im);d.rectangle((0,0,c-1,c-1),fill='#405358');d.line((0,1,c-1,1),fill='#afbaad',width=3);d.line((0,c-2,c-1,c-2),fill='#13262c',width=3)
 for x in range(c//6,c,c//5):d.line((x,4,x-2,c-6),fill='#1d343b',width=2);d.line((x+3,6,x+4,c-9),fill='#60777a',width=1)
 return im

def cut_tiles(folder):
 folder=Path(folder);m=json.loads((folder/'cut-map.json').read_text(encoding='utf8'));images={};out={};seen=set()
 if m.get('schema')!='original-wall47/1' or m['c']%2:raise ValueError('invalid authoring contract')
 for s in m['states']:
  mask=s['mask']
  if mask in seen or mask not in legal_masks():raise ValueError('duplicate/illegal mask')
  seen.add(mask);im=Image.new('RGBA',tuple(m['tileSize']))
  for layer in s['layers']:
   name=layer['board'];p=safe_path(folder,name)
   if p.suffix.lower()!='.png':raise ValueError('not PNG')
   if name not in images:images[name]=Image.open(p).convert('RGBA')
   rect=check_rect(layer['rect'],images[name].size);x,y=layer['position'];patch=images[name].crop(rect)
   if type(x)!=int or type(y)!=int or x<0 or y<0 or x+patch.width>im.width or y+patch.height>im.height:raise ValueError('layer outside tile')
   im.alpha_composite(patch,(x,y))
  out[mask]=im
 if seen!=set(legal_masks()):raise ValueError('incomplete authoring states')
 return out

def build_templates(root,c=96):
 root=Path(root);h=c//2;root.mkdir(parents=True,exist_ok=True);B=root/'B';B.mkdir(exist_ok=True);components=Image.new('RGBA',(5*h,4*h));guide=Image.new('RGBA',components.size);gd=ImageDraw.Draw(guide)
 for q in range(4):
  for state in range(5):components.alpha_composite(part(q,state,h),(state*h,q*h));gd.rectangle((state*h,q*h,(state+1)*h-1,(q+1)*h-1),outline='#e5ab6b',width=1)
 components.save(B/'plan-parts.png');front(c).save(B/'front-strip.png');Image.new('RGBA',components.size).save(B/'blank-plan-parts.png');Image.new('RGBA',(c,c)).save(B/'blank-front-strip.png');guide.save(B/'annotation-plan-parts.png')
 states=[]
 for mask in legal_masks():
  layers=[{'board':'plan-parts.png','rect':[component_state(mask,q)*h,q*h,h,h],'position':[(q%2)*h,(q//2)*h],'role':['左上接合','右上接合','左下接合','右下接合'][q]} for q in range(4)]
  if not mask&64:layers.append({'board':'front-strip.png','rect':[0,0,c,c],'position':[0,h],'role':'下方不接时的前面板'})
  states.append({'mask':mask,'layers':layers,'manualCorrections':['交角双墨线与竖框落点需画师修正'] if mask in [10,18,72,80,90] else []})
 save(B/'cut-map.json',{'schema':'original-wall47/1','c':c,'tileSize':[c,c+h],'ppu':100,'pivot':[.5,1/3],'source':'original illustrative proposal; not original-game mapping','states':states,'editableLayers':['blank-plan-parts.png','blank-front-strip.png'],'correctionPolicy':'use C direct replacement for complex corners after visual review'})
 tiles=cut_tiles(B);tiledir=B/'tiles';tiledir.mkdir(exist_ok=True)
 for mask,im in tiles.items():im.save(tiledir/f'mask-{mask:03}.png')
 # A chooses continuous topologies greedily, then isolated 3x3 witness regions for gaps.
 pool=cases();remaining=set(legal_masks());chosen=[];coverage={name:{mask_at(board,x,y) for x,y in board} for name,board in pool.items()}
 while any(coverage[n]&remaining for n in pool):
  name=max(pool,key=lambda n:(len(coverage[n]&remaining),-len(pool[n])));board=pool.pop(name);chosen.append((name,board));remaining-=coverage[name]
 for mask in sorted(remaining):
  board={(1,1)}|{(1+dx,1+dy) for dx,dy,bit in ((0,1,2),(-1,0,8),(0,-1,64),(1,0,16),(-1,1,1),(1,1,4),(-1,-1,32),(1,-1,128)) if mask&bit};chosen.append((f'corner-finish-{mask}',board))
 cols=4;cw=8;ch=8;rows=math.ceil(len(chosen)/cols);plan=Image.new('RGBA',(cols*cw*c,rows*ch*c));face=Image.new('RGBA',(cols*cw*c,rows*ch*c));annot=Image.new('RGBA',plan.size);ad=ImageDraw.Draw(annot);sources={};regions=[]
 for i,(name,board) in enumerate(chosen):
  ox=(i%cols)*cw+1;oy=(i//cols)*ch+1;minx=min(x for x,y in board);miny=min(y for x,y in board)
  for x,y in board:
   sx,sy=ox+x-minx,oy+(max(yy for xx,yy in board)-y);mask=mask_at(board,x,y);im=tiles[mask];plan.alpha_composite(im.crop((0,0,c,c)),(sx*c,sy*c))
   if not mask&64:face.alpha_composite(im.crop((0,h,c,c+h)),(sx*c,sy*c))
   sources.setdefault(mask,{'plan':[sx*c,sy*c,c,c],'front':[sx*c,sy*c,c,c],'region':name});ad.rectangle((sx*c,sy*c,(sx+1)*c-1,(sy+1)*c-1),outline='#e5ab6b',width=1)
  regions.append({'name':name,'cells':sorted([list(p) for p in board]),'origin':[ox,oy],'states':sorted({mask_at(board,x,y) for x,y in board})})
 A=root/'A';A.mkdir(exist_ok=True);plan.save(A/'continuous-plan.png');face.save(A/'continuous-front.png');Image.new('RGBA',plan.size).save(A/'blank-continuous-plan.png');Image.new('RGBA',face.size).save(A/'blank-continuous-front.png');annot.save(A/'annotation-cuts.png')
 a_states=[]
 for mask in legal_masks():
  src=sources[mask];layers=[{'board':'continuous-plan.png','rect':src['plan'],'position':[0,0],'role':'连续主体设计区 '+src['region']}]
  if not mask&64:layers.append({'board':'continuous-front.png','rect':src['front'],'position':[0,h],'role':'独立连续前板层 '+src['region']})
  a_states.append({'mask':mask,'layers':layers,'manualCorrections':[]})
 save(A/'cut-map.json',{'schema':'original-wall47/1','c':c,'tileSize':[c,c+h],'ppu':100,'pivot':[.5,1/3],'states':a_states,'source':'original continuous-region proposal; not original-game mapping','regions':regions,'editableLayers':['blank-continuous-plan.png','blank-continuous-front.png']})
 at=cut_tiles(A);(A/'tiles').mkdir(exist_ok=True)
 for mask,im in at.items():im.save(A/'tiles'/f'mask-{mask:03}.png')
 # C provides real editable state windows under the same common design, explicit special-case lane.
 C=root/'C';C.mkdir(exist_ok=True);sheet=Image.new('RGBA',(8*c,6*(c+h)));lines=Image.new('RGBA',sheet.size);ld=ImageDraw.Draw(lines);cs=[]
 for i,mask in enumerate(legal_masks()):
  x=i%8*c;y=i//8*(c+h);sheet.alpha_composite(tiles[mask],(x,y));ld.rectangle((x,y,x+c-1,y+c+h-1),outline='#e5ab6b',width=1);cs.append({'mask':mask,'layers':[{'board':'controlled-state-sheet.png','rect':[x,y,c,c+h],'position':[0,0],'role':'共用设计下独立补画'}]})
 sheet.save(C/'controlled-state-sheet.png');Image.new('RGBA',sheet.size).save(C/'blank-controlled-state-sheet.png');lines.save(C/'annotation-cuts.png');save(C/'cut-map.json',{'schema':'original-wall47/1','c':c,'tileSize':[c,c+h],'ppu':100,'pivot':[.5,1/3],'states':cs,'source':'original controlled state correction proposal'})
 report={'A':{'continuousRegions':len(regions),'boards':2,'sizes':[plan.size,face.size],'covered':47,'note':'连续顶形与前板分层，可避免整块1.5高窗口夹入邻片；画师仍需统一接边'},'B':{'boards':2,'parts':20,'sizes':[components.size,(c,c)],'covered':47,'note':'五类接角×四方向+连续前板。只验证原创结构组合，非原作无损分解'},'C':{'boards':1,'slots':47,'size':sheet.size,'covered':47,'note':'统一草稿后对独立端头/内凹作受控补画'}};save(root/'proposal-summary.json',report)
 (C/'tiles').mkdir(exist_ok=True)
 for mask,im in cut_tiles(C).items():im.save(C/'tiles'/f'mask-{mask:03}.png')
 for name,folder in [('A',A),('B',B),('C',C)]:
  (folder/'step-by-step.md').write_text('# 原创墙体候选 '+name+'\n\n透明blank文件为可编辑画板；annotation是独立辅助层，导出隐藏。先画整体形体/大色块，再沿连续墙沿和竖板画结构线，保留连接端共边校对；最后补角、按cut-map切图并在H/T/孔洞回拼。paint图只为原创简化笔画教学，不是成品风格认可。此套默认PPU100，与原作研究PPU完全分开。\n',encoding='utf8')
 return report
