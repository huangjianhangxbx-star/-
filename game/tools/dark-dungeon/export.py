import json,re,struct,math,hashlib,pathlib,collections
import numpy as np
OUT=pathlib.Path(__file__).resolve().parents[3]/'work/T-018/map'
OUT.mkdir(parents=True,exist_ok=True)
ROOT=pathlib.Path(r'E:\WORLDCREATOR\new\Project_ANKALUTE')
ART=pathlib.Path(r'E:\WORLDCREATOR\XingHaiHuiLang\Origin\art\体素渲染验证\暗牢材质家族-v1')
SCENE=ROOT/'Assets/Scenes/XingHaiHuiLang/SC_DarkDungeon_Exploration.unity'
source=SCENE.read_text(encoding='utf-8-sig')
parts=re.split(r'^--- !u!(\d+) &(-?\d+)(?: stripped)?\s*$',source,flags=re.M)
docs={parts[i+1]:(int(parts[i]),parts[i+2]) for i in range(1,len(parts),3)}
def field(s,n,default=None):
 m=re.search(r'^  +'+re.escape(n)+r': (.*)$',s,re.M)
 return m[1] if m else default
def vec(s,n,d):
 v=field(s,n)
 return [float(x) for x in re.findall(r': ([-+\d.eE]+)',v)] if v else d
def ref(s,n):
 v=field(s,n,'{fileID: 0}')
 return re.search(r'fileID: (-?\d+)',v)[1]
def name(s):
 v=field(s,'m_Name','')
 return json.loads(v) if v.startswith('"') else v
def qm(q):
 x,y,z,w=np.array(q)/np.linalg.norm(q)
 return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
trans={i:s for i,(t,s) in docs.items() if t==4 and 'm_LocalPosition' in s}
def world(i):
 if i=='0':return np.eye(4)
 s=trans[i];m=np.eye(4);m[:3,:3]=qm(vec(s,'m_LocalRotation',[0,0,0,1]))@np.diag(vec(s,'m_LocalScale',[1,1,1]));m[:3,3]=vec(s,'m_LocalPosition',[0,0,0]);return world(ref(s,'m_Father'))@m
native=json.loads(json.loads((OUT/'native-models.json').read_text(encoding='utf-8-sig'))['result']['content'][0]['text'])['data']['returnValue']
modelinfo={m['name']:m for m in native['models']}
def glb(asset):
 b=(ART/'exports/assets'/f'{asset}.glb').read_bytes();jl=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+jl]);bin=b[28+jl:]
 def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']];n={'VEC3':3,'VEC2':2,'SCALAR':1}[a['type']];return np.frombuffer(bin,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape((-1,n))
 ps=[]
 for mesh in j['meshes']:
  for p in mesh['primitives']:
   v=acc(p['attributes']['POSITION']);idx=acc(p['indices']).flatten();ps.append(v[idx].reshape((-1,3,3)))
 return np.concatenate(ps)
geos={a:glb(a) for a in modelinfo}
instances=[];floor=[];obstacles=[]
for ident,(typ,s) in docs.items():
 if typ!=1001:continue
 mods={k:v for k,v in re.findall(r'propertyPath: (\S+)\n      value: ([^\n]*)',s)}
 asset=mods.get('m_Name','').strip()
 if asset not in modelinfo:
  # Some corridor instances retain source names rather than overriding m_Name.
  guid=re.search(r'm_SourcePrefab: .*guid: (\w+)',s)
  if guid:
   peers=[v for _,(t,v) in docs.items() if t==1001 and ('guid: '+guid[1]) in v and 'propertyPath: m_Name' in v]
   if peers:
    found=re.search(r'propertyPath: m_Name\n      value: ([^\n]*)',peers[0]);asset=found[1].strip() if found else ''
 if asset not in modelinfo:continue
 p=[float(mods.get('m_LocalPosition.'+k,0)) for k in 'xyz'];q=[float(mods.get('m_LocalRotation.'+k,1 if k=='w' else 0)) for k in 'xyzw'];sc=[float(mods.get('m_LocalScale.'+k,1)) for k in 'xyz']
 local=np.eye(4);local[:3,:3]=qm(q)@np.diag(sc)@qm(modelinfo[asset]['q']).T@np.diag([-1,1,1]);local[:3,3]=p
 matrix=world(ref(s,'m_TransformParent'))@local
 # Unity collider presence is read from this prefab instance's added components.
 colliders=[aid for aid in re.findall(r'addedObject: \{fileID: (-?\d+)\}',s) if docs.get(aid,(0,''))[0]==64]
 tris=geos[asset]@matrix[:3,:3].T+matrix[:3,3]
 bounds=[tris.reshape(-1,3).min(axis=0).tolist(),tris.reshape(-1,3).max(axis=0).tolist()]
 instances.append({'id':ident,'asset':asset,'matrix':[round(float(v),7) for v in matrix.T.flatten()],'collider':bool(colliders),'bounds':bounds})
 if asset in ['FLOOR_A','FLOOR_B','FLOOR_C']:floor.append(bounds)
 elif colliders:
  # Only body-height solid triangles obstruct a 0.3m-radius web walker.
  selected=tris[(tris[:,:,1].max(axis=1)>.32)&(tris[:,:,1].min(axis=1)<1.8)]
  if len(selected):obstacles.append(selected)
