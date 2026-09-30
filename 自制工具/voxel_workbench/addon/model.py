"""Context-free, bounded workbench geometry and recipe validation."""
import math
import re
from dataclasses import dataclass, field, asdict
from itertools import product

MAX_INSTANCES = 20000
ID = re.compile(r'^[A-Za-z0-9_.-]{1,100}$')


def boxes_overlap(a,b,epsilon=1e-5):
    return all(min(a[1][i],b[1][i])-max(a[0][i],b[0][i])>epsilon for i in range(3))


def spaced_cells(cells,footprint,origin):
    return list(dict.fromkeys(tuple(origin[i]+snap((c[i]-origin[i])/max(1,footprint[i]),1)*max(1,footprint[i]) for i in range(3)) for c in cells))


def identifier(value):
    if not isinstance(value, str) or not ID.fullmatch(value):
        raise ValueError('Invalid stable identifier')
    return value


def srgb_to_linear(value):
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def snap(value, step):
    if not math.isfinite(value) or not math.isfinite(step) or step <= 0:
        raise ValueError('Invalid grid coordinate')
    return int(math.copysign(math.floor(abs(value / step) + .5), value))


def stroke_cells(start, end):
    delta = [b-a for a,b in zip(start,end)]
    count = max(abs(x) for x in delta)
    if count > MAX_INSTANCES: raise ValueError('Stroke too long')
    return list(dict.fromkeys(tuple(snap(a+d*i/max(1,count),1) for a,d in zip(start,delta)) for i in range(count+1)))


def anchor_offset(size, anchor='bottom', custom=(0,0,0)):
    offsets = {'center':(0,0,0), 'bottom':(0,0,size[2]/2),
               'x+':(-size[0]/2,0,0), 'x-':(size[0]/2,0,0),
               'y+':(0,-size[1]/2,0), 'y-':(0,size[1]/2,0),
               'z+':(0,0,-size[2]/2), 'z-':(0,0,size[2]/2),
               'custom':tuple(-v for v in custom)}
    if anchor not in offsets: raise ValueError('Unknown anchor')
    return offsets[anchor]


@dataclass
class Profile:
    id: str = 'project.demo'
    revision: int = 1
    unit: str = 'METERS'
    grid_step: float = .25
    size_step: float = .25
    grid_origin: list = field(default_factory=lambda: [0,0,0])
    rotation_step: int = 90
    palette: dict = field(default_factory=lambda: {
        'stone.base': {'color':[.57,.59,.55,1], 'roughness':.85},
        'stone.light': {'color':[.73,.72,.62,1], 'roughness':.85},
        'stone.dark': {'color':[.28,.34,.35,1], 'roughness':.9},
        'leaf.dry': {'color':[.72,.43,.13,1], 'roughness':.9},
        'leaf.green': {'color':[.19,.37,.29,1], 'roughness':.9},
        'wood': {'color':[.27,.19,.12,1], 'roughness':.9},
        'signal': {'color':[.15,.75,.8,1], 'roughness':.4, 'emission':1},
    })
    templates: dict = field(default_factory=lambda: {
        'base.cube': {'kind':'box','size_cells':[4,4,4],'anchor':'bottom'},
        'base.panel': {'kind':'box','size_cells':[4,4,1],'anchor':'bottom'},
        'base.plane': {'kind':'plane','size_cells':[4,4,0],'anchor':'bottom'},
    })

    def to_dict(self): return asdict(self)

    def __post_init__(self):
        identifier(self.id)
        if type(self.revision) is not int or self.revision<1: raise ValueError('Invalid profile revision')
        for value in (self.grid_step,self.size_step):
            if not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0: raise ValueError('Invalid profile step')
        if self.rotation_step not in (90,180): raise ValueError('Only axis-aligned rotations supported')
        vector(self.grid_origin)
        for key,spec in self.palette.items():
            identifier(key)
            if len(spec.get('color',[]))!=4 or any(not math.isfinite(x) or x<0 or x>1 for x in spec['color']): raise ValueError('Invalid palette RGBA')


def strict(data, allowed, required=()):
    if not isinstance(data, dict): raise ValueError('Expected object')
    if set(data)-set(allowed): raise ValueError('Unknown fields: '+str(set(data)-set(allowed)))
    if set(required)-set(data): raise ValueError('Missing fields: '+str(set(required)-set(data)))


