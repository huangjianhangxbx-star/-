#!/usr/bin/env python3
"""Flat-color geometric UI renderer. All pixels originate from deterministic shapes.
No generative model or Photoshop required. Supports independently editable raster layers.
"""
import argparse, copy, hashlib, json, math
from pathlib import Path

from PIL import Image, ImageDraw

BASE=(10,11,14,255)
DARK=(20,22,27,255)
OUTER=(2,3,5,255)
SCALE=4


def rgba(s):
    v=s.lstrip('#')
    if len(v)!=6:raise ValueError(f'Bad hex color {s}')
    return (*[int(v[i:i+2],16) for i in (0,2,4)],255)


def rgbhex(rgb):
    return '#'+''.join(f'{x:02X}' for x in rgb[:3])


def new_layer(size):
    return Image.new('RGBA',(size[0]*SCALE,size[1]*SCALE),(0,0,0,0))


def p(v):return int(round(v*SCALE))

def pts(vertices):return [(p(x),p(y)) for x,y in vertices]

def scaled_box(box):return tuple(p(x) for x in box)

def polygon(d, vertices, fill):d.polygon(pts(vertices), fill=fill)

def rect(d, x0,y0,x1,y1,fill):d.rectangle(scaled_box((x0,y0,x1,y1)),fill=fill)

def line(d,vertices,fill,width):d.line(pts(vertices),fill=fill,width=max(1,p(width)),joint='curve')

def ellipse(d,box,fill=None,outline=None,width=1):
    d.ellipse(scaled_box(box),fill=fill,outline=outline,width=max(1,p(width)))

def closed_line(d,vertices,color,width):line(d,vertices+[vertices[0]],color,width)

