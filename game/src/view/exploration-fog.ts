import * as THREE from 'three';
import type {GameState} from '../core/types';
/** World-space mask works after architecture batching, including roofs and walls. */
export class ExplorationFog {
 private texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
 private uniforms={exploreFog:{value:this.texture},exploreSize:{value:new THREE.Vector2(1,1)},exploreEnabled:{value:0}};
 private signature='';
 update(s:GameState){
  this.uniforms.exploreEnabled.value=Number(!!s.exploration);if(!this.uniforms.exploreEnabled.value)return;
  const run=s.exploration!,key=run.visible.join('|')+';'+run.memory.seen.join('|');if(key===this.signature)return;this.signature=key;
  if(this.texture.image.width!==s.width||this.texture.image.height!==s.height){this.texture.dispose();this.texture=new THREE.DataTexture(new Uint8Array(s.width*s.height*4),s.width,s.height);this.uniforms.exploreFog.value=this.texture;this.uniforms.exploreSize.value.set(s.width,s.height);}
  const data=this.texture.image.data as Uint8Array,visible=new Set(run.visible),known=new Set(run.memory.seen);for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){const key=x+','+y,n=(y*s.width+x)*4;data[n]=visible.has(key)?255:known.has(key)?80:0;data[n+3]=255;}this.texture.needsUpdate=true;
 }
 apply(root:THREE.Object3D){root.traverse(o=>{if(!(o instanceof THREE.Mesh||o instanceof THREE.Line))return;for(const m of Array.isArray(o.material)?o.material:[o.material])this.material(m);if(o instanceof THREE.Mesh&&o.castShadow&&!o.customDepthMaterial){const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});this.material(depth,true);o.customDepthMaterial=depth;}});}
 private material(m:THREE.Material,depth=false){if(m.userData.explorationFog)return;m.userData.explorationFog=true;
  m.onBeforeCompile=(shader)=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader='varying vec2 exploreWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','exploreWorld = (modelMatrix * vec4(transformed, 1.0)).xz;\n#include <project_vertex>');shader.fragmentShader='uniform sampler2D exploreFog; uniform vec2 exploreSize; uniform float exploreEnabled; varying vec2 exploreWorld;\n'+shader.fragmentShader;
   const mask='float exploreLight = 1.0; if(exploreEnabled > .5){ vec2 uv=(exploreWorld+exploreSize*.5)/exploreSize; exploreLight=texture2D(exploreFog,uv).r; if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))exploreLight=0.0; if(exploreLight < .01)discard; }';
   shader.fragmentShader=shader.fragmentShader.replace('void main() {','void main() {\n'+mask);if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <tonemapping_fragment>','gl_FragColor.rgb *= mix(.18,1.0,exploreLight);\n#include <tonemapping_fragment>');
  };m.customProgramCacheKey=()=>depth?'exploration-fog-depth-v1':'exploration-fog-v1';m.needsUpdate=true;
 }
 dispose(){this.texture.dispose();}
}
