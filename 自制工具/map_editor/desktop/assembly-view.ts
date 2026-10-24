import { canvasParts, CANVAS_TICK } from "../core/workshop-canvases.ts";
import * as THREE from "three";
import {SurfacePaintLayer} from './surface-paint-layer.ts';
import {ViewportDisplayController} from './viewport-display-controller.ts';
import {mountDisplayMenu} from './viewport-display-ui.ts';
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { snapInstancePosition } from "../core/scene-drag.ts";
import { meshMap } from "../core/mesher.ts";
import { sourceToThree } from "../core/coordinates.ts";
import type {
  AssetDocument,
  SceneDocument,
} from "../core/workshop-documents.ts";

function geometry(asset: AssetDocument) {
  const positions: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  for (const c of canvasParts(asset))
    for (const q of meshMap({ ...asset, cells: c.cells })) {
      const axes = [0, 1, 2].filter((a) => a !== q.axis),
        base = positions.length / 3,
        color = new THREE.Color(asset.palette[q.color]);
      for (const [a, b] of [
        [q.a, q.b],
        [q.a + q.w, q.b],
        [q.a + q.w, q.b + q.h],
        [q.a, q.b + q.h],
      ]) {
        const p = [0, 0, 0];
        p[q.axis] = q.plane;
        p[axes[0]] = a;
        p[axes[1]] = b;
        positions.push(
          ...sourceToThree(
            p.map(
              (n, i) => n * c.voxelStepM + c.originTicks[i] * CANVAS_TICK,
            ) as [number, number, number],
          ),
        );
        colors.push(color.r, color.g, color.b);
      }
      const order =
        q.sign === (q.axis === 1 ? -1 : 1)
          ? [0, 1, 2, 0, 2, 3]
          : [0, 2, 1, 0, 3, 2];
      indices.push(...order.map((i) => base + i));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Structural edges use face normals, so palette/chunk seams never become grid lines. */
export function modelEdgeGeometry(asset: AssetDocument): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const canvas of canvasParts(asset)) {
    const segments = new Map<
      string,
      { axis: number; point: number[]; normals: number }
    >();
    for (const face of meshMap({ ...asset, cells: canvas.cells })) {
      const [u, v] = [0, 1, 2].filter((axis) => axis !== face.axis);
      const edge = (
        axis: number,
        other: number,
        start: number,
        end: number,
        fixed: number,
      ) => {
        for (let value = start; value < end; value++) {
          const point = [0, 0, 0];
          point[face.axis] = face.plane;
          point[axis] = value;
          point[other] = fixed;
          const key = axis + ":" + point.join(","),
            entry = segments.get(key);
          if (entry) entry.normals |= 1 << face.axis;
          else segments.set(key, { axis, point, normals: 1 << face.axis });
        }
      };
      edge(u, v, face.a, face.a + face.w, face.b);
      edge(u, v, face.a, face.a + face.w, face.b + face.h);
      edge(v, u, face.b, face.b + face.h, face.a);
      edge(v, u, face.b, face.b + face.h, face.a + face.w);
    }
    const lines = new Map<
      string,
      { axis: number; point: number[]; values: number[] }
    >();
    for (const { axis, point, normals } of segments.values()) {
      if ((normals & (normals - 1)) === 0) continue;
      const key = axis + ":" + point.filter((_, i) => i !== axis).join(",");
      let line = lines.get(key);
      if (!line) {
        line = { axis, point, values: [] };
        lines.set(key, line);
      }
      line.values.push(point[axis]);
    }
    for (const { axis, point, values } of lines.values()) {
      values.sort((a, b) => a - b);
      for (let i = 0; i < values.length; ) {
        const start = values[i];
        let end = start + 1;
        while (++i < values.length && values[i] === end) end++;
        for (const value of [start, end]) {
          const p = [...point];
          p[axis] = value;
          positions.push(
            ...sourceToThree(
              p.map(
                (n, j) =>
                  n * canvas.voxelStepM + canvas.originTicks[j] * CANVAS_TICK,
              ) as [number, number, number],
            ),
          );
        }
      }
    }
  }
  const edges = new THREE.BufferGeometry();
  edges.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return edges;
}

