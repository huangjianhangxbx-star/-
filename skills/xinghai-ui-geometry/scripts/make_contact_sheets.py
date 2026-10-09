#!/usr/bin/env python3
"""Make human review sheets from rendered transparent PNG variants."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

KINDS=['square-frame','diamond-frame','portrait-frame','health-bar-auto']


def font(size=23):
    try:return ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',size)
    except OSError:return ImageFont.load_default()


def checker(size, cell=14):
    w,h=size
    i=Image.new('RGB',(w,h),'#F4F4F4')
    d=ImageDraw.Draw(i)
    for y in range(0,h,cell):
        for x in range(0,w,cell):
            if (x//cell+y//cell)%2:d.rectangle((x,y,x+cell,y+cell),fill='#DADADA')
    return i


def make(root, out_dir):
    root=Path(root);out_dir=Path(out_dir);out_dir.mkdir(parents=True,exist_ok=True)
    CW=276; CH=294; M=16
    sheet=Image.new('RGB',(CW*5+M*2, CH*4+M*2),'#E4E7EB')
    d=ImageDraw.Draw(sheet)
    titlemap={'square-frame':'正方形技能槽','diamond-frame':'菱形技能槽','portrait-frame':'圆形头像框','health-bar-auto':'红色血条'}
    for row,kind in enumerate(KINDS):
        manifest=root/kind/'manifest.json'
        if not manifest.exists():continue
        spec=json.loads(manifest.read_text(encoding='utf-8'))
        for idx,label in enumerate(spec['variants']):
            img=Image.open(root/kind/label/'preview.png').convert('RGBA')
            target_size=(238,238) if kind!='health-bar-auto' else (238,66)
            img.thumbnail(target_size,Image.Resampling.LANCZOS)
            cell=checker((245,244),20)
            x=(245-img.width)//2
            y=(244-img.height)//2
            cell.paste(img,(x,y),img)
            startx=M+idx*CW
            starty=M+row*CH
            sheet.paste(cell,(startx,starty))
            d.rectangle((startx,starty,startx+245,starty+244),outline='#A5AAB0',width=2)
            d.text((startx+4,starty+248),f'{kind} / {label}',font=font(13),fill='#202124')
            d.text((startx+4,starty+267),titlemap[kind],font=font(16),fill='#292B30')
    target=out_dir/'v0.2-all-20-variants.png'
    sheet.save(target)
    for row,kind in enumerate(KINDS):
        band=sheet.crop((0,M+row*CH,CW*5+M*2,M+row*CH+CH))
        band.save(out_dir/(kind+'-5-variants.png'))
    return target

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--samples',required=True)
    p.add_argument('--out',required=True)
    a=p.parse_args()
    print('made',make(a.samples,a.out))
