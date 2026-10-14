import {BufferGeometry,Float32BufferAttribute} from 'three';
import {groundVariant} from '../../core/scene2d-map';
/** Pretransform vertices into world XY, including each tile's placement. */
export function groundBatches(size:number,kind:'mixed'|'base'){
 if(!Number.isFinite(size)||size<.5||size>6)throw Error('Ground display size must be 0.5–6U');
 const groups=Array.from({length:3},(_,i)=>({variant:i+1,cells:[] as {x:number;y:number}[],positions:[] as number[],uv:[] as number[],indices:[] as number[]}));
 for(let y=0;y<Math.ceil(32/size);y++)for(let x=0;x<Math.ceil(48/size);x++){
  const g=groups[(kind==='base'?1:groundVariant(x,y))-1],n=g.cells.length*4,left=-.5+x*size,top=.5-y*size;
  g.cells.push({x,y});g.positions.push(left,top,0,left+size,top,0,left+size,top-size,0,left,top-size,0);g.uv.push(0,1,1,1,1,0,0,0);g.indices.push(n,n+3,n+1,n+1,n+3,n+2);
 }
 return groups.filter(g=>g.cells.length).map(g=>{const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(g.positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(g.uv,2));geometry.setIndex(g.indices);geometry.computeBoundingSphere();return {variant:g.variant,cells:g.cells,geometry};});
}
