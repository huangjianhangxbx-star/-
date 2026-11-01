import type {Vec3} from './workshop-documents.ts';
/** Point and normal use the target canvas's native voxel frame, with Z up.
 * A positive face starts at the next outer grid boundary; a negative face
 * ends at the prior boundary. This never rounds a new cell into its support.
 */
export function surfaceBrushGridHit(point:Vec3,normal:Vec3){
  if(!point.every(Number.isFinite)||!normal.every(Number.isFinite)||normal.every(n=>Math.abs(n)<1e-12))return null;
  const axis=normal.reduce((best,n,i)=>Math.abs(n)>Math.abs(normal[best])?i:best,0),positive=normal[axis]>0;
  const coordinates=point.map((value,i)=>{
    const nearest=Math.round(value),aligned=Math.abs(value-nearest)<1e-7?nearest:value;
    return i===axis?(positive?Math.ceil(aligned):Math.floor(aligned)):Math.floor(aligned);
  });
  return {x:coordinates[0],y:coordinates[1],z:coordinates[2],face:axis*2+(positive?0:1)};
}