def vector(value, integer=False):
    if not isinstance(value,(list,tuple)) or len(value)!=3: raise ValueError('Expected 3-vector')
    if any(isinstance(v,bool) or not isinstance(v,(float,int)) or not math.isfinite(v) or abs(v)>1000000 for v in value):
        raise ValueError('Invalid vector')
    if integer and any(int(v)!=v for v in value): raise ValueError('Expected integer cells')
    return list(value)


def expand_recipe(recipe, profile):
    fields = ('schema_version','request_id','asset_id','expected_revision','profile_id','profile_revision','operations')
    strict(recipe, fields, fields)
    for key in ('request_id','asset_id'): identifier(recipe[key])
    if recipe['schema_version']!='0.1': raise ValueError('Unsupported schema')
    if recipe['profile_id']!=profile.id or recipe['profile_revision']!=profile.revision: raise ValueError('Profile mismatch')
    if type(recipe['expected_revision']) is not int or recipe['expected_revision']<0: raise ValueError('Invalid revision')
    if not isinstance(recipe['operations'],list) or len(recipe['operations'])>2000: raise ValueError('Too many operations')
    output=[]
    for op in recipe['operations']:
        kind=op.get('op')
        if kind in ('delete','paint','transform'):
            allowed={'delete':('op','id'), 'paint':('op','id','color_id','faces'),
                     'transform':('op','id','position_cells','rotation','mirror')}[kind]
            strict(op,allowed,('op','id'))
            identifier(op['id'])
            if kind=='paint' and op.get('color_id') not in profile.palette: raise ValueError('Unknown color')
            if 'faces' in op and (not isinstance(op['faces'],list) or any(type(x) is not int or x<0 for x in op['faces'])): raise ValueError('Invalid face list')
            if 'position_cells' in op: vector(op['position_cells'],True)
            if 'rotation' in op: vector(op['rotation'],True)
            if 'mirror' in op and (len(op['mirror'])!=3 or any(type(x) is not bool for x in op['mirror'])): raise ValueError('Invalid mirror')
            output.append(dict(op)); continue
        if kind not in ('place','place_array'): raise ValueError('Unknown operation')
        allowed=('op','id','id_prefix','template_id','origin_cells','size_cells','count','spacing_cells','color_id','rotation','mirror','anchor','custom_anchor')
        strict(op,allowed,('op','template_id','color_id'))
        template=profile.templates.get(op['template_id'])
        if template is None: raise ValueError('Unknown template')
        if op['color_id'] not in profile.palette: raise ValueError('Unknown color')
        origin=vector(op.get('origin_cells',[0,0,0]),True)
        size=vector(op.get('size_cells',template['size_cells']),True)
        if min(size[:2])<=0 or size[2]<0 or (template['kind']=='box' and size[2]==0) or (template['kind']=='plane' and size[2]!=0): raise ValueError('Invalid dimensions')
        counts=vector(op.get('count',[1,1,1]),True)
        if min(counts)<=0 or math.prod(counts)+len(output)>MAX_INSTANCES: raise ValueError('Instance limit')
        spacing=vector(op.get('spacing_cells',size),True)
        rotation=vector(op.get('rotation',[0,0,0]),True)
        if any(r%profile.rotation_step for r in rotation): raise ValueError('Rotation must follow profile')
        mirror=op.get('mirror',[False]*3)
        if len(mirror)!=3 or any(type(x) is not bool for x in mirror): raise ValueError('Invalid mirror')
        anchor=op.get('anchor',template['anchor']); custom=vector(op.get('custom_anchor',[0,0,0]))
        real_size=[v*profile.grid_step for v in size]
        anchor_offset(real_size,anchor,custom)
        prefix=identifier(op.get('id' if kind=='place' else 'id_prefix','block'))
        for x,y,z in product(*(range(int(n)) for n in counts)):
            output.append({'op':'place','id':prefix if kind=='place' else f'{prefix}.{x}.{y}.{z}',
                'kind':template['kind'],'size':real_size,'position':[profile.grid_origin[i]+(origin[i]+p*spacing[i])*profile.grid_step for i,p in enumerate((x,y,z))],
                'rotation':rotation,'mirror':mirror,'anchor':anchor,'custom_anchor':custom,'color_id':op['color_id']})
    if len(output)>MAX_INSTANCES: raise ValueError('Instance limit')
    return output
