import {referenceLayout} from "../core/references.ts";
import {ReferenceView} from "./reference-view.ts";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { type Quad } from "../core/mesher.ts";
import { pickSurface, visibleTopLabels } from "../core/surface.ts";
export class MapView {
  reference = new ReferenceView();
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  terrain = new THREE.Group();
  objects = new THREE.Group();
  overlays = new THREE.Group();
  ghost: THREE.Mesh;
  rectangleGhost: THREE.Mesh;
  cache = new Map<string, THREE.Object3D>();
  textures = new Map<string, THREE.Texture>();
  revision = 0;
  onError = (message: string) => {};
  flat = false;
  stats = { quads: 0 };
  zLabels = false;
  labelDoc: any = null;
  labelLayer: HTMLDivElement;
  labelTime = 0;
  observer: ResizeObserver;
  disposed=false;
  rootMarker=new THREE.AxesHelper(.7);
  constructor(
    public host: HTMLElement,
    public editable: boolean,
  ) {
    this.scene.background = new THREE.Color(editable ? "#d3dfe2" : "#202d39");
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 500);
    this.camera.position.set(editable ? 0 : 0, 9, 8);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "z-label-layer";
    host.append(this.labelLayer);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = false;
    if (editable)
      this.controls.mouseButtons = {
        LEFT: null as any,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    this.scene.add(new THREE.HemisphereLight("#e9f3ff", "#657581", 2.4));
    const sun = new THREE.DirectionalLight("#ffe4b0", 2.8);
    sun.position.set(-3, 8, 4);
    this.scene.add(sun);
    this.scene.add(this.terrain, this.objects, this.overlays,this.reference.group);
    this.reference.onError=(text)=>this.onError(text);
    const grid = new THREE.GridHelper(
      32,
      editable ? 128 : 32,
      editable ? "#8199a4" : "#385160",
      editable ? "#a4b9c0" : "#304653",
    );
    grid.position.y = -0.008;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = editable ? 0.38 : 0.3;
    this.scene.add(grid);
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.035, 0.25),
      new THREE.MeshBasicMaterial({
        color: "#d48b31",
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.rectangleGhost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.012, 1),
      new THREE.MeshBasicMaterial({ color: "#e6a655", transparent: true, opacity: 0.34,
        depthWrite: false, side: THREE.DoubleSide }),
    );
    this.rectangleGhost.visible = false;
    this.rectangleGhost.renderOrder = 8;
    this.scene.add(this.rectangleGhost);
    this.rootMarker.visible=false;this.rootMarker.rotation.x=-Math.PI/2;this.scene.add(this.rootMarker);
    this.observer=new ResizeObserver(() => this.resize());this.observer.observe(host);
    this.resize();
    this.controls.update();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.left = (-5 * w) / h;
    this.camera.right = (5 * w) / h;
    this.camera.top = 5;
    this.camera.bottom = -5;
    this.camera.updateProjectionMatrix();
  }
  draw() {
    if(this.disposed)return;
    this.controls.update();
    this.reference.faceCamera(this.camera);
    this.renderer.render(this.scene, this.camera);
    if (this.zLabels && performance.now() - this.labelTime > 120) {
      this.labelTime = performance.now();
      this.refreshZLabels();
    }
  }
  setRoot(root?:[number,number,number]){this.rootMarker.visible=!!root;if(root)this.rootMarker.position.set(root[0],root[2],-root[1]);}
  setZLabels(enabled: boolean) {
    this.zLabels = enabled;
    if (!enabled) this.labelLayer.replaceChildren();
    else this.refreshZLabels();
  }
  refreshZLabels() {
    if (!this.zLabels || !this.labelDoc) return;
    const width = this.host.clientWidth, height = this.host.clientHeight;
    const labels = visibleTopLabels(this.labelDoc.cells, this.section);
    const fragment = document.createDocumentFragment();
    let shown = 0;
    for (const c of labels) {
      if (shown >= 180) break;
      const p = new THREE.Vector3((c.x + 0.5) * 0.25, c.top * 0.25 + 0.006, -(c.y + 0.5) * 0.25).project(this.camera);
      if (Math.abs(p.x) > 0.96 || Math.abs(p.y) > 0.94 || p.z < -1 || p.z > 1) continue;
      const b = document.createElement("span");
      b.className = "z-label";
      b.textContent = `Z ${c.top}`;
      b.title = `顶面 Z ${c.top} · ${(c.top * 0.25).toFixed(2)} 米 · 实体层 ${c.layer}`;
      b.style.left = `${(p.x * 0.5 + 0.5) * width}px`;
      b.style.top = `${(-p.y * 0.5 + 0.5) * height}px`;
      fragment.append(b); shown++;
    }
    this.labelLayer.replaceChildren(fragment);
  }
  section: number | null = null;
  setSection(z: number | null) {
    this.section = z;
    this.renderer.clippingPlanes =
      z == null ? [] : [new THREE.Plane(new THREE.Vector3(0, -1, 0), z * 0.25 + 0.001)];
    this.refreshZLabels();
  }
  top() {
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3(0, 10, 0.001));
    this.controls.update();
  }
  home() {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, 9, 8);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  fit(doc: any) {
    if (!doc.cells.length && !doc.editor?.reference?.visible) {
      this.home();
      return;
    }
    const box = new THREE.Box3();
    for (const c of doc.cells) {
      box.expandByPoint(new THREE.Vector3(c.x * 0.25, c.z * 0.25, -c.y * 0.25));
      box.expandByPoint(
        new THREE.Vector3(
          (c.x + 1) * 0.25,
          (c.z + 1) * 0.25,
          -(c.y + 1) * 0.25,
        ),
      );
    }
    const ref=doc.editor?.reference;
    if(ref?.visible){const layout=referenceLayout(ref),r=layout.width;box.expandByPoint(new THREE.Vector3(ref.x-r,ref.z+layout.offsetY-layout.height/2,-ref.y-r));box.expandByPoint(new THREE.Vector3(ref.x+r,ref.z+layout.offsetY+layout.height/2,-ref.y+r));}
    const center = box.getCenter(new THREE.Vector3()),
      radius = Math.max(1, box.getSize(new THREE.Vector3()).length() / 2);
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(0, 9, 8)
          .normalize()
          .multiplyScalar(Math.max(13, radius * 2.5)),
      );
    this.camera.far = Math.max(500, radius * 6);
    this.camera.zoom = 5 / (radius * 1.15);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  ray(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      ),
      this.camera,
    );
    return ray;
  }
  hit(e: PointerEvent, height: number, surface = false, cells?: Map<string, any>, bounds?: {min:number[];max:number[]}) {
    const ray = this.ray(e);
    let p: THREE.Vector3 | null = null,
      face = 4;
    if (surface) {
      if (cells) {
        const o = ray.ray.origin, d = ray.ray.direction;
        return pickSurface(cells,
          [o.x / 0.25, -o.z / 0.25, o.y / 0.25],
          [d.x / 0.25, -d.z / 0.25, d.y / 0.25], this.section, bounds);
      }
      const hit = ray
        .intersectObjects(this.terrain.children, false)
        .find(
          (h) =>
            this.section == null || h.point.y <= this.section * 0.25 + 0.0001,
        );
      if (hit) {
        p = hit.point;
        const n = hit.face!.normal;
        face =
          Math.abs(n.x) > 0.5
            ? n.x > 0
              ? 0
              : 1
            : Math.abs(n.z) > 0.5
              ? n.z < 0
                ? 2
                : 3
              : n.y > 0
                ? 4
                : 5;
      }
      if (!p) return null;
    }
    if (!p)
      p = ray.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -height * 0.25),
        new THREE.Vector3(),
      );
    if (!p) return null;
    const coords = [p.x / 0.25, -p.z / 0.25, p.y / 0.25].map((v, i) =>
      i === Math.floor(face / 2) ? Math.round(v) : Math.floor(v + 0.00001),
    );
    return { x: coords[0], y: coords[1], z: coords[2], point: p, face };
  }
  brushGhost: THREE.InstancedMesh | null = null;
  brushPreview(points:any[], surface=false) {
    if(this.brushGhost){this.scene.remove(this.brushGhost);this.brushGhost.dispose();this.brushGhost.geometry.dispose();(this.brushGhost.material as THREE.Material).dispose();this.brushGhost=null;}
    if(!points.length)return;
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.245,surface?.015:.245,.245),new THREE.MeshBasicMaterial({transparent:true,opacity:.32,depthWrite:false}),points.length);
    const matrix=new THREE.Matrix4();
    points.forEach((p,i)=>{matrix.makeTranslation((p.x+.5)*.25,(p.z+(surface?0:.5))*.25,-(p.y+.5)*.25);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,new THREE.Color(p.status==='skipped'?'#ed5864':p.status==='noop'?'#95a1a8':'#eab65e'));});
    mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.frustumCulled=false;this.brushGhost=mesh;this.scene.add(mesh);
  }
  planeHit(e:PointerEvent,hit:any){
    const axis=Math.floor(hit.face/2), source=[hit.x,hit.y,hit.z], normal=axis===0?new THREE.Vector3(1,0,0):axis===1?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0);
    const p=this.ray(e).ray.intersectPlane(new THREE.Plane(normal,-source[axis]*.25),new THREE.Vector3());if(!p)return null;
    const a=[p.x/.25,-p.z/.25,p.y/.25].map((v,i)=>i===axis?source[i]:Math.floor(v+.00001));return {x:a[0],y:a[1],z:a[2],face:hit.face};
  }
  hover(hit: any, height: number) {
    this.ghost.visible = !!hit;
    if (hit) {
      const face = hit.face ?? 4;
      this.ghost.rotation.set(0, 0, 0);
      if (face < 2) this.ghost.rotation.z = Math.PI / 2;
      else if (face < 4) this.ghost.rotation.x = Math.PI / 2;
      this.ghost.position.set(
        (hit.x + (face < 2 ? 0 : 0.5)) * 0.25,
        (face >= 4 ? (hit.z ?? height) : hit.z + 0.5) * 0.25 + 0.003,
        -(hit.y + (face >= 2 && face < 4 ? 0 : 0.5)) * 0.25,
      );
    }
  }
  rectangle(start: any, end: any, top: number) {
    this.rectangleGhost.visible = !!(start && end);
    if (!start || !end) {
      delete this.host.dataset.rectanglePreview;
      return;
    }
    const x0 = Math.min(start.x, end.x), x1 = Math.max(start.x, end.x);
    const y0 = Math.min(start.y, end.y), y1 = Math.max(start.y, end.y);
    this.rectangleGhost.scale.set((x1 - x0 + 1) * 0.25, 1, (y1 - y0 + 1) * 0.25);
    this.rectangleGhost.position.set((x0 + x1 + 1) * 0.125, top * 0.25 + 0.014,
      -(y0 + y1 + 1) * 0.125);
    this.host.dataset.rectanglePreview = "active";
  }
  disposeGeometry(group: THREE.Group) {
    for (const obj of [...group.children]) {
      group.remove(obj);
      obj.traverse((o: any) => {
        o.geometry?.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m: any) => m.dispose());
        }
      });
    }
  }
  update(doc: any, faces: Quad[], chunks?: Set<string>) {
    this.labelDoc = doc;
    const groups = new Map<string, Quad[]>();
    for (const q of faces) {
      if (!groups.has(q.chunk)) groups.set(q.chunk, []);
      groups.get(q.chunk)!.push(q);
    }
    for (const o of [...this.terrain.children])
      if (!chunks || chunks.has(o.name)) {
        this.terrain.remove(o);
        (o as THREE.Mesh).geometry.dispose();
        ((o as THREE.Mesh).material as THREE.Material).dispose();
      }
    for (const [key, quads] of groups) {
      const positions: number[] = [],
        normals: number[] = [],
        colors: number[] = [],
        indices: number[] = [];
      for (const q of quads) {
        const axes = [0, 1, 2].filter((a) => a !== q.axis);
        const base = positions.length / 3;
        const color = new THREE.Color(doc.palette[q.color]);
        for (const [a, b] of [
          [q.a, q.b],
          [q.a + q.w, q.b],
          [q.a + q.w, q.b + q.h],
          [q.a, q.b + q.h],
        ]) {
          const p = [0, 0, 0],
            n = [0, 0, 0];
          p[q.axis] = q.plane;
          p[axes[0]] = a;
          p[axes[1]] = b;
          n[q.axis] = q.sign;
          positions.push(p[0] * 0.25, p[2] * 0.25, -p[1] * 0.25);
          normals.push(n[0], n[2], -n[1]);
          colors.push(color.r, color.g, color.b);
        }
        const order =
          q.sign === (q.axis === 1 ? -1 : 1)
            ? [0, 1, 2, 0, 2, 3]
            : [0, 2, 1, 0, 3, 2];
        indices.push(...order.map((i) => base + i));
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(normals, 3),
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(colors, 3),
      );
      geometry.setIndex(indices);
      const material = this.flat
        ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = key;
      this.terrain.add(mesh);
    }
    this.stats.quads = this.terrain.children.reduce(
      (n, o) => n + ((o as THREE.Mesh).geometry.index?.count ?? 0) / 6,
      0,
    );
    this.disposeGeometry(this.overlays);
    for (const s of doc.surfaces ?? []) {
      const material = new THREE.MeshBasicMaterial({
        color:
          {
            walk: "#79bc89",
            deploy: "#72bcdd",
            obstacle: "#ce6c70",
            highground: "#cba458",
          }[s.tag as string] ?? "#fff",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.23, 0.23),
        material,
      );
      const axis = Math.floor(s.face / 2),
        sign = s.face % 2 === 0 ? 1 : -1,
        n = [0, 0, 0],
        p = [s.x + 0.5, s.y + 0.5, s.z + 0.5];
      n[axis] = sign;
      p[axis] = [s.x, s.y, s.z][axis] + sign * 0.016;
      plane.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(n[0], n[2], -n[1]),
      );
      plane.position.set(p[0] * 0.25, p[2] * 0.25, -p[1] * 0.25);
      this.overlays.add(plane);
    }
  }
  async refreshObjects(doc: any, read: (id: string) => Promise<any>) {
    const revision = ++this.revision;
    for (const o of this.objects.children)
      if (o.userData.decal) {
        (o as THREE.Mesh).geometry.dispose();
        ((o as THREE.Mesh).material as THREE.Material).dispose();
      }
    this.objects.clear();
    for (const p of doc.instances ?? [])
      try {
        let model = this.cache.get(p.assetId);
        if (!model) {
          const data = await read(p.assetId);
          const bytes = Uint8Array.from(atob(data.data), (c) =>
            c.charCodeAt(0),
          );
          model = (await new GLTFLoader().parseAsync(bytes.buffer, "")).scene;
          if (revision !== this.revision) {
            model.traverse((o: any) => {
              o.geometry?.dispose();
              o.material?.dispose?.();
            });
            return;
          }
          this.cache.set(p.assetId, model);
        }
        if (revision !== this.revision) return;
        const copy = model.clone(true);
        copy.position.set(p.x, p.z, -p.y);
        copy.rotation.y = (p.rotation * Math.PI) / 180;
        if (p.anchor)
          copy.position.sub(
            new THREE.Vector3(
              p.anchor[0],
              p.anchor[2],
              -p.anchor[1],
            ).applyEuler(copy.rotation),
          );
        copy.userData.instanceId = p.id;
        this.objects.add(copy);
      } catch (e: any) {
        this.onError("模型未显示：" + e.message);
      }
    for (const p of doc.decals ?? [])
      try {
        let texture = this.textures.get(p.assetId);
        if (!texture) {
          const data = await read(p.assetId);
          texture = await new THREE.TextureLoader().loadAsync(
            "data:image/png;base64," + data.data,
          );
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.NearestFilter;
          if (revision !== this.revision) {
            texture.dispose();
            return;
          }
          this.textures.set(p.assetId, texture);
        }
        if (revision !== this.revision) return;
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(p.width, p.height),
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          }),
        );
        plane.rotation.set(-Math.PI / 2, 0, (-p.rotation * Math.PI) / 180);
        plane.position.set(p.x, p.z + 0.002, -p.y);
        plane.renderOrder = p.order ?? 0;
        plane.userData.decal = true;
        this.objects.add(plane);
      } catch (e: any) {
        this.onError("贴花未显示：" + e.message);
      }
  }
  async reloadObjects(doc: any, read: (id: string) => Promise<any>) {
    const models = new Map<string, THREE.Object3D>(),
      textures = new Map<string, THREE.Texture>(),
      epoch = ++this.revision;
    const dispose = () => {
      for (const model of models.values()) this.disposeModel(model);
      for (const t of textures.values()) t.dispose();
    };
    try {
      for (const id of new Set<string>(
        (doc.instances ?? []).map((p: any) => p.assetId),
      )) {
        const data = await read(id);
        const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
        models.set(
          id,
          (await new GLTFLoader().parseAsync(bytes.buffer, "")).scene,
        );
      }
      for (const id of new Set<string>(
        (doc.decals ?? []).map((p: any) => p.assetId),
      )) {
        const data = await read(id),
          t = await new THREE.TextureLoader().loadAsync(
            "data:image/png;base64," + data.data,
          );
        t.colorSpace = THREE.SRGBColorSpace;
        t.magFilter = THREE.NearestFilter;
        textures.set(id, t);
      }
      if (epoch !== this.revision) {
        dispose();
        return;
      }
      this.clearAssets();
      this.cache = models;
      this.textures = textures;
      await this.refreshObjects(doc, read);
    } catch (e) {
      dispose();
      throw e;
    }
  }
  disposeModel(model: THREE.Object3D) {
    model.traverse((o: any) => {
      o.geometry?.dispose();
      for (const m of Array.isArray(o.material)
        ? o.material
        : o.material
          ? [o.material]
          : []) {
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) value.dispose();
        m.dispose();
      }
    });
  }
  clearAssets() {
    this.revision++;
    for (const o of this.objects.children)
      if (o.userData.decal) {
        (o as THREE.Mesh).geometry.dispose();
        ((o as THREE.Mesh).material as THREE.Material).dispose();
      }
    this.objects.clear();
    for (const model of this.cache.values())
      model.traverse((o: any) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material)
          ? o.material
          : o.material
            ? [o.material]
            : []) {
          for (const value of Object.values(m))
            if (value instanceof THREE.Texture) value.dispose();
          m.dispose();
        }
      });
    this.cache.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();this.controls.dispose();this.clearAssets();this.reference.dispose();
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    this.scene.traverse((o:any)=>{if(o.geometry)geometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}});
    textures.forEach(t=>t.dispose());geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.labelLayer.remove();
  }
}
