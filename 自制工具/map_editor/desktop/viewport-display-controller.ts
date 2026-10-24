import * as T from "three";
import { ViewportMaterials } from "./viewport-materials.ts";
import { ViewportCavity, displayRole } from "./viewport-cavity.ts";
import {
  displayDefaults,
  effectiveDisplay,
  normalizeDisplay,
  preferenceKey,
  readDisplayPreferences,
  type DisplayState,
  type ViewportId,
} from "./viewport-display-state.ts";
export interface DisplayContext {
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.Camera;
  host: HTMLElement;
  id: ViewportId;
  target: () => T.Vector3;
  busy?: () => boolean;
  unit?: () => number;
  up?: T.Vector3;
  persist?: boolean;
}
export class ViewportDisplayController {
  state: DisplayState;
  readonly materials = new ViewportMaterials();
  readonly lights = new T.Group();
  onChange = () => {};
  private key = new T.DirectionalLight("white", 2.1);
  private fill = new T.DirectionalLight("white", 0.8);
  private ambient = new T.HemisphereLight("white", 0xa6a6a6, 1.4);
  private cavity: ViewportCavity | null = null;
  private cavityFailed = false;
  private edges = new Map<T.BufferGeometry, T.EdgesGeometry>();
  private edgeObjects = new Map<T.Mesh, T.LineSegments>();
  private edgeMaterial = new T.LineBasicMaterial({
    color: "#17191b",
    depthWrite: false,
  });
  private paintRestore: DisplayState | null = null;
  private painting = false;
  readonly context: DisplayContext;
  constructor(context: DisplayContext) {
    this.context = context;
    let raw = null;
    try {
      raw = localStorage.getItem(preferenceKey);
    } catch {}
    this.state =
      context.persist === false
        ? displayDefaults(context.id)
        : readDisplayPreferences(raw).views[context.id];
    this.lights.add(
      this.key,
      this.key.target,
      this.fill,
      this.fill.target,
      this.ambient,
    );
    context.scene.add(this.lights);
    context.renderer.outputColorSpace = T.SRGBColorSpace;
    context.renderer.toneMapping = T.NoToneMapping;
    context.renderer.localClippingEnabled = true;
  }
  get busy() {
    return this.context.busy?.() ?? false;
  }
  set(patch: Partial<DisplayState>, explicit = true) {
    if (this.busy) return false;
    if (explicit) this.paintRestore = null;
    const base =
      patch.preset && patch.preset !== this.state.preset
        ? {
            ...displayDefaults(this.context.id, patch.preset),
            background: this.state.background,
            grid: this.state.grid,
          }
        : this.state;
    this.state = normalizeDisplay({ ...base, ...patch }, this.context.id);
    if (this.context.persist !== false)
      try {
        const preferences = readDisplayPreferences(
          localStorage.getItem(preferenceKey),
        );
        preferences.views[this.context.id] = { ...this.state };
        localStorage.setItem(preferenceKey, JSON.stringify(preferences));
      } catch {}
    this.onChange();
    return true;
  }
  paintMode(active: boolean) {
    if (active === this.painting) return;
    this.painting = active;
    if (
      active &&
      (this.state.preset === "studio-gray" ||
        this.state.preset === "raking-gray")
    ) {
      this.paintRestore = { ...this.state };
      this.set({ preset: "albedo" }, false);
    } else if (!active && this.paintRestore) {
      const restore = this.paintRestore;
      this.paintRestore = null;
      this.set(restore, false);
    }
  }
  private light(state: DisplayState) {
    const { camera, target, up } = this.context,
      t = target(),
      vertical = (
        state.followCamera
          ? new T.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
          : (up ?? new T.Vector3(0, 1, 0))
      )
        .clone()
        .normalize();
    let front = state.followCamera
      ? camera.position.clone().sub(t).normalize()
      : new T.Vector3(0, 0, 1);
    if (Math.abs(front.dot(vertical)) > 0.98) front.set(1, 0, 0);
    let right = new T.Vector3().crossVectors(vertical, front).normalize();
    front.crossVectors(right, vertical).normalize();
    const angle = (state.rotation * Math.PI) / 180,
      dir = front
        .clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(right, Math.sin(angle));
    const rake = state.preset === "raking-gray";
    this.key.position
      .copy(t)
      .addScaledVector(dir, rake ? 6 : 3)
      .addScaledVector(right, rake ? -5 : -3)
      .addScaledVector(vertical, rake ? 2 : 7);
    this.key.target.position.copy(t);
    this.fill.position
      .copy(t)
      .addScaledVector(dir, -3)
      .addScaledVector(right, 4)
      .addScaledVector(vertical, 3);
    this.fill.target.position.copy(t);
    this.key.intensity = (rake ? 2.7 : 2) * state.brightness;
    this.fill.intensity = (rake ? 0.12 : 0.65) * state.brightness;
    this.ambient.intensity = (rake ? 0.35 : 1.5) * state.brightness;
    this.ambient.position.copy(vertical);
  }
  draw() {
    const { scene, renderer, camera, host } = this.context;
    if (!host.clientWidth || !host.clientHeight) return;
    camera.updateMatrixWorld();
    const state = effectiveDisplay(this.state);
    this.light(state);
    this.materials.clarity.value = state.voxelLines ? 1 : 0;
    scene.background = new T.Color(
      { dark: "#20252b", mid: "#60666c", light: "#c6cbcf" }[state.background],
    );
    host.dataset.displayPreset = state.preset;
    host.dataset.displayState = JSON.stringify(this.state);
    const saved: { node: any; visible: boolean; material: any }[] = [],
      oldLights: { light: T.Light; intensity: number }[] = [];
    const live = new Set<T.Mesh>();
    let transparent = false,
      special = false;
    scene.traverse((node: any) => {
      if (node.isLight && node.parent !== this.lights) {
        oldLights.push({ light: node, intensity: node.intensity });
        node.intensity = 0;
      }
      if (node.isMesh || node.isLine || node.isPoints) {
        saved.push({ node, visible: node.visible, material: node.material });
        const role = displayRole(node);
        if (node instanceof T.GridHelper) node.visible = state.grid;
        if (!node.isMesh || role === "auxiliary") return;
        if (
          role === "paint" &&
          (state.preset === "studio-gray" || state.preset === "raking-gray")
        ) {
          node.visible = false;
          return;
        }
        const source: T.Material[] = Array.isArray(node.material)
          ? node.material
          : [node.material];
        if (
          source.some(
            (m: any) =>
              m.isMeshPhysicalMaterial ||
              m.normalMap ||
              m.roughnessMap ||
              m.metalnessMap ||
              m.emissiveMap,
          )
        )
          special = true;
        if (role === "model") {
          live.add(node);
          let visible = true;
          for (
            let parent: T.Object3D | null = node;
            parent;
            parent = parent.parent
          )
            if (!parent.visible) visible = false;
          if (
            visible &&
            source.some(
              (m) => m.transparent || m.opacity < 1 || m.alphaTest > 0,
            )
          )
            transparent = true;
        }
        node.material = Array.isArray(node.material)
          ? source.map((m) =>
              this.materials.get(m, state.preset, role === "paint"),
            )
          : this.materials.get(source[0], state.preset, role === "paint");
      }
    });
    host.dataset.displayMaterialNote = special
      ? "特殊 PBR 材质以基础色哑光观察"
      : "";
    // Edges are lazy and reuse geometry; toggles never rebuild author geometry.
    for (const [mesh, line] of this.edgeObjects)
      if (!live.has(mesh)) {
        line.removeFromParent();
        this.edgeObjects.delete(mesh);
      }
    for (const mesh of live) {
      let line = this.edgeObjects.get(mesh);
      if (state.structureEdges && !line) {
        let geometry = this.edges.get(mesh.geometry);
        if (!geometry) {
          geometry = new T.EdgesGeometry(mesh.geometry, 30);
          this.edges.set(mesh.geometry, geometry);
          const release = () => {
            geometry!.dispose();
            this.edges.delete(mesh.geometry);
            mesh.geometry.removeEventListener("dispose", release);
          };
          mesh.geometry.addEventListener("dispose", release);
          geometry.userData.release = release;
        }
        line = new T.LineSegments(geometry, this.edgeMaterial);
        line.userData.viewportRole = "auxiliary";
        line.raycast = () => {};
        mesh.add(line);
        this.edgeObjects.set(mesh, line);
      }
      if (line) line.visible = state.structureEdges;
    }
    try {
      if (state.cavity !== "off" && !transparent && !this.cavityFailed) {
        try {
          this.cavity ??= new ViewportCavity(renderer, scene, camera);
          this.cavity.draw(state.cavity, this.context.unit?.() ?? 0.25);
          host.dataset.cavityStatus = state.cavity;
        } catch (error) {
          this.cavityFailed = true;
          console.warn("凹槽增强未启用", error);
          host.dataset.cavityStatus = "凹槽增强未启用";
          renderer.render(scene, camera);
        }
      } else {
        renderer.render(scene, camera);
        host.dataset.cavityStatus =
          this.cavityFailed && state.cavity !== "off"
            ? "凹槽增强未启用"
            : transparent && state.cavity !== "off"
              ? "透明/裁切材质暂停增强"
              : "off";
      }
    } finally {
      for (const item of saved) {
        item.node.material = item.material;
        item.node.visible = item.visible;
      }
      for (const item of oldLights) item.light.intensity = item.intensity;
    }
  }
  dispose() {
    this.lights.removeFromParent();
    this.cavity?.dispose();
    this.materials.dispose();
    for (const line of this.edgeObjects.values()) line.removeFromParent();
    for (const g of [...this.edges.values()]) g.userData.release();
    this.edgeMaterial.dispose();
  }
}