def downsample(img):
    # Pillow downsamples the native RGBA image; geometry is supersampled before reduction.
    return img.resize((img.width//SCALE,img.height//SCALE),Image.Resampling.LANCZOS)


def composite(*layers):
    target=Image.new('RGBA',layers[0].size,(0,0,0,0))
    for layer in layers:target=Image.alpha_composite(target,layer)
    return target


def shape_points(shape, size, inset, cut=0):
    w,h=size
    x0=y0=inset
    x1=w-inset; y1=h-inset
    if shape=='diamond':
        cx=w/2;cy=h/2
        return [(cx,y0),(x1,cy),(cx,y1),(x0,cy)]
    if shape=='rectangle' or shape=='square':
        c=max(0,min(float(cut),(x1-x0)/5,(y1-y0)/5))
        if c<=0:return [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
        return [(x0+c,y0),(x1-c,y0),(x1,y0+c),(x1,y1-c),
                (x1-c,y1),(x0+c,y1),(x0,y1-c),(x0,y0+c)]
    raise ValueError('Unsupported slot shape: '+str(shape))


def style_variants(kind, base_accent, count=5):
    if kind=='skill_slot':
        variations=[
            {'name':'standard','outline':2,'inset':16,'cut':0,'double':False,'frame':6},
            {'name':'fine-double','outline':1.8,'inset':17,'cut':0,'double':True,'frame':6},
            {'name':'subtle-cut','outline':2,'inset':17,'cut':9,'double':False,'frame':7},
            {'name':'narrow-rim','outline':1.5,'inset':25,'cut':0,'double':True,'frame':9},
            {'name':'bold-ink','outline':3,'inset':16,'cut':2,'double':False,'frame':8}]
    elif kind=='portrait_frame':
        variations=[
            {'name':'plain-ring','ring':16,'stroke':2,'double':False,'marks':0,'tab':False},
            {'name':'double-ring','ring':16,'stroke':2,'double':True,'marks':0,'tab':False},
            {'name':'four-ticks','ring':18,'stroke':2,'double':False,'marks':4,'tab':False},
            {'name':'thin-ring','ring':12,'stroke':1.5,'double':True,'marks':0,'tab':False},
            {'name':'quiet-anchor','ring':16,'stroke':2.5,'double':False,'marks':0,'tab':True}]
    elif kind=='health_bar':
        variations=[
            {'name':'plain','stroke':2,'pad':7,'inner':False,'ticks':0,'border_margin':0},
            {'name':'double-outline','stroke':1.8,'pad':8,'inner':True,'ticks':0,'border_margin':0},
            {'name':'thin-outline','stroke':1.4,'pad':6,'inner':False,'ticks':0,'border_margin':2},
            {'name':'three-ticks','stroke':1.9,'pad':7,'inner':False,'ticks':3,'border_margin':0},
            {'name':'heavy-black','stroke':2.5,'pad':10,'inner':False,'ticks':0,'border_margin':0}]
    else:raise ValueError('Invalid kind: '+kind)
    if not 1<=count<=5:raise ValueError('variant count must be 1–5')
    for item in variations[:count]:
        item['accent']=base_accent
    return variations[:count]


def render_slot(size, color, variant, shape):
    w,h=size
    base=new_layer(size); bd=ImageDraw.Draw(base)
    frame=new_layer(size); fd=ImageDraw.Draw(frame)
    inset=variant['inset']; cut=variant['cut']
    outside=shape_points(shape,size,inset-variant['frame'],cut)
    inside=shape_points(shape,size,inset,cut)
    polygon(bd,outside,OUTER)
    polygon(bd,inside,BASE)
    closed_line(fd,inside,color,variant['outline'])
    if variant['double']:
        closed_line(fd,shape_points(shape,size,inset+7,cut),DARK,1.2)
    # one neutral variant has a tiny geometric middle slit at bottom, never a symbol
    return {'base':base,'frame':frame}, {
      'content_safe_bounds':[round(w*.19),round(h*.19),round(w*.81),round(h*.81)],
      'shape':shape,'accent':rgbhex(color),'line_width':variant['outline']}


def render_portrait(size, color, variant):
    w,h=size
    cx,cy=w/2,h/2
    radius=min(w,h)*.445
    base=new_layer(size);bd=ImageDraw.Draw(base)
    frame=new_layer(size);fd=ImageDraw.Draw(frame)
    r=variant['ring'];stroke=variant['stroke']
    # create a mathematically circular ring. Inner hole is transparent for portrait layering.
    outer=(cx-radius-r/2,cy-radius-r/2,cx+radius+r/2,cy+radius+r/2)
    inner=(cx-radius+r/2,cy-radius+r/2,cx+radius-r/2,cy+radius-r/2)
    ellipse(bd,outer,fill=OUTER)
    ellipse(bd,inner,fill=(0,0,0,0))
    rim_radius=radius
    ellipse(fd,(cx-rim_radius,cy-rim_radius,cx+rim_radius,cy+rim_radius),outline=color,width=stroke)
    if variant['double']:
        rr=radius-r*.27
        ellipse(fd,(cx-rr,cy-rr,cx+rr,cy+rr),outline=DARK,width=1.4)
    if variant['marks']:
        for a in (0,90,180,270):
            theta=math.radians(a)
            x1=cx+math.cos(theta)*(radius+r*.10)
            y1=cy+math.sin(theta)*(radius+r*.10)
            x2=cx+math.cos(theta)*(radius+r*.42)
            y2=cy+math.sin(theta)*(radius+r*.42)
            line(fd,[(x1,y1),(x2,y2)],color,2.3)
    if variant['tab']:
        # tiny bottom anchor kept inside the circular outline silhouette
        x=cx;y=cy+radius
        polygon(fd,[(x-9,y-6),(x+9,y-6),(x+9,y+7),(x,y+10),(x-9,y+7)],OUTER)
        line(fd,[(x-5,y-3),(x+5,y-3)],color,2)
    return {'base':base,'frame':frame},{
        'portrait_center':[int(cx),int(cy)],'portrait_radius':round(radius-r,2),
        'content_safe_bounds':[round(cx-radius+r),round(cy-radius+r),round(cx+radius-r),round(cy+radius-r)],
        'shape':'circle','accent':rgbhex(color),'outside_and_center_alpha':0}


def render_bar(size,color,variant,fill_percent=.76):
    w,h=size
    outside=new_layer(size);od=ImageDraw.Draw(outside)
    frame=new_layer(size);fd=ImageDraw.Draw(frame)
    filling_full=new_layer(size);ff=ImageDraw.Draw(filling_full)
    filling_sample=new_layer(size);fs=ImageDraw.Draw(filling_sample)
    pad=variant['pad']
    margin=variant['border_margin']
    box=[12+margin,18+margin,w-12-margin,h-18-margin]
    rect(od,*box,OUTER)
    bx0,by0,bx1,by1=box
    inn=[bx0+pad,by0+pad,bx1-pad,by1-pad]
    rect(od,*inn,BASE)
    ix0,iy0,ix1,iy1=inn
    fill_box=[ix0+2,iy0+2,ix1-2,iy1-2]
    rect(ff,*fill_box,color)
    x0,y0,x1,y1=fill_box
    xprogress=x0+(x1-x0)*fill_percent
    rect(fs,x0,y0,xprogress,y1,color)
    closed_line(fd,[(bx0+1,by0+1),(bx1-1,by0+1),(bx1-1,by1-1),(bx0+1,by1-1)],color,variant['stroke'])
    if variant['inner']:
        closed_line(fd,[(ix0,iy0),(ix1,iy0),(ix1,iy1),(ix0,iy1)],DARK,1)
    if variant['ticks']:
        for i in range(1,variant['ticks']+1):
            x=ix0+(ix1-ix0)*i/(variant['ticks']+1)
            line(fd,[(x,iy0+2),(x,iy1-2)],DARK,1.5)
    return {'base':outside,'fill_full':filling_full,'fill_76pct':filling_sample,'frame':frame}, {
        'fill_track_box':[round(x) for x in fill_box],'demonstration_fill_ratio':fill_percent,
        'shape':'rectangle','accent':rgbhex(color),
        'runtime_note':'Clip fill_full.png to fill_track_box proportional width; frame.png remains on top.'}


def save_variants(analysis, out_dir, kind=None, count=5, accent=None, shape=None, size=None):
    if analysis.get('schema')!='xh-ui-reference/2':
        raise ValueError('Expected xh-ui-reference/2 analysis, not arbitrary JSON')
    it=analysis['interpretation']
    kind=kind or it['target_type']
    if kind not in ('skill_slot','portrait_frame','health_bar'):
        raise ValueError('Uncertain kind; rerun --type or pass --kind manually')
    shape=shape or it['geometry']
    if kind=='skill_slot' and shape not in ('square','diamond','rectangle'):
        raise ValueError('Skill slot shape unresolved. Select --shape square or diamond after visual review.')
    if kind=='portrait_frame' and shape!='circle':
        raise ValueError('Portrait frames must remain circles; pass --shape circle')
    if kind=='health_bar' and shape!='rectangle':
        raise ValueError('Health bars must remain rectangles; pass --shape rectangle')
    if size is None:
        size={'skill_slot':(256,256),'portrait_frame':(512,512),'health_bar':(1024,96)}[kind]
    if min(size)<32 or max(size)>4096:raise ValueError('Output dimensions 32–4096 only')
    accent=accent or it['candidate_accent']
    color=rgba(accent)
    variants=style_variants(kind,accent,count)
    out=Path(out_dir);out.mkdir(parents=True,exist_ok=True)
    written=[]
    for index,params in enumerate(variants,1):
        if kind=='skill_slot':
            layers,metrics=render_slot(size,color,params,shape)
        elif kind=='portrait_frame':
            layers,metrics=render_portrait(size,color,params)
        else:
            measured=analysis.get('observations',{}).get('geometry_measurements',{})
            suggested=float(measured.get('fill_ratio_candidate',.76))
            layers,metrics=render_bar(size,color,params, max(.05,min(.98,suggested)))
        label=f'v{index:02d}-{params["name"]}'
        target=out/label
        target.mkdir(exist_ok=True)
        for name,layer in layers.items():
            downsample(layer).save(target/(name+'.png'))
        ordered=['base','fill_76pct','frame'] if kind=='health_bar' else ['base','frame']
        final=downsample(composite(*[layers[k] for k in ordered]))
        final.save(target/'preview.png')
        meta={'variant':label,'kind':kind,'size':list(size),'source_sha256':analysis['source']['sha256'],
             'source_file':analysis['source']['filename'],'source_crop':analysis['source']['selected_region'],
             'style':'solid-black-base, single flat accent, simple geometry',
             'parameters':params,'metrics':metrics,
             'rendering':'4x supersampling + Pillow LANCZOS; no directional highlights'}
        (target/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        written.append(label)
    summary={'schema':'xh-ui-output/2','kind':kind,'geometry':shape,'accent':accent,'size':list(size),
             'source_sha256':analysis['source']['sha256'],'reference_role':analysis['source']['reference_role'],
             'approval_status':analysis['approval_status'],'variants':written,'profile':'geometry-outline-v0.2'}
    (out/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return summary


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--analysis',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--count',type=int,default=5)
    ap.add_argument('--kind',choices=('skill_slot','portrait_frame','health_bar'))
    ap.add_argument('--shape',choices=('square','diamond','circle','rectangle'))
    ap.add_argument('--accent',help='#RRGGBB overrides automatic candidate, preserves same accent in all variants')
    ap.add_argument('--size',help='WIDTHxHEIGHT, defaults by kind')
    a=ap.parse_args()
    analysis=json.loads(Path(a.analysis).read_text(encoding='utf-8'))
    dims=None
    if a.size:
        x,y=a.size.lower().split('x');dims=(int(x),int(y))
    result=save_variants(analysis,a.out,a.kind,a.count,a.accent,a.shape,dims)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
