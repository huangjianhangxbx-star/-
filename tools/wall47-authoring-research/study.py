"""Read existing local study; produce new evidence, never touch game/source PNGs."""
import argparse,json,csv,math,hashlib,collections
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from model import *
from templates import build_templates,cut_tiles,save,font,caption

def read_family(old,library,fid):
 p=old/'families'/fid/'provenance.json';f=json.loads(p.read_text(encoding='utf8'));mapping=validate_mapping(f['mapping'],len(f['tiles']));images={};entries=[];identities=set()
 for tile in f['tiles']:
  if tile['index']>=len(f['tiles']) or tile['index']<0:raise ValueError('invalid Tile index')
  sp=tile['sprites'][0];key=sp['key'];p=safe_path(library,sp['png_path'])
  if sp.get('missing') or sha(p)!=sp['png_sha256']:raise ValueError('Sprite missing/changed')
  im=Image.open(p).convert('RGBA')
  if im.size!=(sp['width'],sp['height']):raise ValueError('size mismatch')
  a=np.asarray(im);images[tile['index']]=im;mask=next((m for m,i in mapping.items() if i==tile['index']),None)
  r={'mask':mask,'originalIndex':tile['index'],'tileKey':tile['key'],'spriteKey':key,'sourcePng':sp['png_path'],'sourceSha256':sp['png_sha256'],'width':im.width,'height':im.height,'ppu':sp['ppu'],'pivot':sp['pivot'],'spriteRect':sp.get('sprite_rect'),'decoder':sp.get('decoder'),'measuredAlphaRange':[int(a[:,:,3].min()),int(a[:,:,3].max())],'measuredTransparentPixels':int((a[:,:,3]==0).sum()),'measuredBlackOpaquePixels':int(((a[:,:,:3].max(axis=2)<8)&(a[:,:,3]==255)).sum()),'filterMode':sp.get('filter_mode'),'alphaBbox':im.getchannel('A').getbbox(),'sorting':'UNKNOWN','originalPSD':'UNKNOWN','visual':roles(mask) if mask is not None else {'primary':'非可达索引 / 用途未知','group':'额外索引','secondary':[]}}
  # A visible facing panel is only a measured candidate, never a layer recovered from PSD.
  front=a[round(im.width):,:,:3] if im.height>im.width else np.empty((0,0,3));r['lowerPanelBrightFraction']=float((front.mean(axis=2)>35).mean()) if front.size else 0
  if r['measuredBlackOpaquePixels']>im.width*im.height*.995:
   r['visual']['primary']='满邻域：本层无墙沿' if mask==255 else '未访问黑色项：用途未知' if mask is None else '黑色覆盖片：职责待复核'
  entries.append(r)
 if len({e['originalIndex'] for e in entries})!=len(entries):raise ValueError('duplicate tile identity')
 return f,mapping,images,entries

def compose_native(f,mapping,images,board,reverse=False):
 ppu=collections.Counter(t['sprites'][0]['ppu'] for t in f['tiles']).most_common(1)[0][0];items=[]
 for x,y in sorted(board,key=lambda p:(p[1] if reverse else -p[1],p[0])):
  mask=mask_at(board,x,y);i=mapping[mask];sp=f['tiles'][i]['sprites'][0];im=images[i];b=bounds(im.width,im.height,sp['ppu'],(sp['pivot']['x'],sp['pivot']['y']),(x,y));left=round(b[0]*ppu);top=-round(b[3]*ppu)
  items.append({'cell':[x,y],'mask':mask,'originalIndex':i,'sourcePng':sp['png_path'],'spriteKey':sp['key'],'sourceSha256':sp['png_sha256'],'worldBounds':b,'pixelRect':[left,top,im.width,im.height],'ppu':sp['ppu'],'pivot':sp['pivot'],'worldDisplayScale':ppu/sp['ppu'],'sourceScale':1,'nativeWorldExtentDifference':[im.width-im.width/sp['ppu']*ppu,im.height-im.height/sp['ppu']*ppu]})
 left=min(t['pixelRect'][0] for t in items);top=min(t['pixelRect'][1] for t in items);right=max(t['pixelRect'][0]+t['pixelRect'][2] for t in items);bottom=max(t['pixelRect'][1]+t['pixelRect'][3] for t in items);out=Image.new('RGBA',(right-left,bottom-top))
 for item in items:
  r=item['pixelRect'];r[0]-=left;r[1]-=top;out.alpha_composite(images[item['originalIndex']],(r[0],r[1]))
 return out,{'cells':items,'sourcePixelsResampled':False,'nativeScale':ppu,'originPixel':[left,top],'anchor':[.5,.5],'placementBasis':f['placement_basis'],'sorting':'comparison y ascending' if reverse else 'comparison y descending','sortingVerified':False,'mixedPPUMetricLimit':any(abs(v)>.01 for t in items for v in t['nativeWorldExtentDifference'])}

