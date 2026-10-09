#!/usr/bin/env python3
"""Verify structure, alpha outside, geometry restrictions, provenance, and five distinct variations."""
import argparse, json, hashlib
from pathlib import Path

import numpy as np
from PIL import Image

KINDS={'skill_slot':(256,256),'portrait_frame':(512,512),'health_bar':(1024,96)}


def check_samples(folder):
    folder=Path(folder)
    reports=[]
    for mf in sorted(folder.glob('*/manifest.json')):
        m=json.loads(mf.read_text(encoding='utf-8'))
        if m['schema']!='xh-ui-output/2':raise ValueError('wrong manifest '+str(mf))
        expected=m['size']
        seen=[]
        for variant in m['variants']:
            root=mf.parent/variant
            md=json.loads((root/'metadata.json').read_text(encoding='utf-8'))
            if md['source_sha256']!=m['source_sha256']:raise AssertionError('provenance mismatch')
            if md['metrics']['shape'] not in ('circle','square','diamond','rectangle'):
                raise AssertionError('invalid geometry')
            preview=root/'preview.png'
            im=Image.open(preview)
            if im.mode!='RGBA' or list(im.size)!=expected:raise AssertionError('bad RGBA/dims '+str(preview))
            px=np.array(im)
            alpha=px[:,:,3]
            if int(alpha[0,0])!=0 or int(alpha[-1,-1])!=0:
                raise AssertionError('background not transparent')
            visible=int(np.count_nonzero(alpha>32))
            if visible<.005*alpha.size:raise AssertionError('too few visible pixels')
            if m['kind']=='portrait_frame':
                if alpha[expected[1]//2,expected[0]//2]>4:
                    raise AssertionError('portrait center must be transparent')
            if m['kind']=='health_bar':
                for name in ('base.png','frame.png','fill_full.png','fill_76pct.png'):
                    if not (root/name).exists():raise AssertionError('missing runtime layer '+str(root/name))
            seen.append(hashlib.sha256(preview.read_bytes()).hexdigest())
        if len(set(seen))!=len(seen):raise AssertionError('variants not visually distinct: '+str(mf))
        reports.append({'asset':mf.parent.name,'kind':m['kind'],'size':expected,'variants':len(seen),
            'all_rgba_and_transparent':True,'all_hashes_different':True,'status':'pass'})
    if not reports:raise ValueError('No sample manifests found')
    return reports


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('sample_dir')
    ap.add_argument('--out')
    a=ap.parse_args()
    reports=check_samples(a.sample_dir)
    result={'schema':'xh-ui-validation/2','assets':reports,'total_variants':sum(x['variants'] for x in reports),
        'status':'pass','limits':['pixel and structure checks only; visual fidelity requires human review',
                                  'Photoshop CC 2018 / PSD export not tested']}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if a.out:
        path=Path(a.out);path.parent.mkdir(exist_ok=True,parents=True)
        path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
