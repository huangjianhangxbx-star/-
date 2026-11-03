"""Wire projections from independently reread native mesh bounds, not artwork."""
import json
from pathlib import Path
BASE=Path('E:/WORLDCREATOR/XingHaiHuiLang/Origin/work/scene-builder-lab/asset-usage-replica')
QA=BASE/'qa/kit-B'
data=json.loads((QA/'independent-validation.json').read_text())
assets={a['role']:a for a in data['assets']}
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1900" viewBox="0 0 1500 1900">',
'<rect width="1500" height="1900" fill="#f0f3f2"/>',
'<style>text{font-family:Arial,sans-serif;fill:#263b40}.box{stroke:#397978;stroke-width:1.5;fill:none}.envelope{stroke:#bd614c;stroke-width:1.5;stroke-dasharray:6 5;fill:none}.dim{stroke:#586a70;stroke-width:1} .origin{stroke:#bd902c;stroke-width:2}</style>',
'<text x="35" y="45" font-size="27" font-weight="bold">KIT B / EXACT INTERFACE PROJECTIONS</text>',
'<text x="35" y="82" font-size="18">Wire rectangles are extracted from the delivered native box meshes. Dashed outline = fixed logical envelope.</text>',
'<text x="35" y="111" font-size="18">All values in meters. Cross = source bottom-center origin. Front = X/Z; side = Y/Z; top = X/Y.</text>']
for row,role in enumerate(['tread','deck','post','rail']):
    a=assets[role];b=a['nativeBounds'];y0=150+row*420
    svg.append(f'<text x="35" y="{y0+20}" font-size="23" font-weight="bold">{role.upper()}</text>')
    for col,(title,haxis,vaxis) in enumerate([('FRONT',0,2),('SIDE / NOSE -X',1,2),('TOP',0,1)]):
        x0=35+col*495;cx=x0+205;cy=y0+215
        width=b['max'][haxis]-b['min'][haxis];height=b['max'][vaxis]-b['min'][vaxis]
        scale=285/max(width,height)
        midh=(b['min'][haxis]+b['max'][haxis])/2;midv=(b['min'][vaxis]+b['max'][vaxis])/2
        def p(h,v):return (cx+(h-midh)*scale,cy-(v-midv)*scale)
        svg.append(f'<text x="{x0}" y="{y0+50}" font-size="18">{title}</text>')
        def rect(bb,cls):
            x,y=p(bb['min'][haxis],bb['max'][vaxis])
            w=(bb['max'][haxis]-bb['min'][haxis])*scale;h=(bb['max'][vaxis]-bb['min'][vaxis])*scale
            return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="{cls}"/>'
        for bb in a['nativeBoxesForMeasuredDiagrams']:svg.append(rect(bb,'box'))
        svg.append(rect(b,'envelope'))
        ox,oy=p(0,0);svg.append(f'<path d="M {ox-6},{oy} h 12 M {ox},{oy-6} v 12" class="origin"/>')
        left,bottom=p(b['min'][haxis],b['min'][vaxis]);right,top=p(b['max'][haxis],b['max'][vaxis])
        yy=bottom+22;xx=right+22
        svg.append(f'<path d="M {left},{bottom+8} V {yy+5} M {left},{yy} H {right} M {right},{bottom+8} V {yy+5}" class="dim"/>')
        svg.append(f'<text x="{(left+right)/2}" y="{yy+24}" font-size="17" text-anchor="middle">{width:g} m</text>')
        svg.append(f'<path d="M {right+8},{top} H {xx+5} M {xx},{top} V {bottom} M {right+8},{bottom} H {xx+5}" class="dim"/>')
        svg.append(f'<text x="{xx+8}" y="{(top+bottom)/2+5}" font-size="17">{height:g}</text>')
    notes={'tread':'Top at Z 0.25; lower heel X [-0.125, +0.25]; nose overhang toward -X = 0.125.',
           'deck':'Top fully covers X/Y [-0.25,+0.25]; recessed bearing = 0.25 x 0.25 x 0.125.',
           'post':'Foot and capital width 0.25; shaft width 0.125; belt Z [0.5,0.625]; capital top Z 1.25.',
           'rail':'Clear windows X [-0.125,+0.125], Z [0.125,0.375] and [0.5,0.875]; thickness 0.125.'}
    svg.append(f'<text x="35" y="{y0+407}" font-size="16">{notes[role]}</text>')
svg.append('<text x="35" y="1870" font-size="17">Native Blender Z up. Contract logical coordinates: (X,Y,Z) = (native X, native Z, width); source Y is symmetric.</text></svg>')
(QA/'measured-interfaces.svg').write_text('\n'.join(svg),encoding='utf-8')
print('Measured SVG generated from independent native validation')
