#!/usr/bin/env python3
"""One-command reference → measurement → deterministic variants → review contact sheet.
Do not overwrite existing work unless the user explicitly requests --replace.
"""
import argparse, json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from analyze_reference import analyze, write_report
from render_variants import save_variants
from validate_exports import check_samples


def _font(sz):
    try:return ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',sz)
    except OSError:
        try:return ImageFont.truetype('arial.ttf',sz)
        except OSError:return ImageFont.load_default()


def _contact(samples, output):
    manifest=json.loads((samples/'manifest.json').read_text(encoding='utf-8'))
    variants=manifest['variants']
    w=280*len(variants)+16
    sh=312
    sheet=Image.new('RGB',(w,sh),'#F1F2F3')
    d=ImageDraw.Draw(sheet)
    for i,name in enumerate(variants):
        startx=12+280*i
        panel=Image.new('RGB',(248,248),'#F8F8F8')
        c=ImageDraw.Draw(panel)
        for y in range(0,248,16):
            for x in range(0,248,16):
                if ((x+y)//16)%2:c.rectangle((x,y,x+15,y+15),fill='#DEDEDE')
        im=Image.open(samples/name/'preview.png').convert('RGBA')
        im.thumbnail((230,224),Image.Resampling.LANCZOS)
        panel.paste(im,((248-im.width)//2,(248-im.height)//2),im)
        sheet.paste(panel,(startx,10))
        d.text((startx,267),name,font=_font(16),fill='#20242A')
        d.text((startx,290),f'{manifest["kind"]} · {manifest["accent"]}',font=_font(11),fill='#484D52')
    sheet.save(output)


def main():
    p=argparse.ArgumentParser(description='Reference-driven UI variants, semi-automatic with explicit review flags')
    p.add_argument('--input',required=True)
    p.add_argument('--kind',choices=('auto','skill_slot','portrait_frame','health_bar'),default='auto')
    p.add_argument('--shape',choices=('auto','square','diamond','circle','rectangle'),default='auto')
    p.add_argument('--crop',help='x,y,w,h (select a single UI component from a busy screenshot)')
    p.add_argument('--accent',help='explicit flat pure color #RRGGBB; optional')
    p.add_argument('--role',choices=('shape','style','both'),default='both')
    p.add_argument('--count',type=int,choices=(3,4,5),default=5)
    p.add_argument('--size',help='WIDTHxHEIGHT; optional')
    p.add_argument('--out',required=True)
    a=p.parse_args()
    out=Path(a.out)
    if out.exists() and any(out.iterdir()):
        p.error('Output directory not empty: choose a new destination. This tool never removes or overwrites existing work.')
    out.mkdir(parents=True,exist_ok=True)
    report=analyze(a.input,a.crop,a.kind,a.shape,a.accent,ref_role=a.role)
    write_report(report,out/'reference-analysis.json')
    dims=None
    if a.size:
        try:dims=tuple(map(int,a.size.lower().split('x')))
        except Exception as e: p.error('size must be WIDTHxHEIGHT')
        if len(dims)!=2:p.error('size must be WIDTHxHEIGHT')
    try:
        summary=save_variants(report,out/'variants',count=a.count,size=dims)
    except Exception as e:
        # Preserve the analysis: a reviewable blocker, not pretend a render was completed.
        (out/'BLOCKED.txt').write_text(str(e)+'\nVisual review/type selection required.\n',encoding='utf-8')
        print('BLOCKED:',str(e),'\nAnalysis is available:',out/'reference-analysis.json')
        raise SystemExit(2)
    _contact(out/'variants',out/'review-sheet.png')
    result=check_samples(out)
    report_status={'status':'pass','variants':len(summary['variants']),
                   'automated_validation':result,
                   'human_style_approval':'pending',
                   'limitations':report['review_required']}
    (out/'validation.json').write_text(json.dumps(report_status,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(out),'type':summary['kind'],'geometry':summary['geometry'],
                      'accent':summary['accent'],'preview':str(out/'review-sheet.png'),
                      'variants':len(summary['variants']),'requires_review':report['review_required']},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
