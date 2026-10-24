import * as THREE from "three";
import { CANVAS_TICK } from "../core/workshop-canvases.ts";
import {
  canvasPointMeters,
  rootFaceAxes,
  rootFacePoint,
  snapRootPoint,
  type RootBounds,
  type RootFace,
  type RootSnap,
} from "../core/asset-root.ts";
import type { Vec3 } from "../core/workshop-documents.ts";
import type { MapView } from "./view.ts";

/** A virtual asset face remains pickable through holes and hidden geometry. */
export class RootPlanePicker {
  private group = new THREE.Group();
  private marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 12, 8),
    new THREE.MeshBasicMaterial({ color: "#ffe29b", depthTest: false }),
  );
  private plane: THREE.Plane;
  private disposers: (() => void)[] = [];
  private previousGizmo: boolean;
  private previousHelper: boolean;
  constructor(
    private view: MapView,
    private bounds: RootBounds,
    private face: RootFace,
    private snap: RootSnap,
    private step: number,
    private originTicks: readonly number[],
    private done: (point: Vec3) => void,
    private cancel: () => void,
  ) {
    const axes = rootFaceAxes[face],
      center = rootFacePoint(bounds, face),
      corners = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([u, v]) => this.render(rootFacePoint(bounds, face, u, v)));
    this.plane = new THREE.Plane().setFromCoplanarPoints(
      corners[0],
      corners[1],
      corners[2],
    );
    const vertices = corners.flatMap((p) => p.toArray());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.group.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: "#edc377",
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.1,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    const lines: number[] = [];
    const edge = (a: Vec3, b: Vec3) =>
      lines.push(...this.render(a).toArray(), ...this.render(b).toArray());
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ])
      lines.push(...corners[a].toArray(), ...corners[b].toArray());
    for (const axis of [axes.u, axes.v]) {
      const other = axis === axes.u ? axes.v : axes.u,
        span = bounds.max[axis] - bounds.min[axis],
        stride = step * Math.max(1, Math.ceil(span / step / 80)),
        origin = originTicks[axis] * CANVAS_TICK;
      for (
        let n =
          Math.ceil((bounds.min[axis] - origin) / stride) * stride + origin;
        n < bounds.max[axis];
        n += stride
      ) {
        const a = [...center] as Vec3,
          b = [...center] as Vec3;
        a[axis] = b[axis] = n;
        a[other] = bounds.min[other];
        b[other] = bounds.max[other];
        edge(a, b);
      }
    }
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    this.group.add(
      new THREE.LineSegments(
        grid,
        new THREE.LineBasicMaterial({
          color: "#edc377",
          transparent: true,
          opacity: 0.65,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    this.marker.position.copy(this.render(center));
    this.group.add(this.marker);
    this.group.traverse((o) => (o.renderOrder = 1000));
    view.scene.add(this.group);
    this.previousGizmo = view.gizmo?.enabled ?? false;
    this.previousHelper = view.gizmo?.getHelper().visible ?? false;
    if (view.gizmo) {
      view.gizmo.enabled = false;
      view.gizmo.getHelper().visible = false;
    }
    view.host.dataset.rootPlane = face;
    this.preview(center);
    const on = (type: string, fn: EventListener) => {
      window.addEventListener(type, fn, true);
      this.disposers.push(() => window.removeEventListener(type, fn, true));
    };
    on("pointermove", ((e: PointerEvent) => {
      if (e.target !== view.renderer.domElement) return;
      const p = this.point(e);
      this.marker.visible = !!p;
      if (p) this.preview(p);
    }) as EventListener);
    on("pointerdown", ((e: PointerEvent) => {
      if (e.target !== view.renderer.domElement || e.button !== 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const p = this.point(e);
      if (p) this.done(p);
    }) as EventListener);
    on("keydown", ((e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
      }
    }) as EventListener);
  }
  private render(p: readonly number[]) {
    const local = p.map(
      (n, i) => ((n - this.originTicks[i] * CANVAS_TICK) * 0.25) / this.step,
    );
    return new THREE.Vector3(local[0], local[2], -local[1]);
  }
  private point(e: PointerEvent): Vec3 | null {
    const hit = this.view
      .ray(e)
      .ray.intersectPlane(this.plane, new THREE.Vector3());
    if (!hit) return null;
    const world = canvasPointMeters(
        [hit.x, -hit.z, hit.y],
        this.step,
        this.originTicks,
      ),
      axes = rootFaceAxes[this.face],
      epsilon = 1e-7;
    if (
      [axes.u, axes.v].some(
        (i) =>
          world[i] < this.bounds.min[i] - epsilon ||
          world[i] > this.bounds.max[i] + epsilon,
      )
    )
      return null;
    return snapRootPoint(
      world,
      this.snap,
      this.step,
      this.originTicks.map((n) => n * CANVAS_TICK),
      this.face,
      this.bounds,
    );
  }
  private preview(p: Vec3) {
    this.marker.position.copy(this.render(p));
    this.view.host.dataset.rootPreview = p.join(",");
  }
  dispose() {
    for (const off of this.disposers) off();
    this.disposers = [];
    this.group.removeFromParent();
    this.group.traverse((o: any) => {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : [])
        m.dispose();
    });
    delete this.view.host.dataset.rootPlane;
    delete this.view.host.dataset.rootPreview;
    if (this.view.gizmo) {
      this.view.gizmo.enabled = this.previousGizmo;
      this.view.gizmo.getHelper().visible = this.previousHelper;
    }
  }
}
