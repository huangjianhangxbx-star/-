import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { assemblyAssetGeometry } from "./assembly-view.ts";
import { SurfacePaintLayer } from "./surface-paint-layer.ts";
import { sourceToThree } from "../core/coordinates.ts";
import {editorReferences} from '../core/references.ts';
import {ReferenceCollectionView} from './reference-view.ts';
import type {
  AssetDocument,
  SceneDocument,
} from "../core/workshop-documents.ts";

export type ScenePreviewData = {
  scene: SceneDocument;
  assets: Map<string, AssetDocument>;
  binaries: Map<string, { row: any; data: string }>;
};
type Binary = {
  data: string;
  promise: Promise<THREE.Object3D | THREE.Texture>;
};
function disposeObject(root: THREE.Object3D) {
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  root.traverse((node: any) => {
    if (node.geometry) geometry.add(node.geometry);
    for (const material of Array.isArray(node.material)
      ? node.material
      : node.material
        ? [node.material]
        : [])
      materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  geometry.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
}
/** Scene geometry/paint shared with assembly, mounted into an existing viewport. Owns no renderer or input handlers. */
export class ScenePreviewLayer {
  readonly root = new THREE.Group();
  private objects = new THREE.Group();
  private references=new ReferenceCollectionView();
  private grid = new THREE.GridHelper(32, 128, "#617d89", "#344e5c");
  private sources = new Map<
    string,
    { key: string; geometry: THREE.BufferGeometry }
  >();
  private binaries = new Map<string, Binary>();
  private paints: SurfacePaintLayer[] = [];
  private materials: THREE.Material[] = [];
  private material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
  });
  private missing = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  private missingMaterial = new THREE.MeshBasicMaterial({
    color: "#e45b76",
    wireframe: true,
  });
  private plane = new THREE.PlaneGeometry(1, 1);
  private generation = 0;
  voxelCount = 0;
  constructor() {
    this.root.name = "read-only-scene-preview";
    this.grid.renderOrder = -100;
    this.root.add(this.objects, this.grid,this.references.group);
  }
  private binary(id: string, payload: { row: any; data: string }) {
    const cached = this.binaries.get(id);
    if (cached?.data === payload.data) return cached.promise;
    if (cached)
      void cached.promise
        .then((value) =>
          value instanceof THREE.Texture
            ? value.dispose()
            : disposeObject(value),
        )
        .catch(() => {});
    const promise: Promise<THREE.Object3D | THREE.Texture> =
      payload.row.kind === "texture"
        ? new THREE.TextureLoader()
            .loadAsync("data:image/png;base64," + payload.data)
            .then((texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.magFilter = THREE.NearestFilter;
              return texture;
            })
        : new GLTFLoader()
            .parseAsync(
              Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0))
                .buffer,
              "",
            )
            .then((gltf) => gltf.scene);
    this.binaries.set(id, { data: payload.data, promise });
    return promise;
  }
  async update(data: ScenePreviewData) {
    const generation = ++this.generation,
      loaded = new Map<string, THREE.Object3D | THREE.Texture>();
    await Promise.all(
      [...data.binaries].map(async ([id, payload]) => {
        try {
          loaded.set(id, await this.binary(id, payload));
        } catch {}
      }),
    );
    if (generation !== this.generation) return false;
    this.clearObjects();
    this.references.update(editorReferences(data.scene.editor).filter(reference=>reference.kind!=='modeling'));
    this.voxelCount = 0;
    for (const [id, source] of this.sources)
      if (!data.assets.has(id)) {
        source.geometry.dispose();
        this.sources.delete(id);
      }
    for (const [id, binary] of this.binaries)
      if (!data.binaries.has(id)) {
        void binary.promise
          .then((value) =>
            value instanceof THREE.Texture
              ? value.dispose()
              : disposeObject(value),
          )
          .catch(() => {});
        this.binaries.delete(id);
      }
    const visible = new Set(
      data.scene.groups.filter((g) => g.visible).map((g) => g.groupId),
    );
    for (const instance of data.scene.instances) {
      if (!visible.has(instance.groupId)) continue;
      const asset = data.assets.get(instance.assetId),
        binary = loaded.get(instance.assetId),
        group = new THREE.Group();
      let mesh: THREE.Object3D;
      if (asset) {
        this.voxelCount +=
          asset.canvases?.reduce((n, c) => n + c.cells.length, 0) ??
          asset.cells.length;
        const key = JSON.stringify([
          asset.canvases ?? asset.cells,
          asset.palette,
          asset.sideColor,
        ]);
        let cached = this.sources.get(instance.assetId);
        if (!cached || cached.key !== key) {
          cached?.geometry.dispose();
          cached = { key, geometry: assemblyAssetGeometry(asset) };
          this.sources.set(instance.assetId, cached);
        }
        mesh = new THREE.Mesh(cached.geometry, this.material);
        mesh.position
          .fromArray(sourceToThree(asset.anchorM))
          .multiplyScalar(-1);
        const paint = new SurfacePaintLayer(mesh);
        paint.update(asset);
        this.paints.push(paint);
      } else if (binary instanceof THREE.Object3D) {
        mesh = binary.clone(true);
        const anchor = data.binaries.get(instance.assetId)?.row.anchorM ?? [
          0, 0, 0,
        ];
        mesh.position.sub(new THREE.Vector3().fromArray(sourceToThree(anchor)));
      } else mesh = new THREE.Mesh(this.missing, this.missingMaterial);
      mesh.userData.viewportRole = "model";
      group.userData.instanceId = instance.instanceId;
      group.userData.assetId = instance.assetId;
      group.add(mesh);
      group.position.fromArray(sourceToThree(instance.positionM));
      group.rotation.y = (instance.rotationDeg * Math.PI) / 180;
      this.objects.add(group);
    }
    for (const decal of data.scene.decals) {
      const texture = loaded.get(decal.assetId),
        group = new THREE.Group();
      let material: THREE.Material = this.missingMaterial;
      if (texture instanceof THREE.Texture) {
        material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        this.materials.push(material);
      }
      const mesh = new THREE.Mesh(
        texture instanceof THREE.Texture ? this.plane : this.missing,
        material,
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(decal.widthM, decal.heightM, 1);
      group.add(mesh);
      group.userData.instanceId = decal.decalId;
      group.position.fromArray(sourceToThree(decal.positionM));
      group.position.y += 0.003;
      group.rotation.y = (decal.rotationDeg * Math.PI) / 180;
      this.objects.add(group);
    }
    return true;
  }
  bounds() {
    return new THREE.Box3().setFromObject(this.objects);
  }
  faceCamera(camera:THREE.Camera){this.references.faceCamera(camera);}
  get instanceCount() {
    return this.objects.children.length;
  }
  private clearObjects() {
    this.paints.forEach((p) => p.dispose());
    this.paints = [];
    this.materials.forEach((m) => m.dispose());
    this.materials = [];
    this.objects.clear();
  }
  dispose() {
    this.generation++;
    this.references.dispose();
    this.root.removeFromParent();
    this.clearObjects();
    this.sources.forEach((s) => s.geometry.dispose());
    this.sources.clear();
    for (const entry of this.binaries.values())
      void entry.promise
        .then((value) =>
          value instanceof THREE.Texture
            ? value.dispose()
            : disposeObject(value),
        )
        .catch(() => {});
    this.binaries.clear();
    this.grid.geometry.dispose();
    (this.grid.material as THREE.Material).dispose();
    this.material.dispose();
    this.missing.dispose();
    this.missingMaterial.dispose();
    this.plane.dispose();
  }
}
