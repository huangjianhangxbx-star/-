import * as THREE from 'three';
import type { StructureEdgeDomain } from '../core/structure-edge-domain.ts';
import type { MapView } from './view.ts';
import type { ModelCanvas } from '../core/workshop-canvases.ts';
/** Diagnostic only. Author colour bands are supplied by the ordinary paint preview. */
export class EdgeBandGuides {
 private items:StructureEdgeDomain['edges']|undefined;
 private canvasKey='';
 private line:THREE.LineSegments|null=null;
 constructor(private view:MapView){}
 show(edges:StructureEdgeDomain['edges'],canvas:ModelCanvas){
  const key=canvas.canvasId+':'+canvas.voxelStepM+':'+canvas.originTicks.join(',');if(this.items===edges&&this.canvasKey===key)return;this.clear();this.items=edges;this.canvasKey=key;if(!edges.length)return;
  const factor=.25/(canvas.voxelStepM*64),positions=new Float32Array(edges.length*6);let i=0;
  for(const edge of edges)for(const p of [edge.start,edge.end]){
   const local=p.map((v,a)=>(v-canvas.originTicks[a]*2)*factor);positions[i++]=local[0];positions[i++]=local[2];positions[i++]=-local[1];
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  this.line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x64d8ed,depthTest:false,transparent:true,opacity:.85}));this.line.renderOrder=30;this.view.scene.add(this.line);
 }
 clear(){this.items=undefined;this.canvasKey='';if(!this.line)return;this.line.removeFromParent();this.line.geometry.dispose();(this.line.material as THREE.Material).dispose();this.line=null;}
}
