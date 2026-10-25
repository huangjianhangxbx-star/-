import type {AssetDocument, Cell} from './workshop-documents.ts';
import type {ModelCanvas} from './workshop-canvases.ts';
import type {SurfacePixel} from './paint-surface-domain.ts';

export type StructureEdge={axis:number;start:[number,number,number];end:[number,number,number];faces:[number,number]};
export type StructureDiagnostics={ambiguous:number;nonManifold:number;overlapping:number;concave:number;flat:number;segments:number;cells:number};
type Point=[number,number,number];
type Box={id:string;min:Point;max:Point;canvasId:string;cell:Cell};
type Line={axis:number;fixed:Point;intervals:[number,number][]};
const axes=(axis:number)=>[0,1,2].filter(a=>a!==axis);
const key=(c:Pick<Cell,'x'|'y'|'z'>)=>`${c.x},${c.y},${c.z}`;
const MAX_BOXES=250000, MAX_NATIVE_EDGES=2000000, MAX_LINES=600000, MAX_SEGMENTS=1000000, MAX_WORK=30000000;

/** Native boxes stay native: only local edge intervals are subdivided at contact breakpoints. */
export class StructureEdgeDomain{
 readonly canvasId:string;
 readonly objectId:string;
 readonly revision:number;
 readonly geometry:'asset'|'target';
 readonly n:number;
 readonly origin:Point;
 readonly allowed:ReadonlySet<string>;
 readonly edges:StructureEdge[]=[];
 readonly diagnostics:StructureDiagnostics={ambiguous:0,nonManifold:0,overlapping:0,concave:0,flat:0,segments:0,cells:0};
 readonly fingerprint:string;
 private readonly cells:Map<string,Cell>;
 private readonly palette:readonly string[];
 private readonly sideColor:number|undefined;
 private readonly buckets=new Map<string,Box[]>();
 private readonly boxes:Box[]=[];
 private work=0;
 private analyzing=true;

