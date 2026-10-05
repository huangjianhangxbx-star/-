import type {GameState,Pos,Unit} from './types';
import {clearShot,distance,radius,surface} from './spatial';
export const AREA_EPSILON=1e-7;
export type AttackArea={kind:'circle';center:Pos;radius:number}|{kind:'sector';origin:Pos;heading:number;range:number;arc:number}|{kind:'capsule';from:Pos;to:Pos;radius:number};
export const areaOrigin=(a:AttackArea)=>a.kind==='circle'?a.center:a.kind==='sector'?a.origin:a.from;
export function segmentDistance(p:Pos,a:Pos,b:Pos){const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n)):0;return distance(p,{x:a.x+t*dx,y:a.y+t*dy});}
export const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function intersectsArea(a:AttackArea,p:Pos,r=0){
 if(a.kind==='circle')return distance(p,a.center)<=a.radius+r+AREA_EPSILON;
 if(a.kind==='capsule')return segmentDistance(p,a.from,a.to)<=a.radius+r+AREA_EPSILON;
 const d=distance(p,a.origin),angle=Math.abs(angleDelta(Math.atan2(p.y-a.origin.y,p.x-a.origin.x),a.heading));
 if(angle<=a.arc/2+AREA_EPSILON)return d<=a.range+r+AREA_EPSILON;
 const endpoint=(h:number)=>({x:a.origin.x+Math.cos(h)*a.range,y:a.origin.y+Math.sin(h)*a.range});
 return Math.min(segmentDistance(p,a.origin,endpoint(a.heading-a.arc/2)),segmentDistance(p,a.origin,endpoint(a.heading+a.arc/2)))<=r+AREA_EPSILON;
}
/** Barricades share the terrain cell footprint; keep this contract local to EC04. */
function areaClearShot(s:GameState,from:Pos,to:Pos){
 if(!clearShot(s,from,to))return false;
 return !s.barricades.some(b=>{
  let lo=0,hi=1;
  for(const axis of ['x','y'] as const){const d=to[axis]-from[axis],min=b[axis]-.5,max=b[axis]+.5;
   if(Math.abs(d)<1e-12){if(from[axis]<min||from[axis]>max)return false;}
   else{const a=(min-from[axis])/d,c=(max-from[axis])/d;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(lo>hi)return false;}
  }
  return hi>AREA_EPSILON&&lo<1-AREA_EPSILON;
 });
}
export function areaHits(s:GameState,a:AttackArea,u:Unit){return intersectsArea(a,u.pos,radius(u))&&areaClearShot(s,areaOrigin(a),u.pos);}
export function clipCapsule(s:GameState,a:Extract<AttackArea,{kind:'capsule'}>){
 const n=Math.max(1,Math.ceil(distance(a.from,a.to)/.025));let to={...a.from};
 for(let i=1;i<=n;i++){const p={x:a.from.x+(a.to.x-a.from.x)*i/n,y:a.from.y+(a.to.y-a.from.y)*i/n};if(!areaClearShot(s,a.from,p))break;to=p;}
 return {...a,from:{...a.from},to};
}
/** Analytic area is authoritative; tessellation approximates its curved perimeter only. */
export function areaContour(a:AttackArea):Pos[]{
 if(a.kind==='circle')return Array.from({length:96},(_,i)=>({x:a.center.x+Math.cos(i*Math.PI/48)*a.radius,y:a.center.y+Math.sin(i*Math.PI/48)*a.radius}));
 if(a.kind==='sector')return [a.origin,...Array.from({length:65},(_,i)=>{const h=a.heading-a.arc/2+a.arc*i/64;return {x:a.origin.x+Math.cos(h)*a.range,y:a.origin.y+Math.sin(h)*a.range};})];
 const h=Math.atan2(a.to.y-a.from.y,a.to.x-a.from.x);return [a.to,a.from].flatMap((p,j)=>Array.from({length:33},(_,i)=>{const t=h-Math.PI/2+j*Math.PI+i*Math.PI/32;return {x:p.x+Math.cos(t)*a.radius,y:p.y+Math.sin(t)*a.radius};}));
}
export function areaPointVisibleThroughTerrain(s:GameState,a:AttackArea,p:Pos){return !!surface(s,p)&&!surface(s,p)!.obstacle&&areaClearShot(s,areaOrigin(a),p);}
/** Visibility polygon: rays through shape perimeter and every nearby wall corner.
 * The same terrain LOS contract clips rays; renderer never invents another attack shape. */
export function areaFootprint(s:GameState,a:AttackArea):Pos[]{
 const o=areaOrigin(a),poly=areaContour(a),bound=Math.max(...poly.map(p=>distance(o,p)))+.1;
 const angles=poly.filter(p=>distance(o,p)>1e-8).map(p=>Math.atan2(p.y-o.y,p.x-o.x));
 for(const t of [...s.tiles.filter(t=>t.obstacle),...s.barricades])if(distance(t,o)<bound+1)for(const x of [t.x-.5,t.x+.5])for(const y of [t.y-.5,t.y+.5]){const h=Math.atan2(y-o.y,x-o.x);angles.push(h-1e-6,h,h+1e-6);}
 const rays=[...new Set(angles.map(h=>angleDelta(h,0)))].sort((x,y)=>x-y),out:Pos[]=[];
 for(const h of rays){const d={x:Math.cos(h),y:Math.sin(h)};let reach=Infinity;
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],ex=q.x-p.x,ey=q.y-p.y,den=d.x*ey-d.y*ex;if(Math.abs(den)<1e-12)continue;const px=p.x-o.x,py=p.y-o.y,t=(px*ey-py*ex)/den,u=(px*d.y-py*d.x)/den;if(t>1e-7&&u>=-1e-7&&u<=1+1e-7)reach=Math.min(reach,t);}
  if(!Number.isFinite(reach))continue;
  const at=(t:number)=>({x:o.x+d.x*t,y:o.y+d.y*t});if(!intersectsArea(a,at(reach/2)))continue;
  if(!areaClearShot(s,o,at(reach))){let lo=0,hi=reach;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(areaClearShot(s,o,at(mid)))lo=mid;else hi=mid;}reach=Math.max(0,lo-1e-6);}
  out.push(at(reach));
 }
 // Sector includes its origin between the outer radial edges, avoiding the rear wedge.
 if(a.kind==='sector'){out.sort((p,q)=>angleDelta(Math.atan2(p.y-o.y,p.x-o.x),a.heading)-angleDelta(Math.atan2(q.y-o.y,q.x-o.x),a.heading));return [o,...out];}
 return out;
}
