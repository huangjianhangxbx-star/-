import * as THREE from "three";
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
  private group = new THREE.Group();
  private signature = "";
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
      if (this.view.editable)
        layer.traverse((o: any) => {
          if (o.material) {
            o.material.transparent = true;
            o.material.opacity = 0.45;
          }
        });
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
  pick(event: PointerEvent, source: boolean): Vec3 | null {
    const s = this.session;
    if (!s) return null;
    const r = this.view.renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.view.camera,
    );
    const roots = source ? [this.view.terrain] : this.group.children;
    const hit = ray.intersectObjects(roots, true).find(hit=>this.view.section===null||hit.point.y<=this.view.section*.25+.001);
    if (!hit) return null;
    const point = [hit.point.x, -hit.point.z, hit.point.y],
      scale = s.active.voxelStepM / 0.25;
    return point.map(
      (v, i) =>
        Math.round(
          (v * scale + s.active.originTicks[i] * CANVAS_TICK) / CANVAS_TICK,
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