 constructor(model:AssetDocument,objectId:string,geometry:'asset'|'target'='asset'){
  if(geometry!=='asset'&&geometry!=='target')throw Error('结构描边几何判断模式无效');
  const object=model.objects?.find(o=>o.objectId===objectId);
  if(!object||object.canvasIds.length!==1||!object.cellKeys)throw Error('结构描边需要单个原生画布上的目标物体');
  const canvas=model.canvases?.find(c=>c.canvasId===object.canvasIds[0]);
  if(!canvas||canvas.locked||!canvas.visible)throw Error('结构描边目标画布已隐藏或锁定');
  this.objectId=objectId;this.canvasId=canvas.canvasId;this.revision=model.revision;this.geometry=geometry;
  this.n=canvas.voxelStepM*64;this.origin=canvas.originTicks.map(v=>v*2) as Point;
  this.allowed=new Set(object.cellKeys);this.cells=new Map(canvas.cells.map(c=>[key(c),c]));
  this.palette=[...model.palette];this.sideColor=model.sideColor;
  if(![4,8,16].includes(this.n)||this.origin.some(v=>!Number.isSafeInteger(v)))throw Error('结构描边目标坐标无效');
  if(!this.allowed.size)throw Error('结构描边目标没有体素');
  for(const k of this.allowed)if(!this.cells.has(k))throw Error('结构描边目标包含无效体素归属');
  const inputs=geometry==='target'?[canvas]:model.canvases!;
  const signature:[string,number,number[],string[]][]=[];
  for(const c of [...inputs].sort((a,b)=>a.canvasId.localeCompare(b.canvasId))){
   const n=c.voxelStepM*64,origin=c.originTicks.map(v=>v*2);
   if(![4,8,16].includes(n)||origin.some(v=>!Number.isSafeInteger(v)))throw Error('结构描边几何坐标无效');
   const cells=geometry==='target'?c.cells.filter(v=>this.allowed.has(key(v))):c.cells;
   signature.push([c.canvasId,n,origin,cells.map(key).sort()]);
   for(const cell of cells){
    if(this.boxes.length>=MAX_BOXES)throw Error('结构描边几何超过分析体素预算');
    if(![cell.x,cell.y,cell.z].every(Number.isSafeInteger))throw Error('结构描边原生体素坐标无效');
    const min=[cell.x,cell.y,cell.z].map((v,a)=>origin[a]+v*n) as Point,max=min.map(v=>v+n) as Point;
    if([...min,...max].some(v=>!Number.isSafeInteger(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER/4))throw Error('结构描边全局坐标超过整数预算');
    const box={id:c.canvasId+':'+key(cell),min,max,canvasId:c.canvasId,cell};
    this.boxes.push(box);this.index(box);
   }
  }
  this.diagnostics.cells=this.boxes.length;
  // Geometry identity deliberately excludes paint/revision/palette/Root and view preferences.
  const ownership=(model.objects??[]).filter(o=>geometry==='asset'||o.objectId===objectId).map(o=>[o.objectId,[...o.canvasIds].sort(),[...(o.cellKeys??[])].sort()]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
  const text=JSON.stringify([geometry,objectId,canvas.canvasId,[...this.allowed].sort(),signature,ownership]);
  let h1=2166136261,h2=2246822519;
  for(let i=0;i<text.length;i++){h1=Math.imul(h1^text.charCodeAt(i),16777619);h2=Math.imul(h2^text.charCodeAt(i),3266489917);}
  this.fingerprint='structure-edge-1:'+text.length+':'+(h1>>>0).toString(16)+':'+(h2>>>0).toString(16);
  this.analyze(canvas);this.analyzing=false;
 }

 private tick(n=1){if(this.analyzing){this.work+=n;if(this.work>MAX_WORK)throw Error('结构描边几何超过局部分析预算');}}
 private index(box:Box){
  const min=box.min.map(v=>Math.floor(v/16)),max=box.max.map(v=>Math.floor((v-1)/16));
  for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
   const k=`${x},${y},${z}`,bucket=this.buckets.get(k);if(bucket)bucket.push(box);else this.buckets.set(k,[box]);
  }
 }
 /** All point queries use doubled integers. +/-1 is an exact half-texel sector sample. */
 private at(point:Point):Box[]{
  const bucket=this.buckets.get(point.map(v=>Math.floor(v/32)).join(','));if(!bucket)return [];
  this.tick(bucket.length);return bucket.filter(b=>point.every((v,a)=>v>=b.min[a]*2&&v<b.max[a]*2));
 }
 private near(min:Point,max:Point):Box[]{
  const lo=min.map(v=>Math.floor(v/16)),hi=max.map(v=>Math.floor(v/16)),seen=new Set<Box>();
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
   this.tick();for(const b of this.buckets.get(`${x},${y},${z}`)??[])seen.add(b);
  }
  this.tick(seen.size);return [...seen].filter(b=>b.min.every((v,a)=>v<=max[a]&&b.max[a]>=min[a]));
 }
 private analyze(canvas:ModelCanvas){
  const targetMin:Point=[Infinity,Infinity,Infinity],targetMax:Point=[-Infinity,-Infinity,-Infinity];
  for(const k of this.allowed){const c=this.cells.get(k)!;[c.x,c.y,c.z].forEach((v,a)=>{targetMin[a]=Math.min(targetMin[a],this.origin[a]+v*this.n-64);targetMax[a]=Math.max(targetMax[a],this.origin[a]+(v+1)*this.n+64);});}
  const lines=new Map<string,Line>();let nativeEdges=0;
  for(const b of this.boxes){
   if(b.min.some((v,a)=>v>targetMax[a]||b.max[a]<targetMin[a]))continue;
   for(let axis=0;axis<3;axis++){
    const t=axes(axis);
    for(let q=0;q<4;q++){
     if(++nativeEdges>MAX_NATIVE_EDGES)throw Error('结构描边几何超过原生边预算');
     const fixed=[...b.min] as Point;fixed[t[0]]=q&1?b.max[t[0]]:b.min[t[0]];fixed[t[1]]=q&2?b.max[t[1]]:b.min[t[1]];
     const id=`${axis}:${fixed[t[0]]},${fixed[t[1]]}`,old=lines.get(id);
     if(old)old.intervals.push([b.min[axis],b.max[axis]]);else{if(lines.size>=MAX_LINES)throw Error('结构描边几何超过边线预算');lines.set(id,{axis,fixed,intervals:[[b.min[axis],b.max[axis]]]});}
    }
   }
  }
  for(const line of lines.values()){
   const {axis,fixed}=line,t=axes(axis),intervals:[number,number][]=[];
   for(const interval of line.intervals.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){
    const last=intervals.at(-1);if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else intervals.push([...interval]);
   }
   for(const [lo,hi] of intervals){
    const min=[...fixed] as Point,max=[...fixed] as Point;min[axis]=lo;max[axis]=hi;
    for(const a of t){min[a]-=.5;max[a]+=.5;}
    const neighbors=this.near(min,max),cuts=new Set([lo,hi]);
    for(const b of neighbors)for(const v of [b.min[axis],b.max[axis]])if(v>lo&&v<hi)cuts.add(v);
    const breaks=[...cuts].sort((a,b)=>a-b);
    for(let i=1;i<breaks.length;i++){
     if(++this.diagnostics.segments>MAX_SEGMENTS)throw Error('结构描边几何超过边段预算');
     const from=breaks[i-1],to=breaks[i],middle=[...fixed.map(v=>v*2)] as Point;middle[axis]=from+to;
     let mask=0;
     for(let q=0;q<4;q++){const sample=[...middle] as Point;sample[t[0]]+=q&1?1:-1;sample[t[1]]+=q&2?1:-1;if(this.at(sample).length)mask|=1<<q;}
     if(mask===6||mask===9){this.diagnostics.nonManifold++;this.diagnostics.ambiguous++;continue;}
     const count=[1,2,4,8].filter(bit=>mask&bit).length;
     if(count===3){this.diagnostics.concave++;continue;}if(count===2){this.diagnostics.flat++;continue;}if(count!==1)continue;
     const q=Math.log2(mask),faces:[number,number]=[t[0]*2+(q&1?1:0),t[1]*2+(q&2?1:0)],start=[...fixed] as Point,end=[...fixed] as Point;
     start[axis]=from;end[axis]=to;
     const last=this.edges.at(-1);
     if(last&&last.axis===axis&&last.end.every((v,a)=>v===start[a])&&last.faces[0]===faces[0]&&last.faces[1]===faces[1])last.end=end;
     else this.edges.push({axis,start,end,faces});
    }
   }
  }
  this.edges.sort((a,b)=>a.axis-b.axis||a.start[0]-b.start[0]||a.start[1]-b.start[1]||a.start[2]-b.start[2]);
  // Same exterior plane with overlapping native owners cannot be assigned safely.
  for(const b of this.boxes){
   if(b.canvasId!==canvas.canvasId||!this.allowed.has(key(b.cell)))continue;
   const nearby=this.near(b.min,b.max);
   for(let face=0;face<6;face++){
    const axis=Math.floor(face/2),t=axes(axis),plane=face%2?b.min[axis]:b.max[axis];
    for(const other of nearby){
     if(other===b||(face%2?other.min[axis]:other.max[axis])!==plane)continue;
     const lo=t.map(a=>Math.max(b.min[a],other.min[a])),hi=t.map(a=>Math.min(b.max[a],other.max[a]));
     if(lo.some((v,i)=>v>=hi[i]))continue;
     const cuts=t.map((a,i)=>[...new Set([lo[i],hi[i],...nearby.flatMap(n=>[n.min[a],n.max[a]]).filter(v=>v>lo[i]&&v<hi[i])])].sort((a,b)=>a-b));
     let exposed=false;
     for(let u=1;u<cuts[0].length&&!exposed;u++)for(let v=1;v<cuts[1].length;v++){
      const p:Point=[0,0,0];p[axis]=plane*2+(face%2?-1:1);p[t[0]]=cuts[0][u-1]+cuts[0][u];p[t[1]]=cuts[1][v-1]+cuts[1][v];
      if(!this.at(p).length){exposed=true;break;}
     }
     if(exposed){this.diagnostics.overlapping++;this.diagnostics.ambiguous++;}
    }
   }
  }
 }

