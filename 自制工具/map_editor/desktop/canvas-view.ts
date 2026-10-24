import * as THREE from "three";
import {SurfacePaintLayer} from './surface-paint-layer.ts';
import {paintFaceKey,paintResolution,type SurfacePaint} from '../core/surface-paint.ts';
import {CanvasObjectQuery} from "./canvas-object-query.ts";
import type {GizmoTransform} from "../core/voxel-gizmo.ts";
import { meshMap } from "../core/mesher.ts";
import {
  CANVAS_TICK,
  canvasAsset,
  type CanvasSession,
} from "../core/workshop-canvases.ts";
import type { Vec3, AssetDocument } from "../core/workshop-documents.ts";
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

  private view:MapView;
  private paintLayer:SurfacePaintLayer;
  private paintOwnerKeys: {source:readonly string[];keys:Set<string>}|null=null;
  private rockModel:AssetDocument|null=null;
  /** Derived whole active-canvas preview; the session/source remains untouched. */
  previewRock(model:AssetDocument|null){
    const start=performance.now();
    this.rockModel=model;
    if(model&&this.session){
      const asset=canvasAsset(model,this.session.activeId);
      this.view.showScalePreview(asset,meshMap(asset));
      this.paintLayer.update(model,this.session.active);
    }else{
      this.view.clearScalePreview();
      this.paintLayer.update(this.session?.model??null,this.session?.active);
    }
    this.objectOutline.visible=!model;
    for(const root of this.group.children)if(root.userData.canvasId===this.session?.activeId)root.visible=!model;
    if(model)this.view.host.dataset.rockMeshMs=String(performance.now()-start);else delete this.view.host.dataset.rockMeshMs;
  }
  constructor(view: MapView) {
    this.view=view;
    view.scene.add(this.group);
    this.paintLayer=new SurfacePaintLayer(view.scene,id=>view.editable?this.getOpacity(id)*(view.xray?.3:1):1);
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
    this.paintLayer.update(this.rockModel??session?.model??null,session?.active);
    for(const root of this.group.children)if(root.userData.canvasId===session?.activeId)root.visible=!this.rockModel;
    const signature = session
      ? JSON.stringify([
          session.activeId,
          (session as any).editObjectId,
          (session as any).editObjectId ? session.active.cells : null,
          session.model.canvases!.map(c=>this.getOpacity(c.canvasId)),
          session.model.palette,
          session.model.sideColor,
          session.active.faceTone,
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
      if (!c.visible) continue;
      const editing=(session as any).editObjectId as string|undefined;
      if(c.canvasId===session.activeId&&!editing)continue;
      const layer = new THREE.Group(),
        asset = canvasAsset(session.model, c.canvasId);
      if(c.canvasId===session.activeId){const keys=new Set(session.model.objects?.find(o=>o.objectId===editing)?.cellKeys??[]);asset.cells=asset.cells.filter(v=>!keys.has(`${v.x},${v.y},${v.z}`));}
      this.view.fillTerrain(layer, asset, meshMap(asset));
      this.applyOpacity(layer,this.getOpacity(c.canvasId));
      layer.scale.setScalar(c.voxelStepM / active.voxelStepM);
      const d = c.originTicks.map(
        (n, i) => (n - active.originTicks[i]) * CANVAS_TICK * scale,
      );
      layer.position.set(d[0], d[2], -d[1]);
      layer.userData.canvasId = c.canvasId;
      if(c.canvasId===session.activeId&&this.rockModel)layer.visible=false;
      this.group.add(layer);
    }
    this.view.host.dataset.canvasId = active.canvasId;
    this.view.host.dataset.canvasStep = String(active.voxelStepM);
    this.view.host.dataset.canvasVisible = String(active.visible);
  }
  private objectOutline=new THREE.Group();
  private previewLayer=new THREE.Group();
  private previewHidden:{root:THREE.Object3D;visible:boolean}[]=[];
  objectEntries(ids?:readonly string[]){
    const s=this.session;if(!s)return [];
    const selected=ids?new Set(ids):null;
    const objects=(s.model.objects??[]).filter(o=>!selected||selected.has(o.objectId));
    const canvasIds=new Set(objects.flatMap(o=>o.canvasIds));
    const factor=.25/s.active.voxelStepM;
    const cellsByCanvas=new Map(s.model.canvases!.filter(c=>canvasIds.has(c.canvasId)).map(c=>[c.canvasId,new Map(c.cells.map(v=>[`${v.x},${v.y},${v.z}`,v]))]));
    return objects.map(object=>{
      const c=s.model.canvases!.find(c=>object.canvasIds.includes(c.canvasId));
      const root=c?.canvasId===s.activeId?this.view.terrain:this.group.children.find(r=>r.userData.canvasId===c?.canvasId)??this.group;
      const keys=object.cellKeys??[],step=(c?.voxelStepM??.25)*factor;
      const cells=c?.visible?keys.map(key=>cellsByCanvas.get(c.canvasId)?.get(key)).filter((v):v is NonNullable<typeof v>=>!!v):[];
      const boxes=cells.map(v=>{
        const d=c!.originTicks.map((n,i)=>(n-s.active.originTicks[i])*CANVAS_TICK*factor);
        return new THREE.Box3(new THREE.Vector3(d[0]+v.x*step,d[2]+v.z*step,-d[1]-(v.y+1)*step),new THREE.Vector3(d[0]+(v.x+1)*step,d[2]+(v.z+1)*step,-d[1]-v.y*step));
      });
      return {id:object.objectId,root,boxes};
    });
  }
  objectQuery(){return new CanvasObjectQuery(this.view.camera,this.objectEntries());}
  objectSelection(ids:string[],enabled:boolean,pivotTicks?:Vec3,gizmoEnabled=true){
    if(!this.objectOutline.parent)this.view.scene.add(this.objectOutline);
    this.view.disposeGeometry(this.objectOutline);
    if(!enabled)return;
    const entries=this.objectEntries(ids).filter(e=>e.root.visible);
    const query=new CanvasObjectQuery(this.view.camera,entries);
    for(const entry of entries){const box=new THREE.Box3();for(const member of entry.boxes)box.union(member);if(!box.isEmpty())this.objectOutline.add(new THREE.Box3Helper(box,0xe5b663));}
    const pivot=pivotTicks?.map((v,i)=>(v-this.frame.origin[i])*CANVAS_TICK*.25/this.frame.step);
    this.view.setObjectGizmo(query.bounds(ids),gizmoEnabled,pivot?new THREE.Vector3(pivot[0],pivot[2],-pivot[1]):undefined);
  }
  objectPivotTicks(ids:string[]):Vec3{
    const box=new CanvasObjectQuery(this.view.camera,this.objectEntries(ids)).bounds(ids),point=box.isEmpty()?new THREE.Vector3():box.getCenter(new THREE.Vector3());
    const factor=this.frame.step/.25;
    return [point.x,-point.z,point.y].map((v,i)=>Math.round(v*factor/CANVAS_TICK+this.frame.origin[i])) as Vec3;
  }
  previewObjects(ids:string[],transform:GizmoTransform|null,pivotTicks:Vec3){
    for(const {root,visible} of this.previewHidden)root.visible=visible;
    this.previewHidden=[];this.view.disposeGeometry(this.previewLayer);
    if(!transform||!this.session)return;
    if(!this.previewLayer.parent)this.view.scene.add(this.previewLayer);
    const factor=.25/this.frame.step;
    const p=pivotTicks.map((v,i)=>(v-this.frame.origin[i])*CANVAS_TICK*factor),pivot=new THREE.Vector3(p[0],p[2],-p[1]);
    const rotation=new THREE.Quaternion();
    if(transform.kind==='rotate')rotation.setFromAxisAngle(transform.axis==='x'?new THREE.Vector3(1,0,0):transform.axis==='y'?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0),transform.turns*Math.PI/2);
    const session=this.session,selected=session.model.objects!.filter(o=>ids.includes(o.objectId));
    for(const canvasId of new Set(selected.flatMap(o=>o.canvasIds))){
      const c=session.model.canvases!.find(c=>c.canvasId===canvasId)!;if(!c.visible)continue;
      const roots=canvasId===session.activeId?[this.view.terrain,...this.group.children.filter(r=>r.userData.canvasId===canvasId)]:this.group.children.filter(r=>r.userData.canvasId===canvasId);
      for(const root of roots){this.previewHidden.push({root,visible:root.visible});root.visible=false;}
      const keys=new Set(selected.filter(o=>o.canvasIds.includes(canvasId)).flatMap(o=>o.cellKeys??[]));
      for(const moving of [false,true]){
        const asset=canvasAsset(session.model,canvasId);asset.cells=asset.cells.filter(v=>keys.has(`${v.x},${v.y},${v.z}`)===moving);
        const root=new THREE.Group();this.view.fillTerrain(root,asset,meshMap(asset));this.applyOpacity(root,this.getOpacity(canvasId));root.scale.setScalar(c.voxelStepM/this.frame.step);
        const d=c.originTicks.map((n,i)=>(n-this.frame.origin[i])*CANVAS_TICK*factor);root.position.set(d[0],d[2],-d[1]);
        if(moving){if(transform.kind==='move')root.position.add(new THREE.Vector3(transform.delta[0]*.25,transform.delta[2]*.25,-transform.delta[1]*.25));else{root.position.sub(pivot).applyQuaternion(rotation).add(pivot);root.quaternion.premultiply(rotation);}}
        this.previewLayer.add(root);
      }
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
  previewPaint(source?:SurfacePaint){
    const s=this.session;
    this.paintLayer.update(s?.model??null,s?.active,source&&s?{canvasId:s.activeId,source}:undefined);
  }
  paintHit(event:PointerEvent){
    delete this.view.host.dataset.paintHit;
    const s=this.session;if(!s||!s.editObjectId||s.active.locked||!s.active.visible)return null;
    const meshes:THREE.Object3D[]=[];
    const visit=(node:THREE.Object3D)=>{if(!node.visible)return;if((node as THREE.Mesh).isMesh)meshes.push(node);for(const child of node.children)visit(child);};
    visit(this.view.terrain);visit(this.group);
    const hit=this.view.ray(event).intersectObjects(meshes,false)[0];if(!hit?.face)return null;
    const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
    const modelNormal=[normal.x,-normal.z,normal.y],axis=modelNormal.reduce((best,n,i)=>Math.abs(n)>Math.abs(modelNormal[best])?i:best,0),positive=modelNormal[axis]>0,face=axis*2+(positive?0:1);
    const p=[hit.point.x/.25,-hit.point.z/.25,hit.point.y/.25],cell=p.map((n,i)=>Math.floor(n-(i===axis?(positive?1:-1)*1e-5:0)));
    let node:THREE.Object3D|null=hit.object;while(node&&node!==this.group){if(node.userData.canvasId&&node.userData.canvasId!==s.activeId)return null;node=node.parent;}
    const owner=s.model.objects?.find(o=>o.objectId===s.editObjectId);if(!owner?.cellKeys)return null;
    if(this.paintOwnerKeys?.source!==owner.cellKeys)this.paintOwnerKeys={source:owner.cellKeys,keys:new Set(owner.cellKeys)};
    if(!this.paintOwnerKeys.keys.has(cell.join(',')))return null;
    const axes=[0,1,2].filter(i=>i!==axis),n=paintResolution(s.active.voxelStepM),u=Math.max(0,Math.min(n-1,Math.floor((p[axes[0]]-cell[axes[0]])*n))),v=Math.max(0,Math.min(n-1,Math.floor((p[axes[1]]-cell[axes[1]])*n)));
    const key=paintFaceKey(cell[0],cell[1],cell[2],face),index=v*n+u;
    this.view.host.dataset.paintHit=key+':'+index;
    return {key,index,x:cell[0],y:cell[1],z:cell[2],face,u,v};
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
