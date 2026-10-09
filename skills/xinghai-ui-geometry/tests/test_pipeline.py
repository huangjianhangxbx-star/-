import json, hashlib, sys
from pathlib import Path
import pytest
import numpy as np
from PIL import Image, ImageDraw

SCRIPTS=Path(__file__).resolve().parents[1]/'scripts'
sys.path.insert(0,str(SCRIPTS))
from analyze_reference import analyze, parse_crop
from render_variants import save_variants
from validate_exports import check_samples


def build_png(tmp_path,name,shape='square'):
    f=tmp_path/name
    im=Image.new('RGB',(300,300),'white');d=ImageDraw.Draw(im)
    if shape=='square': d.rectangle((34,34,266,266),fill=(22,23,25))
    elif shape=='diamond':d.polygon([(150,18),(282,150),(150,282),(18,150)],fill=(21,22,25))
    im.save(f)
    return f


def sample_analysis(tmp_path,kind='skill_slot',shape='square',accent='#C31935'):
    file=build_png(tmp_path,'ref.png',shape)
    return analyze(file,kind=kind,shape=shape,accent=accent)


def test_crop_rejects_invalid():
    with pytest.raises(ValueError):parse_crop('2,2,999,2',(10,10))
    with pytest.raises(ValueError):parse_crop('1,2,3',(10,10))


def test_rgb_reference_not_considered_alpha(tmp_path):
    analysis=analyze(build_png(tmp_path,'ref.png'),kind='skill_slot')
    assert analysis['observations']['has_detectable_alpha'] is False
    assert any('no alpha' in s for s in analysis['review_required'])
    assert analysis['approval_status']=='draft_not_user_approved'


def test_isolated_square_shape(tmp_path):
    a=analyze(build_png(tmp_path,'square.png'),kind='skill_slot')
    assert a['interpretation']['geometry']=='square'


def test_isolated_diamond_shape(tmp_path):
    a=analyze(build_png(tmp_path,'diamond.png','diamond'),kind='skill_slot')
    assert a['interpretation']['geometry']=='diamond'


def test_auto_blood_fill_color_and_fraction(tmp_path):
    im=Image.new('RGB',(800,40),'#080A0D');d=ImageDraw.Draw(im)
    d.rectangle((2,9,797,31),fill='#191B20')
    d.rectangle((7,12,546,29),fill=(236,19,26))
    file=tmp_path/'bar.png';im.save(file)
    a=analyze(file)
    assert a['interpretation']['target_type']=='health_bar'
    assert a['interpretation']['geometry']=='rectangle'
    assert a['observations']['geometry_measurements']['color_channel']=='red'
    assert .63<a['observations']['geometry_measurements']['fill_ratio_candidate']<.75


def test_same_color_and_geometry_all_five(tmp_path):
    a=sample_analysis(tmp_path)
    m=save_variants(a,tmp_path/'out',count=5)
    assert m['geometry']=='square'
    assert len(m['variants'])==5
    for v in m['variants']:
        md=json.loads((tmp_path/'out'/v/'metadata.json').read_text())
        assert md['metrics']['accent']=='#C31935'
        assert md['metrics']['shape']=='square'
    # The five variants share the same kind, geometry and accent by contract.


def test_checks_one_asset(tmp_path):
    a=sample_analysis(tmp_path)
    save_variants(a,tmp_path/'group'/'slots',count=5)
    validation=check_samples(tmp_path/'group')
    assert validation[0]['variants']==5
    assert validation[0]['status']=='pass'


def test_deterministic_byte_identical_preview(tmp_path):
    a=sample_analysis(tmp_path)
    save_variants(a,tmp_path/'a',count=3)
    save_variants(a,tmp_path/'b',count=3)
    rel='v01-standard/preview.png'
    assert (tmp_path/'a'/rel).read_bytes()==(tmp_path/'b'/rel).read_bytes()


def test_circle_center_transparent(tmp_path):
    a=sample_analysis(tmp_path,kind='portrait_frame',shape='circle')
    save_variants(a,tmp_path/'a',count=5)
    im=Image.open(tmp_path/'a'/'v01-plain-ring'/'preview.png')
    assert im.mode=='RGBA'
    assert im.getpixel((256,256))[3]==0
    assert im.getpixel((256,26))[3]!=0


def test_bar_exports_reusable_full_fill_layer(tmp_path):
    im=Image.new('RGB',(900,35),'black');d=ImageDraw.Draw(im)
    d.rectangle((4,10,600,29),fill=(245,21,21))
    path=tmp_path/'bar.png';im.save(path)
    a=analyze(path)
    save_variants(a,tmp_path/'out',count=3)
    preview=Image.open(tmp_path/'out'/'v01-plain'/'preview.png')
    full=Image.open(tmp_path/'out'/'v01-plain'/'fill_full.png')
    assert full.size==preview.size==(1024,96)
    assert np.count_nonzero(np.array(full)[:,:,3]>100)>np.count_nonzero(np.array(Image.open(tmp_path/'out'/'v01-plain'/'fill_76pct.png'))[:,:,3]>100)


def test_unresolved_shape_blocks_generation(tmp_path):
    a=sample_analysis(tmp_path)
    a['interpretation']['geometry']='unknown'
    with pytest.raises(ValueError,match='shape unresolved'):
        save_variants(a,tmp_path/'out')


def test_invalid_count_rejected(tmp_path):
    a=sample_analysis(tmp_path)
    with pytest.raises(ValueError):save_variants(a,tmp_path/'out',count=6)