/** One cached geometry per module; instance deletion never disposes a shared source. */
export class AssemblyView {
  display:ViewportDisplayController;
  private displayMenu:{dispose:()=>void};
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
  private renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  private controls: OrbitControls;
  private transform: TransformControls;
  private cancelled = false;
  private skipClick = false;
  private currentDoc: SceneDocument | undefined;
  private currentAssets = new Map<string, AssetDocument>();
  private selectedIds = new Set<string>();
  private selectionBox = document.createElement("div");
  private boxStart: { x: number; y: number; pointerId: number } | undefined;
  onSelectMany = (ids: string[], additive: boolean, subtract = false) => {};
  private ray(clientX: number, clientY: number) {
    const r = this.renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - r.left) / r.width) * 2 - 1,
        (-(clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    return ray;
  }
  dropPosition(clientX: number, clientY: number): [number, number, number] {
    const point = this.ray(clientX, clientY).ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    return point ? [point.x, -point.z, 0] : [0, 0, 0];
  }
  private boxDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    // Resolve the handle at pointer-down so a stale hover cannot steal a box gesture.
    if (this.transform.object && this.transform.enabled) {
      const r = this.renderer.domElement.getBoundingClientRect();
      this.transform.pointerHover({
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: (-(e.clientY - r.top) / r.height) * 2 + 1,
        button: e.button,
      } as PointerEvent);
      if (this.transform.axis) return;
    }
    this.down = [e.clientX, e.clientY];
    this.skipClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.cancelDrag();
    this.boxStart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    this.controls.enabled = false;
    this.transform.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.selectionBox.hidden = true;
    this.boxMove(e);
  };
  private boxMove = (e: PointerEvent) => {
    const start = this.boxStart;
    if (!start) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.selectionBox.hidden =
      Math.hypot(start.x - e.clientX, start.y - e.clientY) < 5;
    const r = this.host.getBoundingClientRect();
    Object.assign(this.selectionBox.style, {
      left: `${Math.min(start.x, e.clientX) - r.left}px`,
      top: `${Math.min(start.y, e.clientY) - r.top}px`,
      width: `${Math.abs(start.x - e.clientX)}px`,
      height: `${Math.abs(start.y - e.clientY)}px`,
    });
  };
  private boxUp = (e: PointerEvent) => {
    const start = this.boxStart;
    if (!start) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (Math.hypot(start.x - e.clientX, start.y - e.clientY) < 5) {
      this.cancelBox();
      this.click(e);
      return;
    }
    const r = this.renderer.domElement.getBoundingClientRect(),
      left = Math.min(start.x, e.clientX),
      right = Math.max(start.x, e.clientX),
      top = Math.min(start.y, e.clientY),
      bottom = Math.max(start.y, e.clientY),
      ids: string[] = [];
    this.objects.updateMatrixWorld(true);
    for (const object of this.objects.children) {
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) continue;
      const screen = box.getCenter(new THREE.Vector3()).project(this.camera),
        x = r.x + ((screen.x + 1) * r.width) / 2,
        y = r.y + ((1 - screen.y) * r.height) / 2;
      if (
        screen.z >= -1 &&
        screen.z <= 1 &&
        x >= left &&
        x <= right &&
        y >= top &&
        y <= bottom
      )
        ids.push(object.userData.instanceId);
    }
    this.cancelBox();
    this.onSelectMany(ids, e.shiftKey, e.ctrlKey || e.metaKey);
  };
  private cancelBox() {
    if (!this.boxStart) return;
    const id = this.boxStart.pointerId;
    this.boxStart = undefined;
    this.selectionBox.hidden = true;
    this.controls.enabled = true;
    this.transform.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(id))
      this.renderer.domElement.releasePointerCapture(id);
  }
  onTransform = (
    id: string,
    position: [number, number, number],
    revision: number,
  ) => {};
  cancelDrag() {
    this.cancelBox();
    if (this.transform?.dragging) {
      this.cancelled = true;
      this.transform.reset();
      this.transform.pointerUp(null);
    }
  }
  private escape = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.cancelDrag();
  };
  private blur = () => this.cancelDrag();
  private objects = new THREE.Group();
  private binaryCache = new Map<
    string,
    {
      data: string;
      object?: THREE.Object3D;
      texture?: THREE.Texture;
      error?: string;
      ready?: boolean;
    }
  >();
  assetStatus() {
    return {
      loading: [...this.binaryCache.values()].filter(
        (c) => !c.ready && !c.error,
      ).length,
      errors: [...this.binaryCache.values()]
        .filter((c) => c.error)
        .map((c) => c.error!),
    };
  }
  private decalGeometry = new THREE.PlaneGeometry(1, 1);
  private instances = new Map<
    string,
    {
      group: THREE.Group;
      source: unknown;
      kind: string;
      material?: THREE.Material;
      paint?: SurfacePaintLayer;
    }
  >();
  private modelEdges = false;
  private edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    depthWrite: false,
  });
  private externalEdges = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
  setModelEdges(enabled: boolean) {
    this.modelEdges = enabled;
    for (const entry of this.instances.values())
      if (entry.kind === "model") this.updateEdges(entry.group);
  }
  private updateEdges(group: THREE.Group) {
    const voxel = this.cache.get(group.userData.assetId);
    const meshes: THREE.Mesh[] = [];
    group.traverse((node) => {
      if (node instanceof THREE.Mesh && !node.userData.surfacePaint) meshes.push(node);
    });
    for (const mesh of meshes) {
      let line = mesh.children.find((child) => child.userData.modelEdge) as
        | THREE.LineSegments
        | undefined;
      if (!line && this.modelEdges && mesh.geometry !== this.missing) {
        let edges: THREE.BufferGeometry;
        if (voxel && mesh.geometry === voxel.geometry)
          edges = voxel.edges ??= modelEdgeGeometry(voxel.asset);
        else {
          let cached = this.externalEdges.get(mesh.geometry);
          if (!cached) {
            cached = new THREE.EdgesGeometry(mesh.geometry, 30);
            this.externalEdges.set(mesh.geometry, cached);
          }
          edges = cached;
        }
        line = new THREE.LineSegments(edges, this.edgeMaterial);
        line.userData.modelEdge = true;
        line.raycast = () => {};
        line.renderOrder = 1;
        mesh.add(line);
        for (const material of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) {
          material.polygonOffset = true;
          material.polygonOffsetFactor = 1;
          material.polygonOffsetUnits = 1;
        }
      }
      if (line) line.visible = this.modelEdges;
    }
  }
  onAssetLoaded = () => {};
  onError = (error: string) => {};
  private disposeModel(object: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        geometries.add(node.geometry);
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material])
          materials.add(m);
      }
    });
    for (const m of materials) {
      for (const v of Object.values(m))
        if (v instanceof THREE.Texture) textures.add(v);
      m.dispose();
    }
    for (const g of geometries) {
      this.externalEdges.get(g)?.dispose();
      this.externalEdges.delete(g);
      g.dispose();
    }
    for (const t of textures) t.dispose();
  }
  private binary(id: string, payload: { row: any; data: string }) {
    let entry = this.binaryCache.get(id);
    if (entry?.data === payload.data) return entry;
    if (entry?.object) this.disposeModel(entry.object);
    entry?.texture?.dispose();
    entry = { data: payload.data };
    this.binaryCache.set(id, entry);
    const owned = entry;
    if (payload.row.kind === "texture") {
      const texture = new THREE.TextureLoader().load(
        `data:image/png;base64,${payload.data}`,
        () => {
          owned.ready = true;
          if (this.binaryCache.get(id) === owned) this.onAssetLoaded();
          else texture.dispose();
        },
        undefined,
        () => {
          if (this.binaryCache.get(id) !== owned) return;
          owned.error = "PNG无法解码";
          this.onError(owned.error);
          this.onAssetLoaded();
        },
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      entry.texture = texture;
    } else {
      const raw = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));
      new GLTFLoader().parse(
        raw.buffer,
        "",
        (gltf) => {
          if (this.binaryCache.get(id) !== owned) {
            this.disposeModel(gltf.scene);
            return;
          }
          owned.object = gltf.scene;
          owned.ready = true;
          this.onAssetLoaded();
        },
        (error) => {
          if (this.binaryCache.get(id) !== owned) return;
          owned.error = `GLB无法显示：${error instanceof Error ? error.message : String(error)}`;
          this.onError(owned.error);
          this.onAssetLoaded();
        },
      );
    }
    return entry;
  }
  private cache = new Map<
    string,
    {
      key: string;
      geometry: THREE.BufferGeometry;
      asset: AssetDocument;
      edges?: THREE.BufferGeometry;
    }
  >();
  private material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
  });
  private missingMaterial = new THREE.MeshBasicMaterial({
    color: 0xe45b76,
    wireframe: true,
  });
  private missing = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  private highlight = new THREE.Box3Helper(new THREE.Box3(), 0xe3ad55);
  private observer: ResizeObserver;
  private frame = 0;
  private down: [number, number] = [0, 0];
  private click = (e: PointerEvent) => {
    if (this.skipClick) {
      this.skipClick = false;
      return;
    }
    if (
      e.button !== 0 ||
      Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]) > 5
    )
      return;
    const r = this.renderer.domElement.getBoundingClientRect(),
      ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = ray.intersectObjects(this.objects.children, true)[0];
    let obj: THREE.Object3D | null | undefined = hit?.object;
    while (obj && !obj.userData.instanceId) obj = obj.parent;
    this.onSelect(
      obj?.userData.instanceId ?? "",
      e.shiftKey,
      e.ctrlKey || e.metaKey,
    );
  };
  private pointerDown = (e: PointerEvent) => {
    this.down = [e.clientX, e.clientY];
  };
  onSelect = (id: string, additive = false, subtract = false) => {};
  constructor(privateHost: HTMLElement) {
    this.host = privateHost;
    const uiColor = (token: string, fallback: string) =>
      getComputedStyle(document.documentElement)
        .getPropertyValue(token)
        .trim() || fallback;
    this.scene.background = new THREE.Color(
      uiColor("--viewport-preview", "#20313d"),
    );
    this.camera.position.set(6, 6, 8);
    this.host.append(this.renderer.domElement);
    this.selectionBox.className = "assembly-selection-box";
    this.selectionBox.hidden = true;
    this.host.append(this.selectionBox);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.mouseButtons = {
      LEFT: null as any,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.transform = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.transform.setMode("translate");
    this.transform.setSpace("world");
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
      if (!e.value) this.onAssetLoaded();
    });
    this.transform.addEventListener("mouseDown", () => {
      this.cancelled = false;
      this.skipClick = true;
    });
    this.transform.addEventListener("objectChange", () => {
      const object = this.transform.object;
      if (!object || !this.currentDoc) return;
      const p = this.currentDoc.instances.find(
          (p) => p.instanceId === object.userData.instanceId,
        ),
        asset = p ? this.currentAssets.get(p.assetId) : undefined;
      if (p && asset) {
        const v = object.position;
        object.position.fromArray(
          sourceToThree(
            snapInstancePosition(
              [v.x, -v.z, v.y],
              asset.anchorM,
              p.rotationDeg,
            ),
          ),
        );
      }
      const base =
        this.currentDoc.instances.find(
          (p) => p.instanceId === object.userData.instanceId,
        ) ??
        this.currentDoc.decals.find(
          (d) => d.decalId === object.userData.instanceId,
        );
      if (base) {
        const start = new THREE.Vector3().fromArray(
          sourceToThree(base.positionM),
        );
        if ("decalId" in base) start.y += 0.003;
        let delta = object.position.clone().sub(start);
        if (
          this.selectedIds.size > 1 &&
          this.currentDoc.instances.some(
            (p) =>
              this.selectedIds.has(p.instanceId) &&
              this.currentAssets.has(p.assetId),
          )
        )
          delta.set(
            Math.round(delta.x / 0.25) * 0.25,
            Math.round(delta.y / 0.25) * 0.25,
            Math.round(delta.z / 0.25) * 0.25,
          );
        object.position.copy(start).add(delta);
        for (const other of this.objects.children)
          if (
            other !== object &&
            this.selectedIds.has(other.userData.instanceId)
          ) {
            const p =
              this.currentDoc.instances.find(
                (p) => p.instanceId === other.userData.instanceId,
              ) ??
              this.currentDoc.decals.find(
                (d) => d.decalId === other.userData.instanceId,
              );
            if (p) {
              other.position.fromArray(sourceToThree(p.positionM));
              if ("decalId" in p) other.position.y += 0.003;
              other.position.add(delta);
            }
          }
      }
      this.objects.updateMatrixWorld(true);
      this.highlight.box.makeEmpty();
      for (const selected of this.objects.children)
        if (this.selectedIds.has(selected.userData.instanceId))
          this.highlight.box.union(new THREE.Box3().setFromObject(selected));
    });
    this.transform.addEventListener("mouseUp", () => {
      if (this.cancelled) return;
      const object = this.transform.object;
      if (!object || !this.currentDoc) return;
      const pos = object.position;
      const id = object.userData.instanceId;
      const decal = this.currentDoc.decals.some((d) => d.decalId === id);
      this.onTransform(
        id,
        [pos.x, -pos.z, pos.y - (decal ? 0.003 : 0)],
        this.currentDoc.revision,
      );
    });
    window.addEventListener("keydown", this.escape);
    window.addEventListener("blur", this.blur);
    const grid = new THREE.GridHelper(
      32,
      128,
      uiColor("--grid-major", "#617d89"),
      uiColor("--grid-minor", "#344e5c"),
    );
    grid.renderOrder = -100;
    this.scene.add(
      this.objects,
      grid,
      new THREE.HemisphereLight(0xf1f4f8, 0x58616a, 2),
    );
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(4, 8, 5);
    this.scene.add(sun, this.highlight);
    this.highlight.visible = false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.click);
    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.boxDown,
      true,
    );
    this.renderer.domElement.addEventListener(
      "pointermove",
      this.boxMove,
      true,
    );
    this.renderer.domElement.addEventListener("pointerup", this.boxUp, true);
    this.renderer.domElement.addEventListener("pointercancel", this.blur);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.host);
    this.display=new ViewportDisplayController({renderer:this.renderer,scene:this.scene,camera:this.camera,host:this.host,id:'assembly',target:()=>this.controls.target,busy:()=>this.transform.dragging,unit:()=>Math.min(.25,...[...this.currentAssets.values()].flatMap(a=>canvasParts(a).map(c=>c.voxelStepM)))});
    this.displayMenu=mountDisplayMenu(this.display,this.host);
    const draw = () => {
      if (this.host.offsetParent) {
        this.controls.update();
        this.display.draw();
      }
      this.frame = requestAnimationFrame(draw);
    };
    draw();
  }
  private host: HTMLElement;
  private viewportSize = [0, 0];
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h || (w === this.viewportSize[0] && h === this.viewportSize[1]))
      return;
    this.viewportSize = [w, h];
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  update(
    doc: SceneDocument,
    assets: Map<string, AssetDocument>,
    selected: string[],
    binaries: Map<string, { row: any; data: string }> = new Map(),
  ) {
    if (this.transform.dragging) return;
    this.transform.detach();
    this.currentDoc = structuredClone(doc);
    this.currentAssets = assets;
    this.selectedIds = new Set(selected);
    const registered = new Set(doc.assets.map((a) => a.assetId));
    for (const [id, c] of this.binaryCache)
      if (!binaries.has(id) || !registered.has(id)) {
        if (c.object) this.disposeModel(c.object);
        c.texture?.dispose();
        this.binaryCache.delete(id);
      }
    for (const [id, c] of this.cache)
      if (!assets.has(id)) {
        c.geometry.dispose();
        c.edges?.dispose();
        this.cache.delete(id);
      }
    // Source changes are checked once per asset, never once per scene instance.
    const sources = new Map<string, THREE.BufferGeometry>();
    for (const [id, asset] of assets) {
      const key = JSON.stringify([
        asset.canvases ?? asset.cells,
        asset.palette,
        asset.sideColor,
      ]);
      let cached = this.cache.get(id);
      if (!cached || cached.key !== key) {
        cached?.geometry.dispose();
        cached?.edges?.dispose();
        cached = { key, geometry: geometry(asset), asset };
        this.cache.set(id, cached);
      }
      sources.set(id, cached.geometry);
    }
    const visibleGroups = new Set(
        doc.groups.filter((g) => g.visible).map((g) => g.groupId),
      ),
      live = new Set<string>();
    const remove = (id: string) => {
      const entry = this.instances.get(id);
      if (entry) {
        this.objects.remove(entry.group);
        entry.material?.dispose();
        entry.paint?.dispose();
        this.instances.delete(id);
      }
    };
    for (const p of doc.instances) {
      if (!visibleGroups.has(p.groupId)) continue;
      live.add(p.instanceId);
      const asset = assets.get(p.assetId),
        binary = binaries.get(p.assetId),
        external = binary ? this.binary(p.assetId, binary) : undefined;
      const source = external?.object ?? sources.get(p.assetId) ?? this.missing;
      let entry = this.instances.get(p.instanceId);
      if (!entry || entry.source !== source || entry.kind !== "model") {
        remove(p.instanceId);
        const group = new THREE.Group(),
          mesh =
            source instanceof THREE.Object3D
              ? source.clone(true)
              : new THREE.Mesh(
                  source,
                  asset ? this.material : this.missingMaterial,
                );
        group.userData.instanceId = p.instanceId;
        if(asset||source instanceof THREE.Object3D)mesh.userData.viewportRole='model';
        group.userData.assetId = p.assetId;
        group.add(mesh);
        entry = { group, source, kind: "model" };
        if(asset){entry.paint=new SurfacePaintLayer(mesh);entry.paint.update(asset);}
        this.instances.set(p.instanceId, entry);
        this.objects.add(group);
        this.updateEdges(group);
      }
      const group = entry.group,
        mesh = group.children[0];
      if (source instanceof THREE.Object3D) mesh.position.copy(source.position);
      else mesh.position.set(0, 0, 0);
      if (asset)
        mesh.position
          .fromArray(sourceToThree(asset.anchorM))
          .multiplyScalar(-1);
      else if (binary?.row.kind === "external" && external?.object)
        mesh.position.sub(
          new THREE.Vector3().fromArray(sourceToThree(binary.row.anchorM)),
        );
      group.position.fromArray(sourceToThree(p.positionM));
      group.rotation.y = (p.rotationDeg * Math.PI) / 180;
    }
    for (const d of doc.decals) {
      live.add(d.decalId);
      const payload = binaries.get(d.assetId),
        binary = payload ? this.binary(d.assetId, payload) : undefined;
      const source =
        binary?.texture && !binary.error ? binary.texture : this.missing;
      let entry = this.instances.get(d.decalId);
      if (!entry || entry.source !== source || entry.kind !== "decal") {
        remove(d.decalId);
        const material =
          source instanceof THREE.Texture
            ? new THREE.MeshBasicMaterial({
                map: source,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
              })
            : this.missingMaterial;
        const group = new THREE.Group(),
          mesh = new THREE.Mesh(
            source instanceof THREE.Texture ? this.decalGeometry : this.missing,
            material,
          );
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        group.userData.instanceId = d.decalId;
        entry = {
          group,
          source,
          kind: "decal",
          ...(material !== this.missingMaterial ? { material } : {}),
        };
        this.instances.set(d.decalId, entry);
        this.objects.add(group);
      }
      const group = entry.group;
      group.children[0].scale.set(d.widthM, d.heightM, 1);
      group.position.fromArray(sourceToThree(d.positionM));
      group.position.y += 0.003;
      group.rotation.y = (d.rotationDeg * Math.PI) / 180;
    }
    for (const id of this.instances.keys()) if (!live.has(id)) remove(id);
    const selectedObject = this.objects.children.find((o) =>
      this.selectedIds.has(o.userData.instanceId),
    );
    this.objects.updateMatrixWorld(true);
    this.highlight.visible = !!selectedObject;
    this.highlight.box.makeEmpty();
    for (const object of this.objects.children)
      if (this.selectedIds.has(object.userData.instanceId))
        this.highlight.box.union(new THREE.Box3().setFromObject(object));
    if (selectedObject) this.transform.attach(selectedObject);
    this.resize();
  }
  fit() {
    const box = new THREE.Box3().setFromObject(this.objects);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(1, 1, 1.3)
          .normalize()
          .multiplyScalar(Math.max(3, size * 1.3)),
      );
    this.controls.update();
  }
  dispose() {
    this.displayMenu.dispose();this.display.dispose();
    this.cancelDrag();
    this.transform.dispose();
    window.removeEventListener("keydown", this.escape);
    window.removeEventListener("blur", this.blur);
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.click);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.boxDown,
      true,
    );
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.boxMove,
      true,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.boxUp, true);
    this.renderer.domElement.removeEventListener("pointercancel", this.blur);
    this.selectionBox.remove();
    for (const c of this.cache.values()) {
      c.geometry.dispose();
      c.edges?.dispose();
    }
    for (const c of this.binaryCache.values()) {
      if (c.object) this.disposeModel(c.object);
      c.texture?.dispose();
    }
    this.binaryCache.clear();
    this.decalGeometry.dispose();
    for (const entry of this.instances.values()) {entry.material?.dispose();entry.paint?.dispose();}
    this.instances.clear();
    for (const edges of this.externalEdges.values()) edges.dispose();
    this.externalEdges.clear();
    this.edgeMaterial.dispose();
    this.missing.dispose();
    this.material.dispose();
    this.missingMaterial.dispose();
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.GridHelper) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
