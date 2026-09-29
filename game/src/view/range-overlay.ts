import type {GameState,Pos,UIOverlay,Unit} from '../core/types';
import {inWeaponRange,SPACE,surface} from '../core/spatial';
type Vertex=Pos & {height:number;valid:boolean};
/** Clip a convex polygon to one horizontal surface patch; never interpolate terrain heights. */
function clip(poly:Pos[],axis:'x'|'y',edge:number,sign:number):Pos[]{
 const out:Pos[]=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length],insideA=(a[axis]-edge)*sign>=-1e-9,insideB=(b[axis]-edge)*sign>=-1e-9;
  if(insideA)out.push(a);
  if(insideA!==insideB){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
 }return out;
}
export function rangeOverlay(state:GameState,preview:NonNullable<UIOverlay['attackPreview']>){
 const point=(a:number):Pos=>({x:preview.center.x+Math.cos(a)*preview.radius,y:preview.center.y+Math.sin(a)*preview.radius});
 const circle=Array.from({length:96},(_,i)=>point(i*Math.PI/48));
 const vertices:Vertex[]=[],outline:Vertex[]=[];
 const unit={pos:preview.center} as Unit;
 for(const tile of state.tiles){
  if(tile.obstacle||Math.hypot(Math.max(0,Math.abs(tile.x-preview.center.x)-.5),Math.max(0,Math.abs(tile.y-preview.center.y)-.5))>preview.radius)continue;
  let tilePolygon=clip(circle,'x',tile.x-.5,1);tilePolygon=clip(tilePolygon,'x',tile.x+.5,-1);tilePolygon=clip(tilePolygon,'y',tile.y-.5,1);tilePolygon=clip(tilePolygon,'y',tile.y+.5,-1);
  // Subdivide only within the tile to sample occlusion without bridging a height boundary.
  for(let iy=0;iy<4;iy++)for(let ix=0;ix<4;ix++){
   const x=tile.x-.5+ix*.25,y=tile.y-.5+iy*.25;
   let poly=clip(tilePolygon,'x',x,1);poly=clip(poly,'x',x+.25,-1);poly=clip(poly,'y',y,1);poly=clip(poly,'y',y+.25,-1);
   if(poly.length<3)continue;
   const centre=poly.reduce((a,p)=>({x:a.x+p.x/poly.length,y:a.y+p.y/poly.length}),{x:0,y:0});
   const valid=inWeaponRange(state,unit,centre,{range:preview.radius,remote:preview.remote}),height=tile.layer*SPACE.layerHeight+.045;
   for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])vertices.push({...p,height,valid});
  }
 }
 // Split the outer contour at grid boundaries; separate segments have no vertical connectors.
 for(let i=0;i<circle.length;i++){
  const a=circle[i],b=circle[(i+1)%circle.length],cuts=[0,1];
  for(const axis of ['x','y'] as const){const delta=b[axis]-a[axis];if(Math.abs(delta)<1e-9)continue;for(let edge=Math.ceil(Math.min(a[axis],b[axis])-.5)+.5;edge<Math.max(a[axis],b[axis]);edge++){const t=(edge-a[axis])/delta;if(t>1e-8&&t<1-1e-8)cuts.push(t);}}
  cuts.sort((a,b)=>a-b);
  const at=(t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  for(let j=1;j<cuts.length;j++){const tile=surface(state,at((cuts[j-1]+cuts[j])/2));if(!tile||tile.obstacle)continue;for(const t of [cuts[j-1],cuts[j]])outline.push({...at(t),height:tile.layer*SPACE.layerHeight+.05,valid:true});}
 }
 return {vertices,outline};
}
