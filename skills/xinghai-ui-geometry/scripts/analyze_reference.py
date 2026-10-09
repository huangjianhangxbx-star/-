#!/usr/bin/env python3
"""Reproducible coarse measurements of a *selected region* of a UI reference.

No ML / remote calls. Reports observations, heuristics and review flags separately.
User/AI must approve the interpretation before exact replication is claimed.
"""
import argparse, hashlib, json, math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

SCHEMA = 'xh-ui-reference/2'
TYPES = ('auto','skill_slot','portrait_frame','health_bar')


def parse_crop(raw, size):
    w,h=size
    if not raw:
        return [0,0,w,h]
    try:
        x,y,cw,ch=[int(a.strip()) for a in raw.split(',')]
    except ValueError:
        raise ValueError('crop must be x,y,width,height (four integers)')
    if cw<=0 or ch<=0 or x<0 or y<0 or x+cw>w or y+ch>h:
        raise ValueError(f'crop {raw} outside image {w}x{h}')
    return [x,y,cw,ch]


def color_hex(rgb):
    return '#'+''.join(f'{int(round(v)):02X}' for v in rgb[:3])


def rgb_palette(rgb):
    x=rgb.reshape(-1,3).astype(np.float32)
    # Thin out large or small input equally; quantized histogram is stable.
    if len(x)>160000:
        step=int(math.ceil(len(x)/160000))
        x=x[::step]
    vmax=x.max(axis=1)
    vmin=x.min(axis=1)
    sat=(vmax-vmin)/np.maximum(vmax,1)
    neutral=(sat<.17)&(vmax>42)&(vmax<228)
    vivid=(sat>.26)&(vmax>55)&(vmax<=255)
    def groups(mask, q=24):
        arr=x[mask]
        if len(arr)<max(20, len(x)*.0008):
            return []
        bins=np.clip(np.rint(arr/q)*q,0,255).astype(int)
        counter=Counter(map(tuple,bins))
        out=[]
        for rgb_,num in counter.most_common(4):
            out.append({'color':color_hex(rgb_),'share_of_mask':round(num/len(arr),3)})
        return out
    return {
        'neutral_midtones': groups(neutral),
        'saturated_accents': groups(vivid),
        'saturated_sample_fraction':round(float(vivid.mean()),4),
        'neutral_sample_fraction':round(float(neutral.mean()),4),
    }


def connected_regions(mask):
    # Optional cv2 only for region proposals; absence doesn't affect analysis.
    try:
        import cv2
    except ImportError:
        return [], 'cv2 unavailable; component detection skipped'
    binary=(mask.astype(np.uint8)*255)
    count, labels, stats, centroids=cv2.connectedComponentsWithStats(binary,8)
    total=mask.size
    objs=[]
    for i in range(1,count):
        x,y,w,h,area=[int(v) for v in stats[i]]
        if area<max(20,total*.0018):continue
        objs.append({'bbox':[x,y,w,h],'foreground_pixels':area,'coverage':round(area/total,3)})
    objs.sort(key=lambda a: a['foreground_pixels'],reverse=True)
    return objs[:8], None