def compose_original(tiles,board,c):
 xs=[x for x,y in board];ys=[y for x,y in board];out=Image.new('RGBA',((max(xs)-min(xs)+1)*c,(max(ys)-min(ys)+1)*c+c//2));items=[]
 for x,y in sorted(board,key=lambda p:(-p[1],p[0])):
  mask=mask_at(board,x,y);px=(x-min(xs))*c;py=(max(ys)-y)*c;out.alpha_composite(tiles[mask],(px,py));items.append({'cell':[x,y],'mask':mask,'pixelRect':[px,py,c,c+c//2]})
 return out,items

def panel(image,size):
 # Display-only thumbnail; original images and source crops remain full resolution.
 result=Image.new('RGB',size,'#18222e');im=image.copy();scale=min((size[0]-24)/im.width,(size[1]-24)/im.height);im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST);result.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2),im if im.mode=='RGBA' else None);return result

def role_sheet(entries,images):
 grouped=sorted(entries,key=lambda e:(e['visual']['group'],e['mask'] if e['mask'] is not None else -1));out=Image.new('RGB',(1440,math.ceil(len(grouped)/8)*250),'#18222e');d=ImageDraw.Draw(out)
 for n,e in enumerate(grouped):
  x=n%8*180;y=n//8*250;thumb=panel(images[e['originalIndex']],(170,170));out.paste(thumb,(x,y));caption(d,(x+6,y+170),e['visual']['primary'][:12],14);caption(d,(x+6,y+195),f"原索引 {e['originalIndex']} / M{e['mask']}",13);caption(d,(x+6,y+216),f"{e['width']}×{e['height']} PPU{e['ppu']:.2f}",12)
 return out

def main():
 p=argparse.ArgumentParser();p.add_argument('--old',required=True);p.add_argument('--library',required=True);p.add_argument('--output',required=True);p.add_argument('--families',nargs='+',required=True);args=p.parse_args();old=Path(args.old).resolve();library=Path(args.library).resolve();out=Path(args.output).resolve()
 for d in ['reports','views','gallery','masters','comparisons']: (out/d).mkdir(parents=True,exist_ok=True)
 records=[];data={'families':[],'originalTemplates':'../masters/original-authoring-proposal','claims':{'authorPSDRecovered':False,'runtimeSortingVerified':False,'artApproved':False}}
 data['libraryRoot']=str(library);sourcef=[]
 for fid in args.families:
  f,mapping,images,entries=read_family(old,library,fid);folder=out/'views'/fid;folder.mkdir(parents=True,exist_ok=True);role_sheet(entries,images).save(folder/'roles.png');save(folder/'identity.json',entries);records+=entries
  scena=[]
  for name,board in cases().items():
   im,meta=compose_native(f,mapping,images,board);im.save(folder/(name+'.png'));save(folder/(name+'.json'),meta)
   annotated=im.copy();d=ImageDraw.Draw(annotated);tracks=Image.new('RGBA',im.size);td=ImageDraw.Draw(tracks)
   for item in meta['cells']:
    x,y,w,h=item['pixelRect'];d.rectangle((x,y,x+w-1,y+h-1),outline='#70c4c3',width=2);caption(d,(x+6,y+8),f"{item['originalIndex']} / M{item['mask']}",15)
    # Marks measured structural-band candidates on a separate layer; continuity metrics stay independent.
    if item['mask']&64==0:td.line((x,y+w,x+w,y+w),fill='#e5ab6bcc',width=4)
    else:td.line((x+w//2,y+12,x+w//2,y+w-12),fill='#70c4c399',width=3)
   annotated.save(folder/(name+'-annotated.png'));tracks.save(folder/(name+'-tracks.png'));tr=im.copy();tr.alpha_composite(tracks);tr.save(folder/(name+'-continuity.png'))
   alpha=Image.merge('RGB',(im.getchannel('A'),)*3);alpha.save(folder/(name+'-alpha.png'));scena.append({'name':name,'image':f'../views/{fid}/{name}.png','annotated':f'../views/{fid}/{name}-annotated.png','continuity':f'../views/{fid}/{name}-continuity.png','alpha':f'../views/{fid}/{name}-alpha.png','width':im.width,'height':im.height,**meta})
  alternative,am=compose_native(f,mapping,images,cases()['H'],True);alternative.save(folder/'H-alternative-sort.png');save(folder/'H-alternative-sort.json',am)
  # Local exact pixel reuse; many classes refute a claim of one small copied part library.
  partition={};target=next((e for e in entries if e['mask']==24),entries[0]);W,H=target['width'],target['height'];hx=W//2
  regionRects={'左上':[0,0,hx,hx],'右上':[hx,0,W-hx,hx],'左下':[0,hx,hx,W-hx],'右下':[hx,hx,W-hx,W-hx],'前板候选':[0,W,W,max(1,H-W)]}
  for label,r in regionRects.items():
   groups={}
   for e in entries:
    if (e['width'],e['height'])!=(W,H):continue
    patch=images[e['originalIndex']].crop(check_rect(r,(W,H)));digest=hashlib.sha256(patch.tobytes()).hexdigest();groups.setdefault(digest,[]).append(e['originalIndex'])
   partition[label]={'rect':r,'classes':list(groups.values()),'uniqueCount':len(groups),'claim':'exact equal rectangles only; not same historic brush stroke'}
  sharing={'regions':partition,'noOriginalPSD':True};save(folder/'sharing.json',sharing)
  continuity=[];hboard=cases()['H']
  for x,y in sorted(hboard):
   if (x+1,y) not in hboard:continue
   a=mapping[mask_at(hboard,x,y)];b=mapping[mask_at(hboard,x+1,y)];imA=images[a];imB=images[b]
   if imA.size!=imB.size:continue
   aa=np.array(imA)[:,-1,:];bb=np.array(imB)[:,0,:];delta=np.abs(aa.astype(float)-bb.astype(float));metric={'cells':[[x,y],[x+1,y]],'indices':[a,b],'rgbaMeanAbs':float(delta.mean()),'exactPixelRatio':float((aa==bb).all(axis=1).mean()),'matchingRegion':'whole shared vertical strip','claim':'pixel agreement does not prove one painted master'};continuity.append(metric)
   pair=Image.new('RGBA',(32,imA.height));pair.paste(imA.crop((imA.width-16,0,imA.width,imA.height)),(0,0));pair.paste(imB.crop((0,0,16,imB.height)),(16,0));pair.resize((128,imA.height*4),Image.Resampling.NEAREST).save(folder/f'seam-{a}-{b}-4x.png')
  save(folder/'continuity-evidence.json',continuity)
  data['families'].append({'id':fid,'label':f['label'],'slots':len(entries),'reachableMasks':len(mapping),'unusedIndices':sorted(set(range(len(entries)))-set(mapping.values())),'mappingVerifiedScreenshot':{'mask24':mapping.get(24)},'entries':entries,'scenes':scena,'sharing':sharing,'continuity':continuity,'placementBasis':f['placement_basis'],'unknowns':f['unknowns']});sourcef.append((f,mapping,images))
 c=96;proposal=out/'masters/original-authoring-proposal';summary=build_templates(proposal,c);save(out/'reports/proposal-summary.json',summary);generated={}
 for name in ['A','B','C']:
  tiles=cut_tiles(proposal/name);scene=[]
  for label,board in cases().items():
   im,items=compose_original(tiles,board,c);im.save(proposal/name/(label+'-reassembled.png'));scene.append({'name':label,'image':f'../masters/original-authoring-proposal/{name}/{label}-reassembled.png','cells':items})
  generated[name]={'scenes':scene,'mapping':json.loads((proposal/name/'cut-map.json').read_text(encoding='utf8')),'summary':summary[name]}
 data['proposals']=generated
 # Figure A: whole scenes plus the corresponding actual indices, readable without mask knowledge.
 A=Image.new('RGB',(1600,1500),'#18222e');ad=ImageDraw.Draw(A);caption(ad,(26,16),'图A｜真实木墙连续结构与切片职能（静态复原，非作者PSD）',28)
 for n,label in enumerate(['H','L','T','hole']):
  source=out/'views'/args.families[0];y=70+n*350;A.paste(panel(Image.open(source/(label+'.png')),(780,320)),(10,y));A.paste(panel(Image.open(source/(label+'-annotated.png')),(780,320)),(810,y));caption(ad,(28,y+314),label+'｜左原像素 / 右独立索引标注；显示缩略',16)
 A.save(out/'views/图A-真实墙与职能.png')
 B=Image.new('RGB',(1600,1050),'#18222e');bd=ImageDraw.Draw(B);caption(bd,(24,16),'图B｜从哪几张画板开画？三种原创生产方案',28)
 for x,name,label in [(16,'A','连续构图优先：整段墙沿与前板分层'),(816,'B','功能部件优先：接角五态×四方向＋前板')]:
  filename='H-reassembled.png' if name=='A' else 'plan-parts.png';B.paste(panel(Image.open(proposal/name/filename),(765,620)),(x,80));caption(bd,(x+10,725),label,21)
  frontfile='continuous-front.png' if name=='A' else 'front-strip.png';B.paste(panel(Image.open(proposal/name/frontfile),(760,170)),(x,770))
 caption(bd,(24,990),'均为原创简化笔画提案；原作局部差异多，特殊角采用C受控补画。',21);B.save(out/'views/图B-母版候选.png')
 C=Image.new('RGB',(1600,850),'#18222e');cd=ImageDraw.Draw(C);caption(cd,(24,16),'图C｜真实母板像素裁切 → 47态 → H形回拼（原创）',28)
 C.paste(panel(Image.open(proposal/'B/plan-parts.png'),(500,440)),(10,80));sheet=Image.new('RGBA',(8*c,6*c*3//2));tiles=cut_tiles(proposal/'B')
 for i,m in enumerate(legal_masks()):sheet.alpha_composite(tiles[m],(i%8*c,i//8*c*3//2))
 C.paste(panel(sheet,(510,620)),(530,70));C.paste(panel(Image.open(proposal/'B/H-reassembled.png'),(510,620)),(1070,70));caption(cd,(25,725),'左：五种接角；中：整数刀线/图层得47态；右：实际程序回拼',22);caption(cd,(25,780),'这证明原创切图契约可运行，不证明已找回原作的母版或成熟美术。',19);C.save(out/'views/图C-母版到47态.png')
 save(out/'gallery/data.json',data);(out/'gallery/data.js').write_text('window.WALLSTUDY='+json.dumps(data,ensure_ascii=False)+';',encoding='utf8');save(out/'reports/family-selection.json',[{'id':f['id'],'label':f['label'],'reason':'target screenshot' if i==0 else 'different material verified wall comparison'} for i,(f,m,im) in enumerate(sourcef)])
 for family in data['families']:
  save(out/'reports'/f"{family['id']}-evidence.json",family)
  with (out/'reports'/f"{family['id']}-tile-roles.csv").open('w',encoding='utf-8-sig',newline='') as stream:
   writer=csv.DictWriter(stream,fieldnames=['mask','originalIndex','primary','secondary','width','height','ppu','spriteKey','sourcePng','sha256']);writer.writeheader()
   for e in family['entries']:writer.writerow({'mask':e['mask'],'originalIndex':e['originalIndex'],'primary':e['visual']['primary'],'secondary':' / '.join(e['visual']['secondary']),'width':e['width'],'height':e['height'],'ppu':e['ppu'],'spriteKey':e['spriteKey'],'sourcePng':e['sourcePng'],'sha256':e['sourceSha256']})
 # Compare direct cut hypotheses against exact original sprites in witnessed runtime compositions.
 f,mapping,images=sourcef[0];direct={}
 for scene in data['families'][0]['scenes']:
  canvas=Image.open(out/'views'/f['id']/(scene['name']+'.png')).convert('RGBA')
  for entry in scene['cells']:
   x,y,w,h=entry['pixelRect'];match=canvas.crop((x,y,x+w,y+h)).tobytes()==images[entry['originalIndex']].tobytes();direct.setdefault(entry['mask'],[]).append({'scene':scene['name'],'sourceRect':[x,y,w,h],'exactOriginal':match})
 missing=set(legal_masks())-set(direct);good=[m for m,a in direct.items() if any(r['exactOriginal'] for r in a)];save(out/'reports/hypothesis-A-cut-evidence.json',{'coveredScenesMasks':len(direct),'exactAtLeastOnce':len(good),'notObservedMasks':sorted(missing),'states':direct,'limit':'Composite scene overlaps may destroy original source windows; master was not recovered'})
 provenance={'build':24101688,'inputs':[{'path':str(library/e['sourcePng']),'sha256':e['sourceSha256'],'spriteKey':e['spriteKey']} for e in records],'generated':[],'noGameUnpack':True,'noOriginalWrites':True}
 for file in out.rglob('*'):
  if file.is_file() and file.suffix in ['.png','.json','.csv']:provenance['generated'].append({'path':str(file.relative_to(out)),'sha256':sha(file)})
 save(out/'reports/provenance.json',provenance);print(json.dumps({'families':[(f['label'],f['reachableMasks']) for f in data['families']],'proposal':summary,'originalDirectCut':{'observed':len(direct),'exact':len(good),'missing':len(missing)}},ensure_ascii=False))
if __name__=='__main__':main()
