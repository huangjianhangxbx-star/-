"""Independent conditional-eight-neighbor research and integer authoring contracts."""
from pathlib import Path
import hashlib,math
NEIGHBORS=((0,1,2),(-1,0,8),(0,-1,64),(1,0,16),(-1,1,1),(1,1,4),(-1,-1,32),(1,-1,128))
def normalize(mask):
 if type(mask)!=int or mask<0 or mask>255:raise ValueError('mask out of range')
 for diagonal,a,b in ((1,2,8),(4,2,16),(32,8,64),(128,16,64)):
  if not(mask&a and mask&b):mask &= ~diagonal
 return mask
def legal_masks():return sorted({normalize(m) for m in range(256)})
def cardinal_count(mask):return sum(bool(mask&b) for b in (2,8,64,16))
def mask_at(cells,x,y):return normalize(sum(bit for dx,dy,bit in NEIGHBORS if (x+dx,y+dy) in cells))
def validate_mapping(mapping,slots):
 result={int(k):int(v) for k,v in mapping.items()}
 if set(result)!=set(legal_masks()) or len(result)!=len(mapping) or any(v<0 or v>=slots for v in result.values()):raise ValueError('mapping incomplete/illegal')
 return result
def bounds(w,h,ppu,pivot,cell,anchor=(.5,.5)):
 if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (w,h,ppu,*pivot,*cell,*anchor)) or w<=0 or h<=0 or ppu<=0 or len(pivot)!=2 or len(cell)!=2 or len(anchor)!=2:raise ValueError('invalid PPU/Pivot/placement')
 left=cell[0]+anchor[0]-w/ppu*pivot[0];bottom=cell[1]+anchor[1]-h/ppu*pivot[1]
 return left,bottom,left+w/ppu,bottom+h/ppu
def check_rect(r,size):
 if len(r)!=4 or any(type(x)!=int for x in r):raise ValueError('integer crop required')
 x,y,w,h=r
 if w<=0 or h<=0 or x<0 or y<0 or x+w>size[0] or y+h>size[1]:raise ValueError('crop out of bounds')
 return x,y,x+w,y+h
def safe_path(root,rel):
 if not isinstance(rel,str) or not rel or ':' in rel or '\\' in rel or '..' in Path(rel).parts or Path(rel).is_absolute():raise ValueError('illegal indexed path')
 root=Path(root).resolve();p=(root/rel).resolve()
 if not p.is_relative_to(root):raise ValueError('path outside library')
 return p
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def roles(m):
 directions=[label for bit,label in ((2,'上'),(8,'左'),(64,'下'),(16,'右')) if m&bit];n=len(directions)
 if n==0:name='孤立收尾';group='孤立与端头'
 elif n==1:name=directions[0]+'接端头';group='孤立与端头'
 elif n==2 and m&66==66:name='竖直延展';group='直线主体'
 elif n==2 and m&24==24:name='横向延展';group='直线主体'
 elif n==2:name=''.join(directions)+'转角';group='外角转折'
 elif n==3:name='T型'+' / '.join(directions)+'接';group='T型交接'
 else:name='四向汇合';group='四向与内凹'
 corners=[label for bit,edges,label in ((1,10,'左上'),(4,18,'右上'),(32,72,'左下'),(128,80,'右下')) if m&edges==edges and not m&bit]
 tags=(['前面板候选'] if not m&64 else ['下接通行 / 前面板省略候选'])+[c+'内凹' for c in corners]
 return {'primary':name,'group':group,'secondary':tags,'missingCorners':corners,'logicBasis':directions,'visualStatus':'geometry classification; verify actual image'}
def cases():
 solid=lambda n:{(x,y) for x in range(n) for y in range(n)}
 return {'single':{(0,0)},'horizontal3':{(x,0) for x in range(3)},'horizontal7':{(x,0) for x in range(7)},'vertical3':{(0,y) for y in range(3)},'vertical7':{(0,y) for y in range(7)},'L':{(0,y) for y in range(4)}|{(x,0) for x in range(4)},'T':{(x,3) for x in range(5)}|{(2,y) for y in range(4)},'U':{(0,y) for y in range(4)}|{(4,y) for y in range(4)}|{(x,0) for x in range(5)},'cross':{(2,y) for y in range(5)}|{(x,2) for x in range(5)},'H':{(0,y) for y in range(5)}|{(4,y) for y in range(5)}|{(x,2) for x in range(5)},'hole':solid(5)-{(2,2)},'concave':solid(5)-{(x,y) for x in range(2,5) for y in range(2,5)},'boundary':{(0,0),(1,0),(2,0),(2,1),(2,2)},'double-notch':solid(5)-{(1,2),(3,2)}}