def analyze(path, crop=None, kind='auto', shape='auto', accent=None, border_style='flat', ref_role='shape'):
    img=Image.open(path)
    rgba=img.convert('RGBA')
    crop=parse_crop(crop,rgba.size)
    x0,y0,w,h=crop
    im=rgba.crop((x0,y0,x0+w,y0+h))
    rgba_arr=np.asarray(im,dtype=np.uint8)
    rgb=rgba_arr[:,:,:3].copy()
    alpha=rgba_arr[:,:,3]
    # Determine approximate uniform background from a few corner neighborhoods.
    corner=max(2,min(14,w//15,h//15))
    neighborhoods=np.concatenate([
        rgb[:corner,:corner].reshape(-1,3),rgb[:corner,-corner:].reshape(-1,3),
        rgb[-corner:,:corner].reshape(-1,3),rgb[-corner:,-corner:].reshape(-1,3)],axis=0)
    bg=np.median(neighborhoods,axis=0).astype(int)
    has_alpha=bool(np.any(alpha<248))
    if has_alpha:
        fg=alpha>55
    else:
        fg=np.max(np.abs(rgb.astype(np.int16)-bg),axis=2)>24
    regions,region_problem=connected_regions(fg)
    if regions:
        target=regions[0]
        bx,by,bw,bh=target['bbox']
    else:
        bx,by,bw,bh=(0,0,w,h)
    coverage=float(fg.sum())/max(1,w*h)
    aspect=round(w/max(1,h),3)
    box_aspect=round(bw/max(1,bh),3)
    if kind!='auto':
        effective=kind; type_basis='explicit-operator-input (requires visual review)'
    else:
        if aspect>=4:
            effective='health_bar';type_basis='aspect-ratio heuristic'
        elif max(box_aspect,1/box_aspect)>2.4:
            effective='health_bar';type_basis='foreground-bounds heuristic'
        else:
            effective='unclassified';type_basis='ambiguous square-ish region; manual target required'
    geom='unknown';geom_basis='unresolved'
    if shape!='auto':
        geom=shape;geom_basis='explicit-operator-input (requires visual review)'
    elif effective=='health_bar':
        geom='rectangle';geom_basis='type-based'
    elif effective=='portrait_frame':
        geom='circle';geom_basis='user-specified type; circular rim not automatically validated'
    elif effective=='skill_slot':
        if abs(box_aspect-1)<.2 and bg.mean()>222 and regions:
            fill_ratio=regions[0]['foreground_pixels']/max(1,bw*bh)
            if fill_ratio<.69:
                geom='diamond';geom_basis='foreground occupancy heuristic'
            elif fill_ratio>.80:
                geom='square';geom_basis='foreground occupancy heuristic'
    palette=rgb_palette(rgb)
    measurements={'crop_width':w,'crop_height':h,'foreground_bounds_xywh':[bx,by,bw,bh]}
    if effective=='health_bar' and w/max(1,h)>3.0:
        # Identify chromatic fill's dominant RGB channel, not a green-tinted shadow below it.
        arr=rgb.astype(np.int16)
        scores=[]
        for j in range(3):
            others=np.delete(arr,j,axis=2)
            sat_mask=(arr[:,:,j]>115)&(arr[:,:,j] > others.max(axis=2)+38)
            scores.append((int(sat_mask.sum()),j,sat_mask))
        scores.sort(reverse=True, key=lambda t:t[0])
        n,channel,fill_mask=scores[0]
        if n > w*h*.045:
            dominant=np.median(rgb[fill_mask].reshape(-1,3),axis=0)
            # Exclude anti-aliased fringe by using columns with 10% or more strong color.
            cols=np.flatnonzero(fill_mask.sum(axis=0)>=max(2,int(h*.10)))
            if len(cols)>=2:
                first,last=int(cols.min()),int(cols.max())
                # Normalization by crop span; isolated bar references should contain full track.
                frac=(last-first+1)/w
                measurements.update({'fill_ratio_candidate':round(frac,4),
                                     'fill_candidate_color':color_hex(dominant),
                                     'color_channel':['red','green','blue'][channel],
                                     'color_coverage_fraction':round(n/(w*h),4),
                                     'fill_estimation_basis':'dominant channel mask over reference crop width'})
    review=[]
    if len(regions)>1 and regions[1]['foreground_pixels']>.25*regions[0]['foreground_pixels']:
        review.append('Multiple significant foreground groups: crop a single target before treating this as an isolated asset.')
    if region_problem:review.append(region_problem)
    if not has_alpha:review.append('Reference has no alpha; a white/black screenshot background is NOT evidence of transparency.')
    if effective=='unclassified':review.append('Reference type uncertain. Supply --type; never treat the automatic guess as design approval.')
    if geom_basis not in ('explicit-operator-input (requires visual review)','type-based'):
        review.append('Frame geometry is an approximate heuristic, not a validated exact vector trace.')
    if effective=='portrait_frame':
        review.append('Character/illustration pixels may distort color sampling. Prefer a separate frame crop or explicitly choose border color.')
    if effective=='health_bar':
        review.append('The saturated color is likely the FILL color; it does not demonstrate the desired border color.')
    if accent is not None:
        if len(accent)!=7 or accent[0]!='#' or any(c not in '0123456789ABCDEFabcdef' for c in accent[1:]):
            raise ValueError('accent must be #RRGGBB')
    candidate=(measurements.get('fill_candidate_color') or (palette['saturated_accents'][0]['color'] if palette['saturated_accents'] else None))
    neutral=(palette['neutral_midtones'][0]['color'] if palette['neutral_midtones'] else '#777777')
    suggested_accent=accent or (candidate if effective=='health_bar' else neutral)
    out={
        'schema':SCHEMA,
        'source':{'filename':Path(path).name,'sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),
                  'size':list(rgba.size),'pixel_mode':img.mode,'selected_region':crop,
                  'reference_role':ref_role},
        'observations':{'region_aspect_ratio':aspect,'crop_corner_background_rgb':bg.tolist(),
            'has_detectable_alpha':has_alpha,'estimated_foreground_coverage':round(coverage,4),
            'candidate_components':regions,'palette':palette,'geometry_measurements':measurements},
        'interpretation':{'target_type':effective,'type_basis':type_basis,
            'geometry':geom,'geometry_basis':geom_basis,
            'candidate_accent':suggested_accent,'accent_origin':('explicit-override' if accent else 'heuristic-palette'),
            'color_application_warning':'Do not treat an observed icon/character color as a confirmed border color.',
            'proposed_style':border_style},
        'style_hard_constraints':{
            'base':'solid black or near-black', 'border':'flat solid accent color, thin',
            'geometry':'simple geometric outline','lighting':'none','ornaments':'none',
            'materials':'no metallic effects, no cracks, no gradients',
            'outside_alpha':0},
        'review_required':review,
        'approval_status':'draft_not_user_approved'
    }
    return out


def write_report(report, path):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return path


def main():
    p=argparse.ArgumentParser(description='Coarse observable reference analysis, not magical semantic vision')
    p.add_argument('--input',required=True)
    p.add_argument('--type',choices=TYPES,default='auto')
    p.add_argument('--shape',choices=('auto','square','diamond','circle','rectangle'),default='auto')
    p.add_argument('--crop',help='x,y,width,height; selecting the object matters for screenshots')
    p.add_argument('--accent',help='manual approved or candidate #RRGGBB; does not indicate approval by itself')
    p.add_argument('--role',choices=('shape','style','both'),default='shape')
    p.add_argument('--out',required=True)
    a=p.parse_args()
    result=analyze(a.input,a.crop,a.type,a.shape,a.accent,ref_role=a.role)
    write_report(result,a.out)
    print(json.dumps({'report':a.out,'type':result['interpretation']['target_type'],
                      'shape':result['interpretation']['geometry'],
                      'accent':result['interpretation']['candidate_accent'],
                      'review_flags':result['review_required']},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