mins=np.floor(np.min([v[0] for v in floor],axis=0)+1e-4);maxs=np.ceil(np.max([v[1] for v in floor],axis=0)-1e-4)
width,height=int(maxs[0]-mins[0]),int(maxs[2]-mins[2]);origin=[float(mins[0]+.5),float(mins[2]+.5)]
walk=np.zeros((height,width),dtype=bool)
for lo,hi in floor:
 for y in range(max(0,int(round(lo[2]-mins[2]))),min(height,int(round(hi[2]-mins[2])))):
  for x in range(max(0,int(round(lo[0]-mins[0]))),min(width,int(round(hi[0]-mins[0])))):walk[y,x]=True
floorwalk=walk.copy()
def distance_segment(p,a,b):
 d=b-a;t=np.clip(np.sum((p-a)*d,axis=-1)/np.maximum(1e-12,np.sum(d*d,axis=-1)),0,1);return np.linalg.norm(p-a-t[:,None]*d,axis=-1)
for tris in obstacles:
 pts=tris[:,:,[0,2]];lo=pts.reshape(-1,2).min(0)-.3;hi=pts.reshape(-1,2).max(0)+.3
 for y in range(max(0,math.ceil(lo[1]-origin[1])),min(height,math.floor(hi[1]-origin[1])+1)):
  for x in range(max(0,math.ceil(lo[0]-origin[0])),min(width,math.floor(hi[0]-origin[0])+1)):
   if not walk[y,x]:continue
   p=np.array([origin[0]+x,origin[1]+y]);a,b,c=pts[:,0],pts[:,1],pts[:,2]
   cross=lambda u,v:u[:,0]*v[:,1]-u[:,1]*v[:,0]
   cs=[cross(b-a,p-a),cross(c-b,p-b),cross(a-c,p-c)];area=np.abs(cross(b-a,c-a));inside=(area>1e-8)&(((cs[0]>=0)&(cs[1]>=0)&(cs[2]>=0))|((cs[0]<=0)&(cs[1]<=0)&(cs[2]<=0)))
   near=np.minimum.reduce([distance_segment(p,a,b),distance_segment(p,b,c),distance_segment(p,c,a)])<=.3
   if np.any(inside|near):walk[y,x]=False
rooms=[]
for ident,s in trans.items():
 parent=ref(s,'m_Father')
 if parent not in trans:continue
 pname=name(docs[ref(trans[parent],'m_GameObject')][1])
 if pname.startswith('04_'):
  p=world(ident)[:3,3];rooms.append({'name':name(docs[ref(s,'m_GameObject')][1]),'x':round(float(p[0]-origin[0]),4),'y':round(float(p[2]-origin[1]),4)})
rooms.sort(key=lambda r:r['name'])
def nearest(x,y):return min([(int(xx),int(yy)) for yy,xx in np.argwhere(walk)],key=lambda v:(v[0]-x)**2+(v[1]-y)**2)
entry=nearest(rooms[0]['x'],rooms[0]['y']);seen={entry};q=collections.deque([entry])
while q:
 x,y=q.popleft()
 for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
  p=(x+dx,y+dy)
  if 0<=p[0]<width and 0<=p[1]<height and walk[p[1],p[0]] and p not in seen:seen.add(p);q.append(p)
for r in rooms:r['nearest']=list(nearest(r['x'],r['y']));r['reachable']=tuple(r['nearest']) in seen
result={'version':1,'scene':str(SCENE),'sceneSha256':hashlib.sha256(SCENE.read_bytes()).hexdigest(),'units':'1 Unity metre = 1 game U','origin':origin,'width':width,'height':height,'instances':instances,'rooms':rooms,'entry':list(entry),'walkable':[list(p) for p in sorted(seen,key=lambda p:(p[1],p[0]))],'floorCells':int(floorwalk.sum()),'navigationMethod':'1m cell centres on original floors, body-height original MeshCollider triangles inflated by 0.3m; only entrance-connected component. Offline approximation, not Unity NavMesh export.','unreachableRooms':[r['name'] for r in rooms if not r['reachable']]}
(OUT/'map.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({k:v for k,v in result.items() if k not in ['instances','walkable']},ensure_ascii=False));print('instances',len(instances),'walkable',len(seen),'total',int(walk.sum()),'assets',len({i['asset'] for i in instances}))
