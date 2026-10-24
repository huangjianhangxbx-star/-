export type PixelStrokePoint={x:number;y:number;z:number;face:number};
const key=(p:PixelStrokePoint)=>`${p.x},${p.y},${p.z}`;
const coords=(p:PixelStrokePoint)=>[p.x,p.y,p.z];
const delta=(a:PixelStrokePoint,b:PixelStrokePoint)=>coords(b).map((n,i)=>n-coords(a)[i]);
const length=(v:number[])=>v.reduce((a,b)=>a+Math.abs(b),0);
const same=(a:number[],b:number[])=>a.every((n,i)=>n===b[i]);
/** Keeps source geometry untouched. Only new members of one coplanar gesture may be omitted. */
export class PixelPerfectStroke {
 private segments:PixelStrokePoint[][]=[];
 private plane='';
 private original:ReadonlySet<string>;
 constructor(original:ReadonlySet<string>=new Set()){this.original=original;}
 sample(point:PixelStrokePoint,axis:number){
  if(![0,1,2].includes(axis)||!coords(point).every(Number.isSafeInteger))throw Error('像素笔画坐标无效');
  const plane=`${axis}:${coords(point)[axis]}:${point.face}`;
  if(this.plane!==plane){this.plane=plane;this.segments.push([]);}
  const segment=this.segments.at(-1)!;
  if(key(segment.at(-1)??point)!==key(point)||!segment.length)segment.push({...point});
 }
 get points(){
  const result=new Map<string,PixelStrokePoint>();
  for(const raw of this.segments){
   const counts=new Map<string,number>();for(const p of raw)counts.set(key(p),(counts.get(key(p))??0)+1);
   const occupied=new Set(raw.map(key)),kept:PixelStrokePoint[]=[];
   for(let i=0;i<raw.length;i++){
    const next=raw[i],middle=kept.at(-1),previous=kept.at(-2);
    if(middle&&previous){
     const incoming=delta(previous,middle),outgoing=delta(middle,next),diagonal=delta(previous,next);
     const neighbors=coords(middle).reduce((n,_,a)=>n+[-1,1].filter(sign=>{const p=coords(middle);p[a]+=sign;return occupied.has(p.join(','));}).length,0);
     const longTurn=i>=3&&i+1<raw.length&&same(delta(raw[i-3],raw[i-2]),incoming)&&same(delta(next,raw[i+1]),outgoing);
     if(length(incoming)===1&&length(outgoing)===1&&length(diagonal)===2&&diagonal.filter(v=>v!==0).length===2&&
       !this.original.has(key(middle))&&counts.get(key(middle))===1&&neighbors<=2&&!longTurn)kept.pop();
    }
    kept.push(next);
   }
   for(const p of kept)result.set(key(p),{...p});
  }
  return [...result.values()];
 }
}