 surfaceExists(face:number,plane:number,U:number,V:number):boolean{
  if(![face,plane,U,V].every(Number.isSafeInteger)||face<0||face>5)return false;
  const axis=Math.floor(face/2),t=axes(axis),point:Point=[0,0,0];point[axis]=plane*2+(face%2?1:-1);point[t[0]]=2*U+1;point[t[1]]=2*V+1;
  if(!this.at(point).length)return false;point[axis]=plane*2+(face%2?-1:1);return !this.at(point).length;
 }
 pixel(face:number,plane:number,U:number,V:number):SurfacePixel|null{
  if(![face,plane,U,V].every(Number.isSafeInteger)||face<0||face>5)return null;
  const axis=Math.floor(face/2),t=axes(axis),coord:Point=[0,0,0];coord[axis]=(plane-this.origin[axis])/this.n-(face%2?0:1);
  if(!Number.isSafeInteger(coord[axis]))return null;
  coord[t[0]]=Math.floor((U-this.origin[t[0]])/this.n);coord[t[1]]=Math.floor((V-this.origin[t[1]])/this.n);
  const k=coord.join(',');if(!this.allowed.has(k)||!this.cells.has(k))return null;
  // Isolation changes edge discovery, never the native canvas's legal paint surfaces.
  const adjacent=[...coord];adjacent[axis]+=face%2?-1:1;if(this.cells.has(adjacent.join(',')))return null;
  const point:Point=[0,0,0];point[axis]=plane*2+(face%2?1:-1);point[t[0]]=U*2+1;point[t[1]]=V*2+1;
  if(this.at(point).length!==1)return null;point[axis]=plane*2+(face%2?-1:1);if(this.at(point).length)return null;
  const u=U-this.origin[t[0]]-coord[t[0]]*this.n,v=V-this.origin[t[1]]-coord[t[1]]*this.n;
  return {key:k+','+face,index:v*this.n+u,x:coord[0],y:coord[1],z:coord[2],face,u,v};
 }
 globalUV(p:SurfacePixel):[number,number]{const t=axes(Math.floor(p.face/2)),c=[p.x,p.y,p.z];return [this.origin[t[0]]+c[t[0]]*this.n+p.u,this.origin[t[1]]+c[t[1]]*this.n+p.v];}
 nativePixel(faceKey:string,index:number):SurfacePixel|null{
  const c=faceKey.split(',').map(Number);if(c.length!==4||!c.every(Number.isSafeInteger)||!Number.isSafeInteger(index)||index<0||index>=this.n*this.n)return null;
  const face=c[3];if(face<0||face>5)return null;const axis=Math.floor(face/2),t=axes(axis);
  return this.pixel(face,this.origin[axis]+(c[axis]+(face%2?0:1))*this.n,this.origin[t[0]]+c[t[0]]*this.n+index%this.n,this.origin[t[1]]+c[t[1]]*this.n+Math.floor(index/this.n));
 }
 baseColor(p:SurfacePixel):string{
  const cell=this.cells.get(`${p.x},${p.y},${p.z}`);if(!cell)throw Error('结构描边底色像素无效');
  const color=p.face!==4&&this.sideColor!==undefined?this.sideColor:cell.color,result=this.palette[color];
  if(!/^#[0-9a-fA-F]{6}$/.test(result??''))throw Error('结构描边底色无效');return result.toLowerCase();
 }
}
