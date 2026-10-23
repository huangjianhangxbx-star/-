import * as THREE from "three";
import {CanvasObjectQuery} from "./canvas-object-query.ts";
import type {GizmoTransform} from "../core/voxel-gizmo.ts";
import { meshMap } from "../core/mesher.ts";
import {
  CANVAS_TICK,
  canvasAsset,
  type CanvasSession,
} from "../core/workshop-canvases.ts";
import type { Vec3 } from "../core/workshop-documents.ts";
import type { MapView } from "./view.ts";
/** Display is in the active canvas frame: one local voxel is .25 render units. */
export class CanvasView {
  pointMode:'center'|'corner'='center';
  private group = new THREE.Group();
  private signature = "";
  private opacities=new Map<string,number>();
  private opacityKey(id:string){return 'workshop-canvas-opacity:'+this.session?.model.assetId+':'+id;}
  getOpacity(id:string){
    const key=this.opacityKey(id);if(this.opacities.has(key))return this.opacities.get(key)!;
    let value=1;try{const stored=localStorage.getItem(key);if(stored!==null&&Number.isFinite(Number(stored)))value=Math.max(0,Math.min(1,Number(stored)));}catch{}
    this.opacities.set(key,value);return value;
  }
  setOpacity(id:string,value:number){
    value=Math.max(0,Math.min(1,value));const key=this.opacityKey(id);this.opacities.set(key,value);
    try{localStorage.setItem(key,String(value));}catch{}
    this.update(this.session);
  }
  private applyOpacity(group:THREE.Object3D,value:number){
    if(!this.view.editable)return;
    group.traverse((o:any)=>{if(!o.material)return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
      const opacity=value*(this.view.xray?.3:1);m.opacity=opacity;m.transparent=opacity<1;m.depthWrite=opacity===1;m.needsUpdate=true;
    }});
  }
  private session: CanvasSession | null = null;

  constructor(private view: MapView) {
    view.scene.add(this.group);
  }
  private frame = {step: .25, origin: [0,0,0]};
  captureView() {
    const camera=this.view.camera, factor=this.frame.step/.25;
    const offset=new THREE.Vector3(this.frame.origin[0],this.frame.origin[2],-this.frame.origin[1]).multiplyScalar(CANVAS_TICK);
    return {position:camera.position.clone().multiplyScalar(factor).add(offset), target:this.view.controls.target.clone().multiplyScalar(factor).add(offset), up:camera.up.clone(), zoom:camera.zoom/factor};
  }
  restoreView(saved:ReturnType<CanvasView['captureView']>) {
    const camera=this.view.camera, factor=this.frame.step/.25;
    const offset=new THREE.Vector3(this.frame.origin[0],this.frame.origin[2],-this.frame.origin[1]).multiplyScalar(CANVAS_TICK);
    camera.position.copy(saved.position).sub(offset).divideScalar(factor);
    this.view.controls.target.copy(saved.target).sub(offset).divideScalar(factor);
    camera.up.copy(saved.up);camera.zoom=saved.zoom*factor;
    camera.far=Math.max(500,camera.position.distanceTo(this.view.controls.target)*10);
    camera.updateProjectionMatrix();this.view.controls.update();
  }
  update(session: CanvasSession | null) {
    this.frame=session?{step:session.active.voxelStepM,origin:[...session.active.originTicks]}:{step:.25,origin:[0,0,0]};
    this.session = session;
    const signature = session
      ? JSON.stringify([
          session.activeId,
          session.model.canvases!.map(c=>this.getOpacity(c.canvasId)),
          session.model.palette,
          session.model.sideColor,
          session.model.canvases!.map((c) =>
            c.canvasId === session.activeId
              ? {
                  canvasId: c.canvasId,
                  visible: c.visible,
                  originTicks: c.originTicks,
                  voxelStepM: c.voxelStepM,
                }
              : c,
          ),
        ])
      : "";
    this.view.terrain.visible =
      !this.view.scalePreviewTerrain && (session?.active.visible ?? true);
    this.applyOpacity(this.view.terrain,session?this.getOpacity(session.activeId):1);
    if (signature === this.signature) return;
    this.signature = signature;
    this.view.disposeGeometry(this.group);
    if (!session) {
      this.view.terrain.visible = true;
      return;
    }
    const active = session.active,
      scale = 0.25 / active.voxelStepM;
    this.view.terrain.visible =
      active.visible && !this.view.scalePreviewTerrain;
    for (const c of session.model.canvases!) {
      if (c.canvasId === session.activeId || !c.visible) continue;
      const layer = new THREE.Group(),
        asset = canvasAsset(session.model, c.canvasId);
      this.view.fillTerrain(layer, asset, meshMap(asset));
      this.applyOpacity(layer,this.getOpacity(c.canvasId));
      layer.scale.setScalar(c.voxelStepM / active.voxelStepM);
      const d = c.originTicks.map(
        (n, i) => (n - active.originTicks[i]) * CANVAS_TICK * scale,
      );
      layer.position.set(d[0], d[2], -d[1]);
      layer.userData.canvasId = c.canvasId;
      this.group.add(layer);
    }
    this.view.host.dataset.canvasId = active.canvasId;
    this.view.host.dataset.canvasStep = String(active.voxelStepM);
    this.view.host.dataset.canvasVisible = String(active.visible);
  }
  private objectOutline=new THREE.Group();
  private objectPreviewState:{root:THREE.Object3D;position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}[]=[];
  objectEntries(){
    const s=this.session;if(!s)return [];
    return [{id:s.activeId,root:this.view.terrain},...this.group.children.map(root=>({id:root.userData.canvasId as string,root}))];
  }
  objectQuery(){return new CanvasObjectQuery(this.view.camera,this.objectEntries());}
  objectSelection(ids:string[],enabled:boolean,pivotTicks?:Vec3){
    if(!this.objectOutline.parent)this.view.scene.add(this.objectOutline);
    this.view.disposeGeometry(this.objectOutline);
    if(!enabled)return;
    const entries=this.objectEntries().filter(e=>ids.includes(e.id)&&e.root.visible);
    for(const {root} of entries){const box=new THREE.Box3().setFromObject(root);if(!box.isEmpty())this.objectOutline.add(new THREE.Box3Helper(box,0xe5b663));}
    const pivot=pivotTicks?.map((v,i)=>(v-this.frame.origin[i])*CANVAS_TICK*.25/this.frame.step);
    this.view.setObjectGizmo(this.objectQuery().bounds(ids),true,pivot?new THREE.Vector3(pivot[0],pivot[2],-pivot[1]):undefined);
  }
  objectPivotTicks(ids:string[]):Vec3{
    const box=this.objectQuery().bounds(ids),point=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());
    const factor=this.frame.step/.25;
    return [point.x,-point.z,point.y].map((v,i)=>Math.round(v*factor/CANVAS_TICK+this.frame.origin[i])) as Vec3;
  }
  previewObjects(ids:string[],transform:GizmoTransform|null,pivotTicks:Vec3){
    for(const state of this.objectPreviewState){state.root.position.copy(state.position);state.root.quaternion.copy(state.quaternion);state.root.scale.copy(state.scale);state.root.updateMatrixWorld(true);}
    this.objectPreviewState=[];
    if(!transform)return;
    const factor=.25/this.frame.step;
    const p=pivotTicks.map((v,i)=>(v-this.frame.origin[i])*CANVAS_TICK*factor),pivot=new THREE.Vector3(p[0],p[2],-p[1]);
    const rotation=new THREE.Quaternion();
    if(transform.kind==='rotate')rotation.setFromAxisAngle(transform.axis==='x'?new THREE.Vector3(1,0,0):transform.axis==='y'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0),transform.turns*Math.PI/2);
    for(const {id,root} of this.objectEntries())if(ids.includes(id)){
      this.objectPreviewState.push({root,position:root.position.clone(),quaternion:root.quaternion.clone(),scale:root.scale.clone()});
      if(transform.kind==='move')root.position.add(new THREE.Vector3(transform.delta[0]*.25,transform.delta[2]*.25,-transform.delta[1]*.25));
      else {root.position.sub(pivot).applyQuaternion(rotation).add(pivot);root.quaternion.premultiply(rotation);}
      root.updateMatrixWorld(true);
    }
  }
  pick(event: PointerEvent, source: boolean): Vec3 | null {
    const s = this.session;

    const r = this.view.renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.view.camera,
    );
    const roots = source ? [this.view.terrain] : [this.view.terrain,...this.group.children];
    const hit = ray.intersectObjects(roots, true).find(hit=>this.view.section===null||hit.point.y<=this.view.section*.25+.001);
    if (!hit) return null;
    let root:THREE.Object3D=hit.object;while(root.parent&&!roots.includes(root))root=root.parent;
    const local=root.worldToLocal(hit.point.clone()),n=hit.face?.normal??new THREE.Vector3();
    if(this.pointMode==='center'){local.x=(Math.floor(local.x/.25-n.x*.0001)+.5)*.25;local.y=(Math.floor(local.y/.25-n.y*.0001)+.5)*.25;local.z=(Math.floor(local.z/.25-n.z*.0001)+.5)*.25;}
    else {local.x=Math.round(local.x/.25)*.25;local.y=Math.round(local.y/.25)*.25;local.z=Math.round(local.z/.25)*.25;}
    const snapped=root.localToWorld(local);
    const point = [snapped.x, -snapped.z, snapped.y],
      scale = (s?.active.voxelStepM??.25) / 0.25;
    return point.map(
      (v, i) =>
        Math.round(
          (v * scale + (s?.active.originTicks[i]??0) * CANVAS_TICK) / CANVAS_TICK,
        ) * CANVAS_TICK,
    ) as Vec3;
  }
  preview(origin: Vec3 | null) {
    const s = this.session;
    if (!s || !origin) {
      this.view.clearScalePreview();
      return;
    }
    const asset = canvasAsset(s.model, s.activeId);
    this.view.showScalePreview(asset, meshMap(asset));
    const delta = origin.map(
      (n, i) =>
        ((n - s.active.originTicks[i]) * CANVAS_TICK * 0.25) /
        s.active.voxelStepM,
    );
    this.view.scalePreviewTerrain!.position.set(delta[0], delta[2], -delta[1]);
  }
}
