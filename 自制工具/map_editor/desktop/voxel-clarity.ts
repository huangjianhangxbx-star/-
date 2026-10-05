import type * as THREE from 'three';
/** Editor-only grid shading on existing greedy faces; source geometry is untouched. */
export function attachVoxelClarity(material:THREE.Material,enabled:{value:number}){
 material.onBeforeCompile=shader=>{
  shader.uniforms.voxelClarity=enabled;
  shader.vertexShader='varying vec3 vVoxelPosition;\nvarying vec3 vVoxelNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvVoxelPosition = position * 4.0;\nvVoxelNormal = normal;');
  shader.fragmentShader='uniform float voxelClarity;\nvarying vec3 vVoxelPosition;\nvarying vec3 vVoxelNormal;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    vec3 vn = abs(vVoxelNormal);
    vec2 gridUV = vn.x > 0.5 ? vVoxelPosition.yz : (vn.y > 0.5 ? vVoxelPosition.xz : vVoxelPosition.xy);
    vec2 gridWidth = max(fwidth(gridUV), vec2(0.00001));
    vec2 edgeDistance = min(fract(gridUV), 1.0-fract(gridUV)) / gridWidth;
    float edge = 1.0 - smoothstep(0.35, 1.05, min(edgeDistance.x,edgeDistance.y));
    float fade = 1.0-smoothstep(0.15,0.45,max(gridWidth.x,gridWidth.y));
    outgoingLight *= 1.0 - 0.42 * voxelClarity * edge * fade;
    #include <opaque_fragment>
  `);
 };
 material.customProgramCacheKey=()=> 'workshop-voxel-clarity-1';
}
